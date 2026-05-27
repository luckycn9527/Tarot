<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="fill"
    :stroke="color"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14" />
    <path d="M18 8c0-2.5-2-2.5-2-5" />
    <path d="M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M22 8c0-2.5-2-2.5-2-5" />
    <path d="M7 12v4" />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [String, Number], default: 24 },
  color: { type: String, default: 'currentColor' },
  fill: { type: String, default: 'none' },
  strokeWidth: { type: [String, Number], default: 2 },
});
</script>
