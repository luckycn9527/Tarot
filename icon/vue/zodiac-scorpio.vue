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
    <path d="M10 19V5.5a1 1 0 0 1 5 0V17a2 2 0 0 0 2 2h5l-3-3" />
    <path d="m22 19-3 3" />
    <path d="M5 19V5.5a1 1 0 0 1 5 0" />
    <path d="M5 5.5A2.5 2.5 0 0 0 2.5 3" />
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
