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
    <path d="M20 11v6" />
    <path d="M20 13h2" />
    <path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 2.072.578" />
    <circle cx="10" cy="7" r="4" />
    <circle cx="20" cy="19" r="2" />
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
