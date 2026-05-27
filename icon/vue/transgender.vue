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
    <path d="M12 16v6" />
    <path d="M14 20h-4" />
    <path d="M18 2h4v4" />
    <path d="m2 2 7.17 7.17" />
    <path d="M2 5.355V2h3.357" />
    <path d="m22 2-7.17 7.17" />
    <path d="M8 5 5 8" />
    <circle cx="12" cy="12" r="4" />
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
