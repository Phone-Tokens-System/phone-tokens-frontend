<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BaseDataTable from '../components/base/BaseDataTable.vue';
import BaseFormField from '../components/base/BaseFormField.vue';
import BaseModal from '../components/base/BaseModal.vue';
import BaseStatusChip from '../components/base/BaseStatusChip.vue';
import SensitiveValue from '../components/base/SensitiveValue.vue';
import {
  createUserToken,
  deleteUserToken,
  freezeUserToken,
  getTokensByUser,
  unfreezeUserToken,
  updateUserTokenTTL,
} from '../lib/api';
import { sessionState } from '../lib/session';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const KNOWN_AGENT_IDS_KEY = 'pt_frontend_known_agent_ids';
const MANUAL_AGENT_ID_VALUE = '__manual_agent_id__';
const route = useRoute();

const loading = ref(false);
const creating = ref(false);
const actionKey = ref('');
const error = ref('');
const success = ref('');
const tokens = ref([]);
const deleteModalOpen = ref(false);
const deleteTarget = ref(null);
const knownAgentIds = ref(readKnownAgentIds());
const tokenNameEdited = ref(false);

function formatDateTimePart() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function suggestedManualTokenName() {
  return `Token ${formatDateTimePart()}`;
}

const createForm = reactive({
  name: suggestedManualTokenName(),
  ttlSeconds: '3600',
  agentIdChoice: '',
  sms: true,
  calls: true,
});

const manualAgentId = ref('');

const ttlDraftById = reactive({});

const deleteModalDescription = computed(() => {
  if (!deleteTarget.value) {
    return 'Подтвердите удаление.';
  }

  return `Токен "${deleteTarget.value.name || deleteTarget.value.id}" будет удален без возможности восстановления.`;
});

watch(
  () => sessionState.agentId,
  (value) => {
    const agentId = normalizeAgentId(value);
    if (agentId) {
      rememberAgentIds([agentId]);
    }
    if (!createForm.agentIdChoice && agentId) {
      createForm.agentIdChoice = agentId;
    }
  },
);

function normalizeQueryValue(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
}

function syncAgentIdFromQuery(value) {
  const queryAgentId = normalizeQueryValue(value);
  if (!queryAgentId) {
    return;
  }

  const agentId = normalizeAgentId(queryAgentId);
  if (!agentId) {
    return;
  }

  rememberAgentIds([agentId]);
  createForm.agentIdChoice = agentId;
}

watch(
  () => route.query.agent_id,
  (value) => {
    syncAgentIdFromQuery(value);
  },
  { immediate: true },
);

function setSuccess(message) {
  success.value = message;
}

function normalizeAgentId(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === ZERO_UUID) {
    return '';
  }
  return normalized;
}

function readKnownAgentIds() {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(KNOWN_AGENT_IDS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.map(normalizeAgentId).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function writeKnownAgentIds(values) {
  if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
    return;
  }

  localStorage.setItem(KNOWN_AGENT_IDS_KEY, JSON.stringify(values));
}

function rememberAgentIds(values) {
  const next = [];
  const seen = new Set();
  for (const value of [...values, ...knownAgentIds.value]) {
    const agentId = normalizeAgentId(value);
    if (!agentId || seen.has(agentId)) {
      continue;
    }
    seen.add(agentId);
    next.push(agentId);
  }

  knownAgentIds.value = next.slice(0, 12);
  writeKnownAgentIds(knownAgentIds.value);
}

const selectedAgentId = computed(() => (
  createForm.agentIdChoice === MANUAL_AGENT_ID_VALUE
    ? normalizeAgentId(manualAgentId.value)
    : normalizeAgentId(createForm.agentIdChoice)
));

const agentIdOptions = computed(() => {
  const values = [
    normalizeQueryValue(route.query.agent_id),
    sessionState.agentId,
    ...knownAgentIds.value,
    ...tokens.value.map((token) => token?.agent_id),
  ];
  const seen = new Set();
  return values
    .map(normalizeAgentId)
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    })
    .map((value) => ({ value, label: value }));
});

