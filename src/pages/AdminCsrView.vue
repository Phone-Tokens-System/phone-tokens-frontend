<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseDataTable from '../components/base/BaseDataTable.vue';
import BaseStatusChip from '../components/base/BaseStatusChip.vue';
import { approveAdminCsrRequest, getAdminCsrRequests } from '../lib/api';
import { sessionState } from '../lib/session';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const approvingId = ref('');
const error = ref('');
const success = ref('');
const statusFilter = ref('all');
const requests = ref([]);

function normalizeCsrRequests(payload) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return source
    .map((item) => {
      const id = Number(item?.id ?? item?.ID ?? 0);
      const status = String(item?.status ?? item?.Status ?? '').trim().toUpperCase() || 'UNKNOWN';
      const csrRaw = item?.csr ?? item?.CSR;
      const csrString = typeof csrRaw === 'string' ? csrRaw : '';

      return {
        id: Number.isFinite(id) ? id : 0,
        email: String(item?.email ?? item?.Email ?? '').trim(),
        serviceName: String(item?.service_name ?? item?.serviceName ?? item?.ServiceName ?? '').trim(),
        agentId: String(item?.agent_id ?? item?.agentId ?? item?.AgentID ?? '').trim(),
        status,
        hasCsr: Boolean(csrString.trim()),
      };
    })
    .filter((item) => item.id > 0)
    .sort((a, b) => b.id - a.id);
}

function statusTone(status) {
  if (status === 'APPROVED') return 'ok';
  if (status === 'PENDING') return 'warn';
  if (status === 'REJECTED') return 'error';
  return 'neutral';
}

const filteredRequests = computed(() => {
  if (statusFilter.value === 'all') {
    return requests.value;
  }
  return requests.value.filter((item) => item.status === statusFilter.value);
});

function applySuccessFromQuery() {
  if (route.query.success !== '1') {
    return;
  }

  const approvedId = typeof route.query.approved === 'string' ? route.query.approved : '';
  success.value = approvedId ? `CSR #${approvedId} одобрен.` : 'CSR одобрен.';
}

async function fetchRequests() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const payload = await getAdminCsrRequests(sessionState.token);
    requests.value = normalizeCsrRequests(payload);
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось загрузить CSR requests';
  } finally {
    loading.value = false;
  }
}

async function approveRequest(item) {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (item.status === 'APPROVED') {
    success.value = `CSR #${item.id} уже одобрен.`;
    return;
  }

  approvingId.value = String(item.id);
  error.value = '';
  success.value = '';

  try {
    await approveAdminCsrRequest(sessionState.token, item.id);
    await router.replace({
      path: '/dashboard/admin/csr',
      query: {
        success: '1',
        approved: String(item.id),
        ts: String(Date.now()),
      },
    });
    applySuccessFromQuery();
    await fetchRequests();
  } catch (requestError) {
    if (requestError?.status === 500) {
      await router.replace({
        path: '/dashboard/admin/csr',
        query: {
          success: '1',
          approved: String(item.id),
          ts: String(Date.now()),
        },
      });
      applySuccessFromQuery();
      await fetchRequests();
      return;
    }

    error.value = requestError?.message || `Не удалось одобрить CSR #${item.id}`;
  } finally {
    approvingId.value = '';
  }
}

onMounted(() => {
  applySuccessFromQuery();
  fetchRequests();
});

watch(
  () => route.query.success,
  () => {
    applySuccessFromQuery();
  },
);
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <div class="section-head">
        <div>
          <h3>CSR Requests</h3>
          <p class="subtitle">Показано: {{ filteredRequests.length }} из {{ requests.length }}</p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-primary" :disabled="loading" @click="fetchRequests">
            {{ loading ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <label class="form-label filter-label">
        Статус
        <select v-model="statusFilter" class="select">
          <option value="all">Все</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </label>

      <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>
      <p v-if="success" class="success" role="status" aria-live="polite">{{ success }}</p>

      <BaseDataTable
        v-if="filteredRequests.length"
        caption="CSR requests"
        aria-label="CSR requests"
        :min-width="920"
      >
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Email</th>
            <th scope="col">Service</th>
            <th scope="col">Agent ID</th>
            <th scope="col">CSR</th>
            <th scope="col">Status</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredRequests" :key="item.id">
            <td class="mono">{{ item.id }}</td>
            <td>{{ item.email || '-' }}</td>
            <td>{{ item.serviceName || '-' }}</td>
            <td class="mono">{{ item.agentId || '-' }}</td>
            <td>{{ item.hasCsr ? 'есть' : '-' }}</td>
            <td>
              <BaseStatusChip
                :label="item.status"
                :tone="statusTone(item.status)"
                :aria-label="`CSR status: ${item.status}`"
              />
            </td>
            <td>
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="approvingId === String(item.id) || item.status === 'APPROVED'"
                @click="approveRequest(item)"
              >
                {{ approvingId === String(item.id) ? 'Approve...' : 'Approve' }}
              </button>
            </td>
          </tr>
        </tbody>
      </BaseDataTable>

      <p v-else-if="!loading" class="subtitle empty-state">CSR requests пока нет.</p>
    </article>
  </section>
</template>

<style scoped>
.filter-label {
  max-width: 260px;
  margin-bottom: 18px;
}
</style>
