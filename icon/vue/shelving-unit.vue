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
    <path d="M12 12V9a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
    <path d="M16 20v-3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" />
    <path d="M20 22V2" />
    <path d="M4 12h16" />
    <path d="M4 20h16" />
    <path d="M4 2v20" />
    <path d="M4 4h16" />
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
