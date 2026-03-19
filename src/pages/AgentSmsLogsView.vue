<script setup>
import { onMounted, ref } from 'vue';
import { getSmsLogsByAgent } from '../lib/api';
import { sessionState } from '../lib/session';

const loading = ref(false);
const error = ref('');
const smsLogs = ref([]);

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return new Date(asNumber * 1000).toLocaleString();
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
  if (status === 1) return 'status-chip--ok';
  if (status === 0 || status === 4 || status === 8) return 'status-chip--warn';
  if (status === 2 || status === 6) return 'status-chip--error';
  return 'status-chip--neutral';
}

async function fetchSmsLogs() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!sessionState.agentId) {
    error.value = 'Укажите agent_id в левом блоке Agent Context.';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const payload = await getSmsLogsByAgent(sessionState.token, sessionState.agentId);
    smsLogs.value = Array.isArray(payload) ? payload : [];
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось загрузить SMS logs';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (sessionState.agentId) {
    fetchSmsLogs();
  }
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <div class="section-head">
        <div>
          <h3>SMS Logs</h3>
          <p class="subtitle">Запрос к `GET /api/v1/sms/agents/{agentID}`.</p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-primary" :disabled="loading" @click="fetchSmsLogs">
            {{ loading ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="smsLogs.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>From</th>
              <th>Token</th>
              <th>Text</th>
              <th>Status</th>
              <th>Cost</th>
              <th>Created</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in smsLogs" :key="`${item.external_id || index}-${index}`">
              <td>{{ item.service_name || item.serviceName || '-' }}</td>
              <td class="mono">{{ item.from || '-' }}</td>
              <td class="mono">{{ item.token || '-' }}</td>
              <td>{{ item.text || '-' }}</td>
              <td>
                <span class="status-chip" :class="statusTone(item.status)">
                  {{ statusLabel(item.status) }}
                </span>
              </td>
              <td>{{ Number(item.cost || 0).toFixed(2) }}</td>
              <td class="mono">{{ formatDate(item.date_created) }}</td>
              <td class="mono">{{ formatDate(item.date_sent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else-if="!loading" class="subtitle empty-state">
        Логи пока пустые или не найдены для указанного agent_id.
      </p>
    </article>
  </section>
</template>