function markTokenNameEdited() {
  tokenNameEdited.value = true;
}

function normalizeTokenList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.tokens)) {
    return payload.tokens;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function initTokenDrafts(list) {
  for (const token of list) {
    if (!ttlDraftById[token.id]) {
      ttlDraftById[token.id] = '3600';
    }
  }
}

function tokenStatusLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'active') return 'Active';
  if (normalized === 'frozen') return 'Frozen';
  if (!normalized) return 'Unknown';
  return normalized;
}

function tokenStatusTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'active') return 'ok';
  if (normalized === 'frozen') return 'warn';
  return 'neutral';
}

function isFrozenStatus(value) {
  return String(value || '').toLowerCase() === 'frozen';
}

function buildPermissions() {
  const permissions = [];
  if (createForm.sms) permissions.push('sms');
  if (createForm.calls) permissions.push('calls');
  return permissions;
}

function validateSession() {
  const userId = sessionState.claims?.userId;
  if (!sessionState.token || !userId) {
    error.value = 'Не удалось определить пользователя из JWT.';
    return null;
  }
  return userId;
}

async function fetchTokens() {
  const userId = validateSession();
  if (!userId) return;

  loading.value = true;
  error.value = '';

  try {
    const payload = await getTokensByUser(sessionState.token, userId);
    const list = normalizeTokenList(payload);
    tokens.value = list;
    initTokenDrafts(list);
    rememberAgentIds(list.map((item) => item?.agent_id));
    if (!error.value) {
      success.value = `Загружено токенов: ${list.length}`;
    }
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось загрузить токены';
  } finally {
    loading.value = false;
  }
}

async function createToken() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  const ttlSeconds = Number(createForm.ttlSeconds);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    error.value = 'TTL должен быть положительным числом.';
    return;
  }

  creating.value = true;
  error.value = '';
  success.value = '';

  try {
    const agentId = selectedAgentId.value || ZERO_UUID;
    const created = await createUserToken(sessionState.token, {
      name: createForm.name.trim(),
      ttl_seconds: ttlSeconds,
      agent_id: agentId,
      permissions: buildPermissions(),
    });
    rememberAgentIds([agentId]);

    if (created && created.id) {
      tokens.value = [created, ...tokens.value.filter((item) => item.id !== created.id)];
      initTokenDrafts(tokens.value);
    }

    setSuccess('Токен создан.');
    tokenNameEdited.value = false;
    createForm.name = suggestedManualTokenName();
    createForm.ttlSeconds = '3600';
    await fetchTokens();
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось создать токен';
  } finally {
    creating.value = false;
  }
}

async function updateTTL(item) {
  if (!sessionState.token) return;

  const ttlSeconds = Number(ttlDraftById[item.id]);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    error.value = 'TTL для обновления должен быть положительным числом.';
    return;
  }

  actionKey.value = `ttl:${item.id}`;
  error.value = '';
  success.value = '';

  try {
    await updateUserTokenTTL(sessionState.token, item.id, ttlSeconds);
    setSuccess(`TTL для токена "${item.name || item.id}" обновлен.`);
    await fetchTokens();
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось обновить TTL';
  } finally {
    actionKey.value = '';
  }
}

async function toggleStatus(item) {
  if (!sessionState.token) return;

  const frozen = isFrozenStatus(item.status);
  actionKey.value = `status:${item.id}`;
  error.value = '';
  success.value = '';

  try {
    if (frozen) {
      await unfreezeUserToken(sessionState.token, item.id);
      setSuccess(`Токен "${item.name || item.id}" разморожен.`);
    } else {
      await freezeUserToken(sessionState.token, item.id);
      setSuccess(`Токен "${item.name || item.id}" заморожен.`);
    }
    await fetchTokens();
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось изменить статус токена';
  } finally {
    actionKey.value = '';
  }
}

