<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Подтверждение',
  },
  description: {
    type: String,
    default: '',
  },
  confirmLabel: {
    type: String,
    default: 'Подтвердить',
  },
  cancelLabel: {
    type: String,
    default: 'Отмена',
  },
  danger: {
    type: Boolean,
    default: false,
  },
  busy: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const dialogRef = ref(null);
const cancelRef = ref(null);
const previousActive = ref(null);
const titleId = `base-modal-title-${Math.random().toString(36).slice(2, 10)}`;

function close() {
  if (props.busy) return;
  emit('cancel');
  emit('update:modelValue', false);
}

function confirm() {
  if (props.busy) return;
  emit('confirm');
}

function onKeydown(event) {
  if (!props.modelValue) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key !== 'Tab') return;

  const root = dialogRef.value;
  if (!root) return;

  const focusable = root.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      previousActive.value = document.activeElement;
      await nextTick();
      cancelRef.value?.focus();
      window.addEventListener('keydown', onKeydown);
      return;
    }

    window.removeEventListener('keydown', onKeydown);
    previousActive.value?.focus?.();
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <teleport to="body">
    <div v-if="modelValue" class="modal-backdrop" @mousedown.self="close">
      <section ref="dialogRef" class="modal-panel" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <h3 :id="titleId" class="modal-title">{{ title }}</h3>
        <p v-if="description" class="modal-description">{{ description }}</p>
        <slot />

        <div class="modal-actions">
          <button
            ref="cancelRef"
            type="button"
            class="btn btn-secondary"
            :disabled="busy"
            @click="close"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="btn"
            :class="danger ? 'btn-danger' : 'btn-primary'"
            :disabled="busy"
            @click="confirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </section>
    </div>
  </teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(17, 24, 39, 0.38);
  backdrop-filter: blur(1.5px);
  z-index: 1000;
}

.modal-panel {
  width: min(520px, 100%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 22px;
  box-shadow: var(--shadow);
}

.modal-title {
  margin: 0;
  font-size: 1.5rem;
}

.modal-description {
  margin: 10px 0 0;
  color: var(--text-dim);
}

.modal-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .modal-actions {
    justify-content: stretch;
  }

  .modal-actions .btn {
    width: 100%;
  }
}
</style>
