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
    <path d="m4 4 2.5 2.5" />
    <path d="M13.5 6.5a4.95 4.95 0 0 0-7 7" />
    <path d="M15 5 5 15" />
    <path d="M14 17v.01" />
    <path d="M10 16v.01" />
    <path d="M13 13v.01" />
    <path d="M16 10v.01" />
    <path d="M11 20v.01" />
    <path d="M17 14v.01" />
    <path d="M20 11v.01" />
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
