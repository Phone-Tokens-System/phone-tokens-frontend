<script setup>
import { computed, reactive, ref } from 'vue';
import BaseFormField from '../components/base/BaseFormField.vue';
import SensitiveValue from '../components/base/SensitiveValue.vue';
import { completeSso } from '../lib/api';
import { maskSensitiveValue } from '../lib/sensitive';
import { sessionState } from '../lib/session';
import { useRoute } from 'vue-router';

const route = useRoute();

const submitting = ref(false);
const error = ref('');

function normalizeQueryValue(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
}

function formatDatePart() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function suggestedSsoTokenName(agentId) {
  return `SSO ${maskSensitiveValue(agentId)} ${formatDatePart()}`;
}

const agentId = computed(() => normalizeQueryValue(route.query.agent_id));
const redirectUri = computed(() => normalizeQueryValue(route.query.redirect_uri));
const state = computed(() => normalizeQueryValue(route.query.state));
const hasRequiredQuery = computed(() => Boolean(agentId.value && redirectUri.value));

const form = reactive({
  tokenName: suggestedSsoTokenName(agentId.value),
  sms: true,
  calls: false,
  ttlDays: 365,
});

const permissions = computed(() => {
  const values = [];
  if (form.sms) values.push('sms');
  if (form.calls) values.push('calls');
  return values;
});

async function submitSso() {
  if (!hasRequiredQuery.value) {
    error.value = 'agent_id и redirect_uri обязательны для SSO.';
    return;
  }

  if (!permissions.value.length) {
    error.value = 'Выберите хотя бы одно разрешение.';
    return;
  }

  submitting.value = true;
  error.value = '';

  try {
    const response = await completeSso(sessionState.token, {
      agent_id: agentId.value,
      redirect_uri: redirectUri.value,
      state: state.value,
      token_name: form.tokenName.trim() || suggestedSsoTokenName(agentId.value),
      permissions: permissions.value,
      ttl_days: Number(form.ttlDays) || 365,
    });

    const redirectUrl = String(response?.redirect_url || '').trim();
    if (!redirectUrl) {
      throw new Error('Backend не вернул redirect_url.');
    }

    globalThis.location.assign(redirectUrl);
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось завершить SSO.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <section class="panel sso-panel">
      <h1 class="title">SSO подключение</h1>
      <p class="subtitle">Подтвердите выдачу токена внешнему сервису.</p>

      <p v-if="!hasRequiredQuery" class="error" role="alert">
        agent_id и redirect_uri обязательны для SSO.
      </p>

      <form v-else class="form" aria-label="Подтверждение SSO" @submit.prevent="submitSso">
        <dl class="sso-details">
          <dt>agent_id</dt>
          <dd>
            <SensitiveValue :value="agentId" label="agent_id" copy-label="Copy full SSO agent_id" />
          </dd>

          <dt>redirect_uri</dt>
          <dd class="redirect-value">{{ redirectUri }}</dd>

          <dt>state</dt>
          <dd>
            <SensitiveValue :value="state" label="state" copy-label="Copy full SSO state" />
          </dd>
        </dl>

        <BaseFormField id="sso-token-name" label="Название токена" required>
          <input id="sso-token-name" v-model="form.tokenName" class="input" type="text" required />
        </BaseFormField>

        <BaseFormField id="sso-ttl-days" label="TTL (дней)" required>
          <input id="sso-ttl-days" v-model="form.ttlDays" class="input" type="number" min="1" step="1" required />
        </BaseFormField>

        <fieldset class="permissions">
          <legend class="form-label">Permissions</legend>
          <label class="permission-item">
            <input v-model="form.sms" type="checkbox" />
            sms
          </label>
          <label class="permission-item">
            <input v-model="form.calls" type="checkbox" />
            calls
          </label>
        </fieldset>

        <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>

        <button type="submit" class="btn btn-primary" :disabled="submitting" :aria-busy="submitting ? 'true' : 'false'">
          {{ submitting ? 'Подтверждаем...' : 'Подтвердить и вернуться' }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.sso-panel {
  width: min(680px, 100%);
}

.sso-details {
  display: grid;
  grid-template-columns: minmax(110px, 150px) 1fr;
  gap: 10px 14px;
  margin: 0;
}

.sso-details dt {
  color: var(--text-dim);
  font-weight: 650;
}

.sso-details dd {
  margin: 0;
  min-width: 0;
}

.redirect-value {
  overflow-wrap: anywhere;
}

.permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
  margin: 0;
  border: 0;
  padding: 0;
}

.permission-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
