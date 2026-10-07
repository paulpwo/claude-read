# claude-read — hear Claude Code's answers aloud

`/read` reads Claude's previous response aloud while an animated speaker shows above the prompt.

- **Natural voices, free.** It uses [edge-tts](https://github.com/rany2/edge-tts), the free Microsoft Edge read-aloud service: no API key, no account, no cost. Every locale works, including `es-CO`, `es-VE`, `es-US`, `es-MX`, `es-ES` and `en-US`.
- **Offline fallback.** If edge-tts is missing or there is no internet connection, it uses your OS's own voice: `say` on macOS, SAPI on Windows, `espeak-ng` on Linux.
- **One-click controls.** Buttons next to the speaker pause, resume and stop the reading.
- **Speed.** Say the speed in words: `/read faster`, `/read más lento`, `/read 30% faster`.
- **Partial reading.** Name the part you want to hear: `/read only the conclusion`.

> Speech is generated on your machine (system voices) or by the free Edge read-aloud service (edge-tts). The plugin never calls a paid API.

## Requirements

| | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Claude Code | terminal, recent version with plugin function hooks | same | same |
| Natural voices (recommended) | `pipx install edge-tts` | `pip install edge-tts` | `pipx install edge-tts` |
| Player | `afplay` (built in) | PowerShell (built in) | `paplay` or `aplay`; `ffplay` (ffmpeg) for edge-tts audio |
| Offline voice | `say` (built in) | SAPI (built in) | `espeak-ng` |

Check edge-tts with: `edge-tts --text "hola" --write-media test.mp3`.

## Install

Type this at the Claude Code prompt:

```
/plugin install read --marketplace paulpwo/claude-read
```

Answer `y` to add the marketplace, then choose the scope (User is recommended). The plugin works right away.

## Use

Type the instructions in any language: Claude interprets them by meaning.

```
/read                        read the whole last response
/read faster                 +25%   (más rápido, mais rápido…)
/read much faster            +50%
/read slower                 -20%   (más lento…)
/read 30% faster             exact percentage, from -50% to +100%
/read only the summary       read only that part
/read solo la conclusión     the same, in Spanish
```

While it reads:

| Button | Action |
| --- | --- |
| 🔊 | stop |
| ⏸ / ▶ | pause / resume |
| ⏹ | stop |

Claude Code does not let plugins take over keys such as Esc, so the controls are buttons.

## Configure

Run `/config` and find **read**, or edit `pluginConfigs` in `~/.claude/settings.json`:

```json
{
  "pluginConfigs": {
    "read": {
      "options": {
        "engine": "auto",
        "voice": "es-CO-GonzaloNeural",
        "systemVoice": "",
        "edgeTts": "edge-tts"
      }
    }
  }
}
```

| Option | Values | Default |
| --- | --- | --- |
| `engine` | `auto` (edge-tts, then the system voice), `edge-tts`, `system` | `auto` |
| `voice` | any name from `edge-tts --list-voices` | `es-CO-GonzaloNeural` |
| `systemVoice` | macOS `say -v '?'`, Windows SAPI voice name, Linux `espeak-ng --voices`; empty = default | empty |
| `edgeTts` | command name or full path of edge-tts | `edge-tts` |

Some voices to start with:

| Locale | Voices |
| --- | --- |
| Spanish (Colombia) | `es-CO-GonzaloNeural`, `es-CO-SalomeNeural` |
| Spanish (Venezuela) | `es-VE-SebastianNeural`, `es-VE-PaolaNeural` |
| Spanish (United States) | `es-US-AlonsoNeural`, `es-US-PalomaNeural` |
| Spanish (Mexico) | `es-MX-JorgeNeural`, `es-MX-DaliaNeural` |
| English (United States) | `en-US-AndrewNeural`, `en-US-AvaNeural` |

List all of them with `edge-tts --list-voices`.

## Adapt it

The code is short and commented:

- `commands/read.md` is the prompt that turns `/read` arguments into clean text and a speed. Edit it to change the speed words or the cleaning rules.
- `hooks/register.tsx` registers the `speak` tool, runs the synthesis, controls the player and draws the speaker band.
- `scripts/*.ps1` are the Windows synthesis and playback helpers.

Run the tests with `claude plugin test .` and validate with `claude plugin validate .`.

## How it works

1. `/read` asks Claude to clean its last answer for speech and call the plugin's `speak` tool with the text and the speed.
2. The plugin runs edge-tts (or the system voice) directly, without a shell, and writes the audio to your temp folder.
3. It plays the audio in the background and shows the band. The buttons act on that player. macOS and Linux pause with signals, and Windows uses a control file.

## Troubleshooting

- **`/read` says synthesis failed.** Run `edge-tts --list-voices` to check the install and the network, or set `engine` to `system`.
- **No sound on Linux.** Install `pulseaudio-utils` (paplay) or `alsa-utils` (aplay), plus `ffmpeg` for edge-tts audio.

## Platform status

- **macOS**: tested.
- **Linux**: implemented, not tested yet.
- **Windows**: implemented with PowerShell helpers, not tested yet. Reports and pull requests are welcome.

## License

MIT
