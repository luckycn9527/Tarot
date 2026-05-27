import { onMounted, onUnmounted, nextTick } from 'vue'

export function useScrollReveal() {
  let observer: IntersectionObserver | null = null

  function setupObserver() {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed')
            observer?.unobserve(e.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px 50px 0px' }
    )
    document.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach((el) => {
      observer!.observe(el)
    })
  }

  onMounted(() => {
    nextTick(() => {
      setupObserver()
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
  })
}
