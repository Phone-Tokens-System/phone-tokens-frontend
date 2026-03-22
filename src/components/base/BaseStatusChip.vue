<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  tone: {
    type: String,
    default: 'neutral',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
});

const toneClass = computed(() => {
  if (props.tone === 'ok') return 'status-chip--ok';
  if (props.tone === 'warn') return 'status-chip--warn';
  if (props.tone === 'error') return 'status-chip--error';
  return 'status-chip--neutral';
});
</script>

<template>
  <span class="status-chip" :class="toneClass" :aria-label="ariaLabel || label">
    {{ label }}
  </span>
</template>
