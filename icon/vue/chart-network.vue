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
    <path d="m13.11 7.664 1.78 2.672" />
    <path d="m14.162 12.788-3.324 1.424" />
    <path d="m20 4-6.06 1.515" />
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <circle cx="12" cy="6" r="2" />
    <circle cx="16" cy="12" r="2" />
    <circle cx="9" cy="15" r="2" />
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
