import { readonly, ref } from 'vue'

const isPlaying = ref(false)
let context: AudioContext | null = null
let masterGain: GainNode | null = null
let activeNodes: AudioScheduledSourceNode[] = []

function createTone(ctx: AudioContext, output: AudioNode, frequency: number, gainValue: number, detune: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const tremolo = ctx.createOscillator()
  const tremoloDepth = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  oscillator.detune.value = detune
  gain.gain.value = gainValue
  tremolo.type = 'sine'
  tremolo.frequency.value = 0.035 + frequency / 15000
  tremoloDepth.gain.value = gainValue * 0.28

  tremolo.connect(tremoloDepth)
  tremoloDepth.connect(gain.gain)
  oscillator.connect(gain)
  gain.connect(output)
  oscillator.start()
  tremolo.start()
  activeNodes.push(oscillator, tremolo)
}

async function startBackgroundMusic() {
  if (isPlaying.value) return
  const AudioContextClass = window.AudioContext
  context = new AudioContextClass()
  await context.resume()

  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  filter.Q.value = 0.5

  masterGain = context.createGain()
  masterGain.gain.setValueAtTime(0.0001, context.currentTime)
  masterGain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 1.8)
  filter.connect(masterGain)
  masterGain.connect(context.destination)

  // A2 · E3 · A3 · C#4，缓慢起伏的环境和弦。
  createTone(context, filter, 110, 0.2, -5)
  createTone(context, filter, 164.81, 0.12, 4)
  createTone(context, filter, 220, 0.08, -3)
  createTone(context, filter, 277.18, 0.055, 6)
  isPlaying.value = true
}

async function stopBackgroundMusic() {
  if (!context) {
    isPlaying.value = false
    return
  }
  const ctx = context
  const gain = masterGain
  if (gain && ctx.state !== 'closed') {
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
  }
  await new Promise((resolve) => window.setTimeout(resolve, 380))
  activeNodes.forEach((node) => {
    try { node.stop() } catch { /* already stopped */ }
  })
  activeNodes = []
  await ctx.close().catch(() => undefined)
  if (context === ctx) context = null
  masterGain = null
  isPlaying.value = false
}

async function toggleBackgroundMusic() {
  if (isPlaying.value) await stopBackgroundMusic()
  else await startBackgroundMusic()
}

export function useBackgroundMusic() {
  return {
    isPlaying: readonly(isPlaying),
    toggleBackgroundMusic,
    stopBackgroundMusic,
  }
}