function openDeleteModal(item) {
  deleteTarget.value = item;
  deleteModalOpen.value = true;
}

function closeDeleteModal() {
  if (isActionLoading('delete', deleteTarget.value?.id || '')) {
    return;
  }

  deleteModalOpen.value = false;
  deleteTarget.value = null;
}

async function confirmDeleteToken() {
  if (!sessionState.token || !deleteTarget.value) return;

  const item = deleteTarget.value;
  actionKey.value = `delete:${item.id}`;
  error.value = '';
  success.value = '';

  try {
    await deleteUserToken(sessionState.token, item.id);
    setSuccess(`Токен "${item.name || item.id}" удален.`);
    await fetchTokens();
    closeDeleteModal();
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось удалить токен';
  } finally {
    actionKey.value = '';
  }
}

async function refreshTokenRow(item) {
  if (!sessionState.token) return;

  actionKey.value = `refresh:${item.id}`;
  error.value = '';
  success.value = '';

  try {
    await fetchTokens();
    setSuccess(`Данные токена "${item.name || item.id}" обновлены.`);
  } finally {
    actionKey.value = '';
  }
}

function isActionLoading(prefix, tokenId) {
  return actionKey.value === `${prefix}:${tokenId}`;
}

const initialSessionAgentId = normalizeAgentId(sessionState.agentId);
if (!createForm.agentIdChoice && initialSessionAgentId) {
  rememberAgentIds([initialSessionAgentId]);
  createForm.agentIdChoice = initialSessionAgentId;
}

