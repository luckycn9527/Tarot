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
    <path d="M9 5v4" />
    <rect width="4" height="6" x="7" y="9" rx="1" />
    <path d="M9 15v2" />
    <path d="M17 3v2" />
    <rect width="4" height="8" x="15" y="5" rx="1" />
    <path d="M17 13v3" />
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
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
