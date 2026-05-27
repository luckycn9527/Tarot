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
    <path d="M10 22a2 2 0 0 1-2-2" />
    <path d="M14 2a2 2 0 0 1 2 2" />
    <path d="M16 22h-2" />
    <path d="M2 10V8" />
    <path d="M2 4a2 2 0 0 1 2-2" />
    <path d="M20 8a2 2 0 0 1 2 2" />
    <path d="M22 14v2" />
    <path d="M22 20a2 2 0 0 1-2 2" />
    <path d="M4 16a2 2 0 0 1-2-2" />
    <path d="M8 10a2 2 0 0 1 2-2h5a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2H9a1 1 0 0 1-1-1z" />
    <path d="M8 2h2" />
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
