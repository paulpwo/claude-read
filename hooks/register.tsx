import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Playback } from '../types'

type Engine = EngineInterface
type Os = 'mac' | 'linux' | 'windows'
type Options = { engine?: string; voice?: string; systemVoice?: string; edgeTts?: string }
type Synth = 'edge-tts' | 'system'

const FRAME_MS = 350
const FRAMES = ['\u{1F508}', '\u{1F509}', '\u{1F50A}']
const PAUSED = '\u23F8'
const RATE = /^[+-]\d{1,3}%$/
const MAX_CHARS = 3000
// Words per minute that `say` and espeak-ng read at a +0% rate.
const BASE_WPM = 180


const playback = atom({ plugin: 'leer', key: 'playback' } as const, 'idle' as Playback)
const frame = atom({ plugin: 'leer', key: 'frame' } as const, 0)

const SPEAK_TOOL = {
  name: 'speak',
  description:
    "Speaks the given plain text aloud on the user's machine and returns once playback has started. " +
    'Use only when the user asked to hear a response (the /leer command).',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Plain prose to read: no markdown, code, paths or URLs.' },
      rate: { type: 'string', description: 'Signed speed change, e.g. "+0%", "+25%", "-20%".' },
    },
    required: ['text'],
  },
}

/** Parses "+25%" into 25, clamped to -50..+100; anything else is 0. */
export function ratePercent(rate: unknown): number {
  if (typeof rate !== 'string' || !RATE.test(rate)) return 0
  return Math.max(-50, Math.min(100, parseInt(rate, 10)))
}

/** SAPI rates run -10..10 and roughly triple speed at +10. */
export function sapiRate(percent: number): number {
  return Math.max(-10, Math.min(10, Math.round((10 * Math.log(1 + percent / 100)) / Math.log(3))))
}

let config: Required<Options> = { engine: 'auto', voice: 'es-CO-GonzaloNeural', systemVoice: '', edgeTts: 'edge-tts' }
let os: Os = 'mac'
let tmp = '/tmp'
let linuxPlayer = 'paplay'
let audio = ''
let audioFrom: Synth = 'edge-tts'
let animation: Timer | undefined
let child: AsyncGenerator<unknown, unknown> | undefined

const sep = () => (os === 'windows' ? '\\' : '/')
const file = (name: string) => `${tmp}${sep()}claude-leer-${name}`
const script = (root: string, name: string) => `${root}${sep()}scripts${sep()}${name}`

/** The engines to try, in order: `auto` falls back to the OS voice when edge-tts fails (offline, not installed). */
export function synthOrder(engine: string): Synth[] {
  if (engine === 'system') return ['system']
  if (engine === 'edge-tts') return ['edge-tts']
  return ['edge-tts', 'system']
}

function audioFile(synth: Synth): string {
  return file(`audio.${synth === 'edge-tts' ? 'mp3' : os === 'mac' ? 'aiff' : 'wav'}`)
}

function synthArgv(synth: Synth, root: string, percent: number, textFile: string, out: string): string[] {
  if (synth === 'edge-tts') {
    const rate = `${percent >= 0 ? '+' : ''}${percent}%`
    return [config.edgeTts, '--voice', config.voice, `--rate=${rate}`, '--file', textFile, '--write-media', out]
  }
  const wpm = String(Math.round(BASE_WPM * (1 + percent / 100)))
  const voice = config.systemVoice
  if (os === 'mac') return ['say', ...(voice ? ['-v', voice] : []), '-r', wpm, '-f', textFile, '-o', out]
  if (os === 'linux') return ['espeak-ng', ...(voice ? ['-v', voice] : []), '-s', wpm, '-f', textFile, '-w', out]
  return [
    'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script(root, 'speak-windows.ps1'),
    '-TextFile', textFile, '-OutFile', out, '-Rate', String(sapiRate(percent)), ...(voice ? ['-Voice', voice] : []),
  ]
}

function playerArgv(root: string): string[] {
  if (os === 'mac') return ['afplay', audio]
  if (os === 'windows') {
    return ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script(root, 'play-windows.ps1'),
      '-Audio', audio, '-Control', file('control.txt')]
  }
  if (audioFrom === 'edge-tts') return ['ffplay', '-nodisp', '-autoexit', '-loglevel', 'quiet', audio]
  return [linuxPlayer, audio]
}

// macOS and Linux freeze and end the player with signals; Windows reads a control file.
async function control($: Engine, cmd: 'play' | 'pause' | 'stop') {
  if (os === 'windows') {
    await $.fs.write(file('control.txt'), cmd).catch(() => undefined)
    return
  }
  const pattern = 'claude-leer-audio'
  const run = (sig: string) => $.process.run(['pkill', sig, '-f', pattern]).catch(() => undefined)
  if (cmd === 'pause') await run('-STOP')
  if (cmd === 'play') await run('-CONT')
  if (cmd === 'stop') {
    // CONT first: a stopped process holds TERM until it resumes.
    await run('-CONT')
    await run('-TERM')
  }
}

