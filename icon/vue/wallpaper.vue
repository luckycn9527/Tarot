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
    <path d="M12 17v4" />
    <path d="M8 21h8" />
    <path d="m9 17 6.1-6.1a2 2 0 0 1 2.81.01L22 15" />
    <circle cx="8" cy="9" r="2" />
    <rect x="2" y="3" width="20" height="14" rx="2" />
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
