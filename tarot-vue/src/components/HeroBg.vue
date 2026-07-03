<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId = 0
let resizeFrame = 0
let reducedMotion = false
let resizeHandler: (() => void) | null = null
let visibilityHandler: (() => void) | null = null

interface Star {
  x: number
  y: number
  radius: number
  baseAlpha: number
  phase: number
  speed: number
  isGold: boolean
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) return

  const canvasCandidate = canvasRef.value
  if (!canvasCandidate) return
  const contextCandidate = canvasCandidate.getContext('2d')
  if (!contextCandidate) return
  const canvas: HTMLCanvasElement = canvasCandidate
  const ctx: CanvasRenderingContext2D = contextCandidate

  let width = 0
  let height = 0
  let pixelRatio = 1
  let time = 0
  const stars: Star[] = []
  const shootingStars: ShootingStar[] = []

  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.floor(width * pixelRatio)
    canvas.height = Math.floor(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  function createStars() {
    stars.length = 0
    const divisor = width < 640 ? 8200 : 6000
    const maxCount = width < 640 ? 150 : 220
    const count = Math.min(Math.floor(width * height / divisor), maxCount)
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 0.3,
        baseAlpha: Math.random() * 0.55 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.007 + 0.002,
        isGold: Math.random() < 0.15,
      })
    }
  }

  function spawnShootingStar() {
    if (shootingStars.length >= 1) return
    shootingStars.push({
      x: Math.random() * width * 0.7,
      y: Math.random() * height * 0.4,
      vx: 3 + Math.random() * 4,
      vy: 1 + Math.random() * 2,
      life: 0,
      maxLife: 40 + Math.random() * 30,
    })
  }

  function stop() {
    if (animationId) cancelAnimationFrame(animationId)
    animationId = 0
  }

  function draw() {
    if (document.hidden) {
      stop()
      return
    }

    ctx.clearRect(0, 0, width, height)
    time += 1

    for (const star of stars) {
      const twinkle = Math.sin(time * star.speed + star.phase)
      const alpha = star.baseAlpha + twinkle * 0.28
      ctx.fillStyle = star.isGold
        ? `rgba(212, 168, 83, ${Math.max(0.05, alpha)})`
        : `rgba(255, 255, 255, ${Math.max(0.05, alpha)})`
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
      ctx.fill()
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i]
      ss.x += ss.vx
      ss.y += ss.vy
      ss.life += 1
      const progress = ss.life / ss.maxLife
      const fadeAlpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7
      const gradient = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * 8, ss.y - ss.vy * 8)
      gradient.addColorStop(0, `rgba(212, 168, 83, ${fadeAlpha * 0.8})`)
      gradient.addColorStop(1, 'rgba(212, 168, 83, 0)')
      ctx.strokeStyle = gradient
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(ss.x, ss.y)
      ctx.lineTo(ss.x - ss.vx * 8, ss.y - ss.vy * 8)
      ctx.stroke()

      if (ss.life >= ss.maxLife) shootingStars.splice(i, 1)
    }

    if (Math.random() < 0.0025) spawnShootingStar()
    animationId = requestAnimationFrame(draw)
  }

  function start() {
    if (!animationId && !document.hidden) animationId = requestAnimationFrame(draw)
  }

  resizeHandler = () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      resize()
      createStars()
    })
  }
  visibilityHandler = () => {
    if (document.hidden) stop()
    else start()
  }

  resize()
  createStars()
  start()
  window.addEventListener('resize', resizeHandler, { passive: true })
  document.addEventListener('visibilitychange', visibilityHandler)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
})
</script>

<template>
  <div class="hero-bg fixed inset-0 z-0">
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />
    <div class="nebula-layer"></div>
  </div>
</template>