// Cycles the speaker glyph while audio plays; any other state freezes it.
async function setPlayback($: Engine, next: Playback) {
  await update($, playback, () => next)
  animation?.cancel()
  animation = undefined
  if (next === 'playing') {
    animation = $.clock.every(FRAME_MS, () => {
      void update($, frame, n => (n + 1) % FRAMES.length).catch(() => undefined)
    })
  }
}

async function startPlayer($: Engine) {
  if (os === 'windows') await $.fs.write(file('control.txt'), 'play')
  const current = $.process.spawn({ argv: playerArgv($.plugin.root) })
  child = current
  await setPlayback($, 'playing')

  void (async () => {
    try {
      for await (const _ of current) {
        // The player writes nothing; the loop is the child's life.
      }
    } catch {
      // A player that cannot start ends the reading like one that finished.
    } finally {
      if (child === current) {
        child = undefined
        // The module may already be unloaded (reload, session end).
        await setPlayback($, 'idle').catch(() => undefined)
      }
    }
  })()
}

async function stop($: Engine) {
  child = undefined
  await control($, 'stop')
  await setPlayback($, 'idle')
}

async function togglePause($: Engine) {
  const state = await read($, playback)
  if (state === 'idle') return
  await control($, state === 'playing' ? 'pause' : 'play')
  await setPlayback($, state === 'playing' ? 'paused' : 'playing')
}

export const register: Register = (on, options) => {
  config = { ...config, ...((options ?? {}) as Options) }

  on('session.start', async ($, e, next) => {
    const started = await next(e)

    if ((await $.env.get('OS')) === 'Windows_NT') {
      os = 'windows'
      tmp = ((await $.env.get('TEMP')) ?? 'C:\\Windows\\Temp').replace(/\\+$/, '')
    } else {
      const uname = await $.process.run(['uname', '-s']).catch(() => undefined)
      os = uname?.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
      tmp = ((await $.env.get('TMPDIR')) ?? '/tmp').replace(/\/+$/, '')
      if (os === 'linux') {
        const pulse = await $.process.run(['which', 'paplay']).catch(() => undefined)
        linuxPlayer = pulse?.exitCode === 0 ? 'paplay' : 'aplay'
      }
    }

    // State outlives reloads, but the player does not: start every load idle.
    await setPlayback($, 'idle')
    await $.tool.register(SPEAK_TOOL)
    return started
  })

  on('tool.call', { tool: 'mcp__leer__speak' }, async ($, e) => {
    const input = e as unknown as { text?: unknown; rate?: unknown }
    const text = typeof input.text === 'string' ? input.text.trim().slice(0, MAX_CHARS) : ''
    if (text === '') return { deny: 'Nothing to read: `text` is empty.' }

    await stop($)

    // The text goes through a file and every program by argv, never a shell,
    // so the same call works on macOS, Linux and Windows.
    const textFile = file('text.txt')
    await $.fs.write(textFile, text)
    const failures: string[] = []
    for (const synth of synthOrder(config.engine)) {
      const out = audioFile(synth)
      const argv = synthArgv(synth, $.plugin.root, ratePercent(input.rate), textFile, out)
      const ran = await $.process
        .run(argv, { timeoutMs: 120_000 })
        .catch((err: unknown) => ({ exitCode: -1, stdout: '', stderr: String(err) }))
      if (ran.exitCode === 0) {
        audio = out
        audioFrom = synth
        break
      }
      failures.push(`${argv[0]}: ${ran.stderr.trim().slice(0, 300) || `exit ${ran.exitCode}`}`)
    }
    if (failures.length === synthOrder(config.engine).length) {
      return { deny: `Speech synthesis failed. ${failures.join(' | ')}` }
    }
    if (failures.length > 0) $.ui.toast('leer: edge-tts unavailable, using the system voice')

    await startPlayer($)
    return { result: 'Reading aloud.' } as never
  }).catch(() => ({ deny: 'The leer plugin failed to read this text aloud.' }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = await read($, playback)

    if (state === 'idle' || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const glyph = state === 'paused' ? PAUSED : FRAMES[await read($, frame)]

    return (
      <Box>
        <Button key="speaker" plain label={glyph} onPress={() => void stop($)} />
        <Button
          key="pause"
          plain
          label={state === 'paused' ? ' \u25B6 ' : ' \u23F8 '}
          onPress={() => void togglePause($)}
        />
        <Button key="stop" plain label={' \u23F9 '} onPress={() => void stop($)} />
        <Text dimColor>{state === 'paused' ? ' Paused' : ' Reading'}</Text>
      </Box>
    )
  })
}
