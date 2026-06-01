<script setup>
import { computed, ref } from 'vue';
import { copySensitiveValue, maskSensitiveValue } from '../../lib/sensitive';

const props = defineProps({
  value: {
    type: [String, Number],
    default: '',
  },
  label: {
    type: String,
    default: 'value',
  },
  copyLabel: {
    type: String,
    default: '',
  },
  emptyLabel: {
    type: String,
    default: '-',
  },
});

const copied = ref(false);
const copyError = ref(false);

const normalizedValue = computed(() => String(props.value || '').trim());
const maskedValue = computed(() => (normalizedValue.value ? maskSensitiveValue(normalizedValue.value) : props.emptyLabel));
const buttonLabel = computed(() => props.copyLabel || `Copy full ${props.label}`);

async function copyValue() {
  if (!normalizedValue.value) {
    return;
  }

  copyError.value = false;
  try {
    await copySensitiveValue(normalizedValue.value);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1300);
  } catch {
    copyError.value = true;
  }
}
</script>

<template>
  <span class="sensitive-value">
    <span class="sensitive-text mono">{{ maskedValue }}</span>
    <button
      v-if="normalizedValue"
      type="button"
      class="sensitive-copy"
      :aria-label="buttonLabel"
      @click="copyValue"
    >
      {{ copied ? 'Copied' : 'Copy' }}
    </button>
    <span v-if="copyError" class="sr-only" role="alert">Не удалось скопировать значение</span>
  </span>
</template>

<style scoped>
.sensitive-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.sensitive-text {
  overflow-wrap: anywhere;
}

.sensitive-copy {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--text-main);
  padding: 5px 8px;
  font-size: 0.78rem;
  font-weight: 650;
}
</style>
