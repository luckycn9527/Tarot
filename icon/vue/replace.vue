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
    <path d="M14 4a1 1 0 0 1 1-1" />
    <path d="M15 10a1 1 0 0 1-1-1" />
    <path d="M21 4a1 1 0 0 0-1-1" />
    <path d="M21 9a1 1 0 0 1-1 1" />
    <path d="m3 7 3 3 3-3" />
    <path d="M6 10V5a2 2 0 0 1 2-2h2" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
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
