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
    <path d="M16 12h6" />
    <path d="M8 12H2" />
    <path d="M12 2v2" />
    <path d="M12 8v2" />
    <path d="M12 14v2" />
    <path d="M12 20v2" />
    <path d="m19 15 3-3-3-3" />
    <path d="m5 9-3 3 3 3" />
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
