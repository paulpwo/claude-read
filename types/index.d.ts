export type Playback = 'idle' | 'playing' | 'paused'

declare module 'claude-code' {
  interface PluginState {
    read: { playback: Playback; frame: number }
  }
}
