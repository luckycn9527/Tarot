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
    <path d="M2 6h4" />
    <path d="M2 10h4" />
    <path d="M2 14h4" />
    <path d="M2 18h4" />
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M15 2v20" />
    <path d="M15 7h5" />
    <path d="M15 12h5" />
    <path d="M15 17h5" />
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
