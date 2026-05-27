import { ref, type CSSProperties } from 'vue'

/** 与 TarotCard3D / 每日运势单卡一致的指针倾斜强度 */
const MAX_ROT_Y = 24
const MAX_ROT_X = 16
const TRANSLATE_Z = 8

export type StripHoverTilt = { index: number; rx: number; ry: number; sx: number; sy: number }

/**
 * 牌堆横条：单张高亮倾斜 + 光泽跟随（委托在 strip 根节点上的 mousemove）。
 */
export function useStripDeckTilt() {
  const hover = ref<StripHoverTilt | null>(null)

  function onStripMouseMove(e: MouseEvent, opts: {
    stripRoot: HTMLElement | null
    /** 为 true 时不跟随指针（已选、禁用等） */
    isIndexBlocked: (index: number) => boolean
  }) {
    const { stripRoot, isIndexBlocked } = opts
    if (!stripRoot) return
    const back = (e.target as HTMLElement).closest('.card-back-tilt-target') as HTMLElement | null
    if (!back || !stripRoot.contains(back)) {
      hover.value = null
      return
    }
    const slot = back.closest('[data-strip-idx]') as HTMLElement | null
    if (!slot) return
    const idx = Number(slot.dataset.stripIdx)
    if (Number.isNaN(idx) || isIndexBlocked(idx)) {
      hover.value = null
      return
    }
    const rect = back.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    hover.value = {
      index: idx,
      ry: (nx - 0.5) * MAX_ROT_Y,
      rx: (0.5 - ny) * MAX_ROT_X,
      sx: nx * 100,
      sy: ny * 100,
    }
  }

  function clearStripHover() {
    hover.value = null
  }

  function stripCardTransform(index: number): CSSProperties {
    const h = hover.value
    if (!h || h.index !== index) {
      return { transform: 'rotateY(0deg) rotateX(0deg) translateZ(0px)' }
    }
    return {
      transform: `rotateY(${h.ry}deg) rotateX(${h.rx}deg) translateZ(${TRANSLATE_Z}px)`,
    }
  }

  function stripShineStyle(index: number): CSSProperties {
    const h = hover.value
    if (!h || h.index !== index) {
      return { opacity: 0 }
    }
    return {
      background: `radial-gradient(circle at ${h.sx}% ${h.sy}%, rgba(255,255,255,.14) 0%, rgba(255,255,255,.04) 40%, transparent 72%)`,
      opacity: 1,
    }
  }

  return { hover, onStripMouseMove, clearStripHover, stripCardTransform, stripShineStyle }
}
