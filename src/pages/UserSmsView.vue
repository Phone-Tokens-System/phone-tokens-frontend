<script setup>
import { computed, onMounted, ref } from 'vue';
import BaseDataTable from '../components/base/BaseDataTable.vue';
import BaseStatusChip from '../components/base/BaseStatusChip.vue';
import SensitiveValue from '../components/base/SensitiveValue.vue';
import { getSmsLogsByToken, getTokensByUser } from '../lib/api';
import { sessionState } from '../lib/session';

const loading = ref(false);
const error = ref('');
const success = ref('');
const rows = ref([]);

function normalizeList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.tokens)) {
    return payload.tokens;
  }

  return [];
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }

  return new Date(numeric * 1000).toLocaleString();
}

function smsStatusLabel(value) {
  const numeric = Number(value);
  if (numeric === 1) return 'Delivered';
  if (numeric === 2) return 'Queued';
  if (numeric === 3) return 'Pending';
  if (numeric === 4) return 'In Moderation';
  if (numeric === 5) return 'Not Delivered';
  if (numeric === 6) return 'Rejected';
  return String(value ?? '-');
}

function smsStatusTone(value) {
  const numeric = Number(value);
  if (numeric === 1) return 'ok';
  if (numeric === 2 || numeric === 3 || numeric === 4) return 'warn';
  if (numeric === 5 || numeric === 6) return 'error';
  return 'neutral';
}

function getSmsId(item, fallbackIndex) {
  return String(item?.id ?? item?.Id ?? item?.external_id ?? item?.ExternalId ?? fallbackIndex);
}

function normalizeSms(item, tokenItem, index) {
  return {
    id: getSmsId(item, index),
    externalId: String(item?.external_id ?? item?.externalId ?? item?.ExternalId ?? '').trim(),
    tokenName: String(tokenItem?.name || tokenItem?.Name || tokenItem?.id || tokenItem?.ID || '').trim(),
    token: String(item?.token || item?.Token || tokenItem?.token || tokenItem?.Token || '').trim(),
    agentId: String(tokenItem?.agent_id || tokenItem?.agentId || tokenItem?.AgentId || '').trim(),
    serviceName: String(item?.service_name || item?.serviceName || item?.ServiceName || '').trim(),
    from: String(item?.from || item?.From || item?.from_number || item?.fromNumber || '').trim(),
    text: String(item?.text || item?.Text || '').trim(),
    status: item?.status ?? item?.Status ?? '',
    extendedStatus: String(item?.extended_status || item?.extend_status || item?.ExtendStatus || '').trim(),
    cost: item?.cost ?? item?.Cost ?? '',
    createdAt: normalizeTimestamp(item?.date_created ?? item?.dateCreated ?? item?.DateCreated),
    sentAt: normalizeTimestamp(item?.date_sent ?? item?.dateSent ?? item?.DateSent),
  };
}

const sortedRows = computed(() => [...rows.value].sort((a, b) => {
  const aKey = a.sentAt || a.createdAt || '';
  const bKey = b.sentAt || b.createdAt || '';
  return bKey.localeCompare(aKey);
}));

async function fetchUserSms() {
  const userId = sessionState.claims?.userId;
  if (!sessionState.token || !userId) {
    error.value = 'Не удалось определить пользователя из JWT.';
    return;
  }

  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    const tokenPayload = await getTokensByUser(sessionState.token, userId);
    const tokens = normalizeList(tokenPayload)
      .map((item) => ({
        ...item,
        token: String(item?.token || item?.Token || '').trim(),
      }))
      .filter((item) => item.token);

    const smsPayloads = await Promise.all(tokens.map(async (tokenItem) => {
      const payload = await getSmsLogsByToken(sessionState.token, tokenItem.token);
      return normalizeList(payload).map((sms, index) => normalizeSms(sms, tokenItem, index));
    }));

    rows.value = smsPayloads.flat();
    success.value = `Показано SMS: ${rows.value.length}`;
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось загрузить SMS пользователя';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchUserSms();
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <div class="section-head">
        <div>
          <h3>Мои SMS</h3>
          <p class="subtitle">SMS, отправленные агентами на ваши phone tokens.</p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-primary" :disabled="loading" @click="fetchUserSms">
            {{ loading ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>
      <p v-if="success" class="success" role="status" aria-live="polite">{{ success }}</p>

      <BaseDataTable
        v-if="sortedRows.length"
        caption="SMS пользователя"
        aria-label="SMS пользователя"
        :min-width="1080"
      >
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Agent ID</th>
            <th scope="col">Service</th>
            <th scope="col">From</th>
            <th scope="col">Text</th>
            <th scope="col">Status</th>
            <th scope="col">Cost</th>
            <th scope="col">Created</th>
            <th scope="col">Sent</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedRows" :key="`${item.token}-${item.id}-${item.externalId}`">
            <td>
              <div>{{ item.tokenName || '-' }}</div>
              <SensitiveValue
                :value="item.token"
                label="token"
                :copy-label="`Copy full token ${item.tokenName || item.id}`"
              />
            </td>
            <td>
              <SensitiveValue
                :value="item.agentId"
                label="agent_id"
                :copy-label="`Copy full agent_id ${item.tokenName || item.id}`"
              />
            </td>
            <td>{{ item.serviceName || '-' }}</td>
            <td class="mono">{{ item.from || '-' }}</td>
            <td>{{ item.text || '-' }}</td>
            <td>
              <BaseStatusChip
                :label="item.extendedStatus || smsStatusLabel(item.status)"
                :tone="smsStatusTone(item.status)"
                :aria-label="`SMS status: ${item.extendedStatus || smsStatusLabel(item.status)}`"
              />
            </td>
            <td>{{ item.cost || item.cost === 0 ? item.cost : '-' }}</td>
            <td class="mono">{{ item.createdAt || '-' }}</td>
            <td class="mono">{{ item.sentAt || '-' }}</td>
          </tr>
        </tbody>
      </BaseDataTable>

      <p v-else-if="!loading && !error" class="subtitle empty-state">SMS пока нет.</p>
    </article>
  </section>
</template>
