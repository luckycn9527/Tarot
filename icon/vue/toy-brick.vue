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
    <rect width="18" height="12" x="3" y="8" rx="1" />
    <path d="M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3" />
    <path d="M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3" />
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
