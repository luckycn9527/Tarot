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
    <path d="M12 19v3" />
    <path d="M12 2v3" />
    <path d="M18.89 13.24a7 7 0 0 0-8.13-8.13" />
    <path d="M19 12h3" />
    <path d="M2 12h3" />
    <path d="m2 2 20 20" />
    <path d="M7.05 7.05a7 7 0 0 0 9.9 9.9" />
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
