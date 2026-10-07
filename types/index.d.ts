export type Playback = 'idle' | 'playing' | 'paused'

declare module 'claude-code' {
  interface PluginState {
    leer: { playback: Playback; frame: number }
  }
}
