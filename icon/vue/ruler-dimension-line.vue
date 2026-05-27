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
    <path d="M10 15v-3" />
    <path d="M14 15v-3" />
    <path d="M18 15v-3" />
    <path d="M2 8V4" />
    <path d="M22 6H2" />
    <path d="M22 8V4" />
    <path d="M6 15v-3" />
    <rect x="2" y="12" width="20" height="8" rx="2" />
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
