<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
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

const loading = ref(false);
const creating = ref(false);
const actionKey = ref('');
const error = ref('');
const success = ref('');
const tokens = ref([]);

const createForm = reactive({
  name: '',
  ttlSeconds: '3600',
  agentId: sessionState.agentId || ZERO_UUID,
  sms: true,
  calls: true,
});

const ttlDraftById = reactive({});

watch(
  () => sessionState.agentId,
  (value) => {
    if (!createForm.agentId) {
      createForm.agentId = value || '';
    }
  },
);

function setSuccess(message) {
  success.value = message;
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

function maskToken(value) {
  if (!value || value.length < 14) {
    return value || '-';
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
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
  if (normalized === 'active') return 'status-chip--ok';
  if (normalized === 'frozen') return 'status-chip--warn';
  return 'status-chip--neutral';
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
    const created = await createUserToken(sessionState.token, {
      name: createForm.name.trim(),
      ttl_seconds: ttlSeconds,
      agent_id: createForm.agentId.trim() || ZERO_UUID,
      permissions: buildPermissions(),
    });

    if (created && created.id) {
      tokens.value = [created, ...tokens.value.filter((item) => item.id !== created.id)];
      initTokenDrafts(tokens.value);
    }

    setSuccess('Токен создан.');
    createForm.name = '';
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

async function removeToken(item) {
  if (!sessionState.token) return;

  const confirmed = window.confirm(`Удалить токен "${item.name || item.id}"?`);
  if (!confirmed) return;

  actionKey.value = `delete:${item.id}`;
  error.value = '';
  success.value = '';

  try {
    await deleteUserToken(sessionState.token, item.id);
    setSuccess(`Токен "${item.name || item.id}" удален.`);
    await fetchTokens();
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось удалить токен';
  } finally {
    actionKey.value = '';
  }
}

async function copyToken(item) {
  if (!item.token) return;
  await navigator.clipboard.writeText(item.token);
  setSuccess(`Токен "${item.name || item.id}" скопирован.`);
}

function isActionLoading(prefix, tokenId) {
  return actionKey.value === `${prefix}:${tokenId}`;
}

onMounted(() => {
  fetchTokens();
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <h3>Создать токен</h3>
      <p class="subtitle">Создание через `POST /api/v1/tokens`.</p>

      <form class="form" @submit.prevent="createToken">
        <label class="form-label">
          Название токена
          <input v-model="createForm.name" class="input" type="text" placeholder="default token" />
        </label>

        <label class="form-label">
          agent_id
          <input v-model="createForm.agentId" class="input mono" type="text" placeholder="uuid (optional)" />
        </label>

        <label class="form-label">
          TTL (секунды)
          <input v-model="createForm.ttlSeconds" class="input" type="number" min="1" step="1" required />
        </label>

        <div class="permissions">
          <span class="form-label">Permissions</span>
          <label class="permission-item">
            <input v-model="createForm.sms" type="checkbox" />
            sms
          </label>
          <label class="permission-item">
            <input v-model="createForm.calls" type="checkbox" />
            calls
          </label>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="creating">
          {{ creating ? 'Создаем...' : 'Создать токен' }}
        </button>
      </form>
    </article>

    <article class="card">
      <div class="section-head">
        <div>
          <h3>Управление токенами</h3>
          <p class="subtitle">Обновление TTL, freeze/unfreeze, удаление.</p>
          <p class="subtitle mono">user_id: {{ sessionState.claims?.userId || '-' }}</p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-primary" :disabled="loading" @click="fetchTokens">
            {{ loading ? 'Загрузка...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>

      <div v-if="tokens.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Token</th>
              <th>Permissions</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Agent ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="token in tokens" :key="token.id">
              <td>{{ token.name || '-' }}</td>
              <td class="mono">{{ maskToken(token.token) }}</td>
              <td>{{ Array.isArray(token.permissions) ? token.permissions.join(', ') : '-' }}</td>
              <td>
                <span class="status-chip" :class="tokenStatusTone(token.status)">
                  {{ tokenStatusLabel(token.status) }}
                </span>
              </td>
              <td class="mono">{{ token.expires_at || '-' }}</td>
              <td class="mono">{{ token.agent_id || '-' }}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="btn btn-secondary btn-small" @click="copyToken(token)">
                    Copy
                  </button>

                  <div class="ttl-inline">
                    <input
                      v-model="ttlDraftById[token.id]"
                      class="input input-inline"
                      type="number"
                      min="1"
                      step="1"
                    />
                    <button
                      type="button"
                      class="btn btn-secondary btn-small"
                      :disabled="isActionLoading('ttl', token.id)"
                      @click="updateTTL(token)"
                    >
                      {{ isActionLoading('ttl', token.id) ? '...' : 'TTL' }}
                    </button>
                  </div>

                  <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    :disabled="isActionLoading('status', token.id)"
                    @click="toggleStatus(token)"
                  >
                    {{ isActionLoading('status', token.id) ? '...' : isFrozenStatus(token.status) ? 'Unfreeze' : 'Freeze' }}
                  </button>

                  <button
                    type="button"
                    class="btn btn-danger btn-small"
                    :disabled="isActionLoading('delete', token.id)"
                    @click="removeToken(token)"
                  >
                    {{ isActionLoading('delete', token.id) ? '...' : 'Delete' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else-if="!loading" class="subtitle empty-state">
        Токенов пока нет.
      </p>
    </article>
  </section>
</template>

<style scoped>
.permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
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
  min-width: 260px;
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
