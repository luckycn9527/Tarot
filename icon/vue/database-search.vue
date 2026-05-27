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
    <path d="M21 11.693V5" />
    <path d="m22 22-1.875-1.875" />
    <path d="M3 12a9 3 0 0 0 8.697 2.998" />
    <path d="M3 5v14a9 3 0 0 0 9.28 2.999" />
    <circle cx="18" cy="18" r="3" />
    <ellipse cx="12" cy="5" rx="9" ry="3" />
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
