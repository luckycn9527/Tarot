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
    <path d="M7.001 15.085A1.5 1.5 0 0 1 9 16.5" />
    <circle cx="18.5" cy="8.5" r="3.5" />
    <circle cx="7.5" cy="16.5" r="5.5" />
    <circle cx="7.5" cy="4.5" r="2.5" />
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
