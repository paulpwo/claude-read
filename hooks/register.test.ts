import { expect, test } from 'claude-code/testing'

import { ratePercent, sapiRate, synthOrder } from './register.tsx'

test('clamps and parses the requested rate', async () => {
  expect(ratePercent('+25%')).toBe(25)
  expect(ratePercent('-80%')).toBe(-50)
  expect(ratePercent('+300%')).toBe(100)
  expect(ratePercent('fast')).toBe(0)
  expect(sapiRate(0)).toBe(0)
  expect(sapiRate(100)).toBe(6)
  expect(sapiRate(-50)).toBe(-6)
  expect(synthOrder('auto')).toEqual(['edge-tts', 'system'])
  expect(synthOrder('system')).toEqual(['system'])
})

test('falls back to the OS voice when edge-tts fails, by argv, and plays the result', async ($, on) => {
  const ran: string[][] = []
  const spawned: string[][] = []

  on('process.run', ($, e) => {
    ran.push([...e.argv])
    const exitCode = e.argv[0] === 'edge-tts' ? 1 : 0
    return { value: { exitCode, stdout: '', stderr: 'offline' } } as never
  })
  on('fs.write', () => ({ value: undefined }) as never)
  on('process.spawn', async function* ($, e) {
    spawned.push([...e.argv])
    return { value: { code: 0, signal: null } } as never
  })

  const result = await $.tool.call({ tool: 'mcp__read__speak', text: 'hola mundo', rate: '+25%' } as never)
  // The player starts on a detached loop; let it reach its first pull.
  for (let i = 0; i < 50; i++) await Promise.resolve()

  expect((result as { deny?: string }).deny).toBe(undefined)
  const say = ran.find(argv => argv[0] === 'say')
  expect(say !== undefined).toBe(true)
  expect(say?.includes('225')).toBe(true)
  expect(ran.findIndex(argv => argv[0] === 'edge-tts') < ran.findIndex(argv => argv[0] === 'say')).toBe(true)
  expect(spawned[0]?.[0]).toBe('afplay')
  expect(spawned[0]?.[1]?.endsWith('claude-read-audio.aiff')).toBe(true)
})

test('refuses empty text without synthesizing', async ($, on) => {
  const ran: string[][] = []
  on('process.run', ($, e) => {
    ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: 'Darwin\n', stderr: '' } } as never
  })

  const result = await $.tool.call({ tool: 'mcp__read__speak', text: '   ' } as never)

  expect(typeof (result as { deny?: string }).deny).toBe('string')
  expect(ran.some(argv => argv[0] === 'say' || argv[0] === 'edge-tts')).toBe(false)
})

test('a blank option keeps its default', { options: { edgeTts: '', voice: '  ' } }, async ($, on) => {
  const ran: string[][] = []
  on('process.run', ($, e) => {
    ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('fs.write', () => ({ value: undefined }) as never)
  on('process.spawn', async function* () {
    return { value: { code: 0, signal: null } } as never
  })

  await $.tool.call({ tool: 'mcp__read__speak', text: 'hola' } as never)

  const edge = ran.find(argv => argv.includes('--write-media'))
  expect(edge?.[0]).toBe('edge-tts')
  expect(edge?.[2]).toBe('es-CO-GonzaloNeural')
})

test('/read submits a short prompt with its arguments', async ($, on) => {
  const submitted: { text: string; context?: readonly string[] }[] = []
  on('prompt.submit', ($, e) => {
    submitted.push({ text: e.text, context: e.context })
    return { text: e.text } as never
  })

  const toasts: string[] = []
  on('clock.sleep', () => ({ value: undefined }) as never)
  on('ui.toast', ($, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return {} as never
  })

  await $.command.run({ command: 'read', args: 'más rápido' } as never)
  for (let i = 0; i < 50; i++) await Promise.resolve()

  expect(toasts).toEqual([])
  expect(submitted[0]?.text).toBe('Read your previous response aloud: más rápido')
})
