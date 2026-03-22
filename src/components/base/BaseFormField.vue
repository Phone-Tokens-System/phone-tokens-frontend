<script setup>
defineProps({
  id: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    required: true,
  },
  hint: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div class="base-form-field">
    <label class="form-label" :for="id">
      <span class="field-label">
        {{ label }}
        <span v-if="required" class="required-mark" aria-hidden="true">*</span>
      </span>
      <slot />
    </label>
    <p v-if="hint" class="field-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.base-form-field {
  display: grid;
  gap: 6px;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.required-mark {
  color: var(--danger);
  font-weight: 700;
}

.field-hint {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.82rem;
}
</style>
