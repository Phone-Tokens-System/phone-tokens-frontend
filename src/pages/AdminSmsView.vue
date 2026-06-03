<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import BaseDataTable from '../components/base/BaseDataTable.vue';
import BaseStatusChip from '../components/base/BaseStatusChip.vue';
import SensitiveValue from '../components/base/SensitiveValue.vue';
import { getAdminSmsLogs, refreshAdminSmsFromProvider } from '../lib/api';
import { sessionState } from '../lib/session';

const loading = ref(false);
const syncing = ref(false);
const error = ref('');
const success = ref('');
const smsLogs = ref([]);

const filters = reactive({
  status: 'all',
  query: '',
});

function normalizeSmsList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function toTimestamp(value) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber * 1000;
  }

  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const timestamp = toTimestamp(value);
  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toLocaleString();
  }

  return String(value);
}

function statusLabel(value) {
  const status = Number(value);
  if (status === 1) return 'Delivered';
  if (status === 2) return 'Not Delivered';
  if (status === 0) return 'Queued';
  if (status === 8) return 'In Moderation';
  if (status === 4) return 'Pending';
  if (status === 6) return 'Rejected';
  return String(value ?? '-');
}

function statusTone(value) {
  const status = Number(value);
  if (status === 1) return 'ok';
  if (status === 0 || status === 4 || status === 8) return 'warn';
  if (status === 2 || status === 6) return 'error';
  return 'neutral';
}

const filteredSmsLogs = computed(() => {
  const query = filters.query.trim().toLowerCase();

  return [...smsLogs.value]
    .sort((a, b) => toTimestamp(b.date_created) - toTimestamp(a.date_created))
    .filter((item) => {
      if (filters.status !== 'all' && String(item.status) !== filters.status) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item.external_id,
        item.id,
        item.token,
        item.from,
        item.service_name,
        item.service_id,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
});

async function fetchSmsLogs() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const payload = await getAdminSmsLogs(sessionState.token);
    smsLogs.value = normalizeSmsList(payload);
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось загрузить SMS';
  } finally {
    loading.value = false;
  }
}

async function syncFromProvider() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  syncing.value = true;
  error.value = '';
  success.value = '';

  try {
    await refreshAdminSmsFromProvider(sessionState.token);
    await fetchSmsLogs();
    success.value = 'SMS синхронизированы с провайдером.';
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось получить SMS от провайдера';
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  fetchSmsLogs();
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <div class="section-head">
        <div>
          <h3>SMS Monitor</h3>
          <p class="subtitle">Показано: {{ filteredSmsLogs.length }} из {{ smsLogs.length }}</p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-secondary" :disabled="syncing" @click="syncFromProvider">
            {{ syncing ? 'Синхронизация...' : 'Синхронизировать' }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="fetchSmsLogs">
            {{ loading ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <div class="filter-grid">
        <label class="form-label">
          Статус
          <select v-model="filters.status" class="select">
            <option value="all">Все</option>
            <option value="1">Delivered</option>
            <option value="0">Queued</option>
            <option value="4">Pending</option>
            <option value="8">In Moderation</option>
            <option value="2">Not Delivered</option>
            <option value="6">Rejected</option>
          </select>
        </label>

        <label class="form-label">
          Поиск
          <input
            v-model="filters.query"
            class="input"
            type="text"
            placeholder="service / token / id"
          />
        </label>
      </div>

      <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>
      <p v-if="success" class="success" role="status" aria-live="polite">{{ success }}</p>

      <BaseDataTable
        v-if="filteredSmsLogs.length"
        caption="Admin SMS"
        aria-label="Admin SMS"
        :min-width="1040"
      >
        <thead>
          <tr>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Status</th>
            <th scope="col">Cost</th>
            <th scope="col">Created</th>
            <th scope="col">Sent</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in filteredSmsLogs" :key="`${item.external_id || item.id || index}-${index}`">
            <td class="sms-party-cell">
              <div class="party-title">{{ item.service_name || '-' }}</div>
              <div class="party-detail mono">from: {{ item.from || '-' }}</div>
              <SensitiveValue
                :value="item.service_id"
                label="service_id"
                :copy-label="`Copy full SMS service_id ${item.external_id || item.id || index}`"
              />
            </td>
            <td class="sms-party-cell">
              <div class="party-title">User token</div>
              <SensitiveValue
                :value="item.token"
                label="token"
                :copy-label="`Copy full SMS token ${item.external_id || item.id || index}`"
              />
            </td>
            <td>
              <BaseStatusChip
                :label="statusLabel(item.status)"
                :tone="statusTone(item.status)"
                :aria-label="`SMS status: ${statusLabel(item.status)}`"
              />
            </td>
            <td>{{ Number(item.cost || 0).toFixed(2) }}</td>
            <td class="mono">{{ formatDate(item.date_created) }}</td>
            <td class="mono">{{ formatDate(item.date_sent) }}</td>
          </tr>
        </tbody>
      </BaseDataTable>

      <p v-else-if="!loading" class="subtitle empty-state">SMS логи пока пустые.</p>
    </article>
  </section>
</template>

<style scoped>
.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.sms-party-cell {
  min-width: 220px;
}

.party-title {
  font-weight: 700;
  color: var(--text-main);
}

.party-detail {
  margin: 3px 0 8px;
  color: var(--text-dim);
}

@media (max-width: 760px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
