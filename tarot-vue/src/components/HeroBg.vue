<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId = 0
let reducedMotion = false

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

  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let width = 0
  let height = 0
  const stars: Star[] = []
  const shootingStars: ShootingStar[] = []

  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    canvas!.width = width
    canvas!.height = height
  }

  function createStars() {
    stars.length = 0
    const count = Math.min(Math.floor(width * height / 4000), 300)
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.3,
        baseAlpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.008 + 0.003,
        isGold: Math.random() < 0.15,
      })
    }
  }

  function spawnShootingStar() {
    if (shootingStars.length >= 2) return
    shootingStars.push({
      x: Math.random() * width * 0.7,
      y: Math.random() * height * 0.4,
      vx: 3 + Math.random() * 4,
      vy: 1 + Math.random() * 2,
      life: 0,
      maxLife: 40 + Math.random() * 30,
    })
  }

  let time = 0
  function draw() {
    ctx!.clearRect(0, 0, width, height)
    time++

    for (const star of stars) {
      const twinkle = Math.sin(time * star.speed + star.phase)
      const alpha = star.baseAlpha + twinkle * 0.3
      if (star.isGold) {
        ctx!.fillStyle = `rgba(212, 168, 83, ${Math.max(0.05, alpha)})`
      } else {
        ctx!.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, alpha)})`
      }
      ctx!.beginPath()
      ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
      ctx!.fill()
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i]
      ss.x += ss.vx
      ss.y += ss.vy
      ss.life++
      const progress = ss.life / ss.maxLife
      const fadeAlpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7

      const gradient = ctx!.createLinearGradient(
        ss.x, ss.y, ss.x - ss.vx * 8, ss.y - ss.vy * 8
      )
      gradient.addColorStop(0, `rgba(212, 168, 83, ${fadeAlpha * 0.8})`)
      gradient.addColorStop(1, 'rgba(212, 168, 83, 0)')

      ctx!.strokeStyle = gradient
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      ctx!.moveTo(ss.x, ss.y)
      ctx!.lineTo(ss.x - ss.vx * 8, ss.y - ss.vy * 8)
      ctx!.stroke()

      if (ss.life >= ss.maxLife) {
        shootingStars.splice(i, 1)
      }
    }

    if (Math.random() < 0.004) {
      spawnShootingStar()
    }

    animationId = requestAnimationFrame(draw)
  }

  resize()
  createStars()
  draw()

  window.addEventListener('resize', () => {
    resize()
    createStars()
  })
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
})
</script>

<template>
  <div class="hero-bg fixed inset-0 z-0">
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />
    <div class="nebula-layer"></div>
  </div>
</template>
