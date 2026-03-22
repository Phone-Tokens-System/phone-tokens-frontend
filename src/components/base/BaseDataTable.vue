<script setup>
defineProps({
  caption: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  minWidth: {
    type: Number,
    default: 760,
  },
});
</script>

<template>
  <div class="table-wrap" role="region" :aria-label="ariaLabel || caption" tabindex="0">
    <table :style="{ minWidth: `${minWidth}px` }">
      <caption v-if="caption" class="sr-only">{{ caption }}</caption>
      <slot />
    </table>
  </div>
</template>