onMounted(() => {
  fetchTokens();
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <h3>Создать токен</h3>

      <form class="form" aria-label="Форма создания токена" @submit.prevent="createToken">
        <BaseFormField id="token-name" label="Название токена">
          <input
            id="token-name"
            v-model="createForm.name"
            class="input"
            type="text"
            placeholder="default token"
            @input="markTokenNameEdited"
          />
        </BaseFormField>

        <BaseFormField id="token-agent-id" label="agent_id">
          <select id="token-agent-id" v-model="createForm.agentIdChoice" class="select">
            <option value="">Без agent_id</option>
            <option v-for="option in agentIdOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
            <option :value="MANUAL_AGENT_ID_VALUE">Ввести вручную</option>
          </select>
        </BaseFormField>

        <BaseFormField
          v-if="createForm.agentIdChoice === MANUAL_AGENT_ID_VALUE"
          id="token-agent-id-manual"
          label="agent_id вручную"
        >
          <input
            id="token-agent-id-manual"
            v-model="manualAgentId"
            aria-label="Ввести agent_id вручную"
            class="input mono"
            type="text"
            placeholder="uuid"
          />
        </BaseFormField>

        <BaseFormField id="token-ttl" label="TTL (секунды)" required>
          <input id="token-ttl" v-model="createForm.ttlSeconds" class="input" type="number" min="1" step="1" required />
        </BaseFormField>

        <fieldset class="permissions">
          <legend class="form-label">Permissions</legend>
          <label class="permission-item">
            <input v-model="createForm.sms" type="checkbox" />
            sms
          </label>
          <label class="permission-item">
            <input v-model="createForm.calls" type="checkbox" />
            calls
          </label>
        </fieldset>

        <button type="submit" class="btn btn-primary" :disabled="creating" :aria-busy="creating ? 'true' : 'false'">
          {{ creating ? 'Создаем...' : 'Создать токен' }}
        </button>
      </form>
    </article>

    <article class="card">
      <div class="section-head">
        <div>
          <h3>Управление токенами</h3>
          <p class="subtitle">Обновление TTL, freeze/unfreeze, удаление.</p>
          <p class="subtitle">
            user_id:
            <SensitiveValue
              :value="sessionState.claims?.userId"
              label="user_id"
              copy-label="Copy full user_id"
            />
          </p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-primary" :disabled="loading" @click="fetchTokens">
            {{ loading ? 'Загрузка...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>
      <p v-if="success" class="success" role="status" aria-live="polite">{{ success }}</p>

      <BaseDataTable
        v-if="tokens.length"
        caption="Список токенов пользователя"
        aria-label="Список токенов пользователя"
        :min-width="920"
      >
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Token</th>
            <th scope="col">Permissions</th>
            <th scope="col">Status</th>
            <th scope="col">Expires</th>
            <th scope="col">Agent ID</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="token in tokens" :key="token.id">
            <td>{{ token.name || '-' }}</td>
            <td>
              <SensitiveValue
                :value="token.token"
                label="token"
                :copy-label="`Copy full token ${token.name || token.id}`"
              />
            </td>
            <td>{{ Array.isArray(token.permissions) ? token.permissions.join(', ') : '-' }}</td>
            <td>
              <BaseStatusChip
                :label="tokenStatusLabel(token.status)"
                :tone="tokenStatusTone(token.status)"
                :aria-label="`Token status: ${tokenStatusLabel(token.status)}`"
              />
            </td>
            <td class="mono">{{ token.expires_at || '-' }}</td>
            <td>
              <SensitiveValue
                :value="token.agent_id"
                label="agent_id"
                :copy-label="`Copy full agent_id ${token.name || token.id}`"
              />
            </td>
            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  :disabled="isActionLoading('refresh', token.id)"
                  :aria-label="`Refresh token ${token.name || token.id}`"
                  @click="refreshTokenRow(token)"
                >
                  {{ isActionLoading('refresh', token.id) ? '...' : 'Refresh' }}
                </button>

                <div class="ttl-inline">
                  <input
                    v-model="ttlDraftById[token.id]"
                    class="input input-inline"
                    type="number"
                    min="1"
                    step="1"
                    :aria-label="`New TTL for token ${token.name || token.id}`"
                  />
                  <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    :disabled="isActionLoading('ttl', token.id)"
                    :aria-label="`Update TTL for token ${token.name || token.id}`"
                    @click="updateTTL(token)"
                  >
                    {{ isActionLoading('ttl', token.id) ? '...' : 'TTL' }}
                  </button>
                </div>

                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  :disabled="isActionLoading('status', token.id)"
                  :aria-label="`${isFrozenStatus(token.status) ? 'Unfreeze' : 'Freeze'} token ${token.name || token.id}`"
                  @click="toggleStatus(token)"
                >
                  {{ isActionLoading('status', token.id) ? '...' : isFrozenStatus(token.status) ? 'Unfreeze' : 'Freeze' }}
                </button>

                <button
                  type="button"
                  class="btn btn-danger btn-small"
                  :disabled="isActionLoading('delete', token.id)"
                  :aria-label="`Delete token ${token.name || token.id}`"
                  @click="openDeleteModal(token)"
                >
                  {{ isActionLoading('delete', token.id) ? '...' : 'Delete' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </BaseDataTable>

      <p v-else-if="!loading" class="subtitle empty-state">
        Токенов пока нет.
      </p>

      <BaseModal
        v-model="deleteModalOpen"
        title="Удаление токена"
        :description="deleteModalDescription"
        confirm-label="Удалить"
        cancel-label="Отмена"
        :danger="true"
        :busy="isActionLoading('delete', deleteTarget?.id || '')"
        @confirm="confirmDeleteToken"
        @cancel="closeDeleteModal"
      />
    </article>
  </section>
</template>

<style scoped>
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
  color: var(--text-main);
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 360px;
}

.ttl-inline {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.input-inline {
  width: 96px;
  padding: 9px 10px;
}

.btn-small {
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 0.85rem;
  min-width: 72px;
}

@media (max-width: 900px) {
  .row-actions {
    min-width: 220px;
  }
}
</style>
