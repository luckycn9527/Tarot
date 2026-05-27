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
    <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381" />
    <path d="m16 16 6-6" />
    <path d="m21.5 10.5-8-8" />
    <path d="m8 8 6-6" />
    <path d="m8.5 7.5 8 8" />
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
