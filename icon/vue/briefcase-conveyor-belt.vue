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
    <path d="M10 20v2" />
    <path d="M14 20v2" />
    <path d="M18 20v2" />
    <path d="M21 20H3" />
    <path d="M6 20v2" />
    <path d="M8 16V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12" />
    <rect x="4" y="6" width="16" height="10" rx="2" />
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
