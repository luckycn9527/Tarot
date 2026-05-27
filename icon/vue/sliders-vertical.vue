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
    <path d="M10 8h4" />
    <path d="M12 21v-9" />
    <path d="M12 8V3" />
    <path d="M17 16h4" />
    <path d="M19 12V3" />
    <path d="M19 21v-5" />
    <path d="M3 14h4" />
    <path d="M5 10V3" />
    <path d="M5 21v-7" />
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
