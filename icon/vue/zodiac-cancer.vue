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
    <path d="M21 14.5A9 6.5 0 0 1 5.5 19" />
    <path d="M3 9.5A9 6.5 0 0 1 18.5 5" />
    <circle cx="17.5" cy="14.5" r="3.5" />
    <circle cx="6.5" cy="9.5" r="3.5" />
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
