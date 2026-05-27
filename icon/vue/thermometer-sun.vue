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
    <path d="M12 2v2" />
    <path d="M12 8a4 4 0 0 0-1.645 7.647" />
    <path d="M2 12h2" />
    <path d="M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m6.34 17.66-1.41 1.41" />
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
