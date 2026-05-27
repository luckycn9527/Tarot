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
    <path d="M10 3h.01" />
    <path d="M14 2h.01" />
    <path d="m2 9 20-5" />
    <path d="M12 12V6.5" />
    <rect width="16" height="10" x="4" y="12" rx="3" />
    <path d="M9 12v5" />
    <path d="M15 12v5" />
    <path d="M4 17h16" />
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
