<script setup>
import { onMounted, ref } from 'vue';
import BaseDataTable from '../components/base/BaseDataTable.vue';
import BaseStatusChip from '../components/base/BaseStatusChip.vue';
import { buyPackage, getAgentPackages, getPackages } from '../lib/api';
import { sessionState } from '../lib/session';

const loadingPackages = ref(false);
const loadingMyPackages = ref(false);
const buyingId = ref('');
const packages = ref([]);
const myPackages = ref([]);
const error = ref('');
const success = ref('');

function serviceLabel(service) {
  const s = String(service || '').toLowerCase();
  if (s === 'sms') return 'SMS';
  if (s === 'call') return 'Звонки';
  return service || '—';
}

function statusTone(status) {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'EXPIRED') return 'error';
  return 'neutral';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : String(value);
}

async function fetchPackages() {
  if (!sessionState.token) return;
  loadingPackages.value = true;
  try {
    const payload = await getPackages(sessionState.token);
    packages.value = Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить пакеты';
  } finally {
    loadingPackages.value = false;
  }
}

async function fetchMyPackages() {
  if (!sessionState.token || !sessionState.agentId) return;
  loadingMyPackages.value = true;
  try {
    const payload = await getAgentPackages(sessionState.token, sessionState.agentId);
    myPackages.value = Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);
  } catch (e) {
    // endpoint может отсутствовать — не показываем ошибку
    myPackages.value = [];
  } finally {
    loadingMyPackages.value = false;
  }
}

async function handleBuy(pkg) {
  if (!sessionState.agentId) {
    error.value = 'agent_id не найден. Обновите профиль в Agent Context.';
    return;
  }

  buyingId.value = pkg.id;
  error.value = '';
  success.value = '';

  try {
    await buyPackage(sessionState.token, sessionState.agentId, pkg.id);
    success.value = `Пакет «${pkg.name}» успешно куплен.`;
    await fetchMyPackages();
  } catch (e) {
    error.value = e?.message || 'Не удалось купить пакет';
  } finally {
    buyingId.value = '';
  }
}

onMounted(async () => {
  await Promise.all([fetchPackages(), fetchMyPackages()]);
});
</script>

<template>
  <section class="card-grid">
    <!-- Доступные пакеты -->
    <article class="card">
      <div class="section-head">
        <div>
          <h3>Доступные пакеты</h3>
          <p class="subtitle">Купите пакет — стоимость спишется с баланса</p>
        </div>
        <div class="section-actions">
          <button type="button" class="btn btn-secondary" :disabled="loadingPackages" @click="fetchPackages">
            {{ loadingPackages ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="success" class="success" role="status">{{ success }}</p>

      <div v-if="loadingPackages" class="subtitle">Загружаем пакеты...</div>

      <div v-else-if="packages.length" class="packages-grid">
        <article v-for="pkg in packages" :key="pkg.id" class="pkg-card">
          <div class="pkg-header">
            <span class="pkg-name">{{ pkg.name }}</span>
            <span class="badge">{{ serviceLabel(pkg.service) }}</span>
          </div>
          <p v-if="pkg.description" class="subtitle pkg-desc">{{ pkg.description }}</p>
          <div class="pkg-details">
            <div class="pkg-stat">
              <span class="pkg-stat-value">{{ pkg.units }}</span>
              <span class="pkg-stat-label">единиц</span>
            </div>
            <div class="pkg-stat">
              <span class="pkg-stat-value">{{ pkg.duration_days || 30 }}</span>
              <span class="pkg-stat-label">дней</span>
            </div>
            <div class="pkg-stat">
              <span class="pkg-stat-value">{{ Number(pkg.price).toFixed(2) }}</span>
              <span class="pkg-stat-label">RUB</span>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-primary pkg-buy-btn"
            :disabled="!!buyingId"
            @click="handleBuy(pkg)"
          >
            {{ buyingId === pkg.id ? 'Покупаем...' : 'Купить' }}
          </button>
        </article>
      </div>

      <p v-else class="subtitle empty-state">Доступных пакетов нет.</p>
    </article>

    <!-- Мои пакеты -->
    <article class="card">
      <div class="section-head">
        <div>
          <h3>Мои пакеты</h3>
          <p class="subtitle">Активные и истёкшие пакеты агента</p>
        </div>
        <div class="section-actions">
          <button type="button" class="btn btn-secondary" :disabled="loadingMyPackages" @click="fetchMyPackages">
            {{ loadingMyPackages ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <BaseDataTable
        v-if="myPackages.length"
        caption="Мои пакеты"
        aria-label="Мои пакеты"
        :min-width="640"
      >
        <thead>
          <tr>
            <th scope="col">Сервис</th>
            <th scope="col">Статус</th>
            <th scope="col">Остаток</th>
            <th scope="col">Использовано</th>
            <th scope="col">Истекает</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pkg in myPackages" :key="pkg.id">
            <td>{{ serviceLabel(pkg.service_type || pkg.service) }}</td>
            <td>
              <BaseStatusChip :label="pkg.status" :tone="statusTone(pkg.status)" />
            </td>
            <td>{{ pkg.units_total }}</td>
            <td>{{ pkg.units_used }}</td>
            <td class="mono">{{ formatDate(pkg.expires_at) }}</td>
          </tr>
        </tbody>
      </BaseDataTable>

      <p v-else-if="!loadingMyPackages" class="subtitle empty-state">Купленных пакетов нет.</p>
      <p v-else class="subtitle">Загружаем...</p>
    </article>
  </section>
</template>

<style scoped>
.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 4px;
}

.pkg-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pkg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pkg-name {
  font-weight: 700;
  font-size: 1rem;
}

.pkg-desc {
  margin: 0;
  font-size: 0.875rem;
}

.pkg-details {
  display: flex;
  gap: 16px;
}

.pkg-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pkg-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
}

.pkg-stat-label {
  font-size: 0.75rem;
  color: var(--text-muted, #64748b);
}

.pkg-buy-btn {
  margin-top: auto;
}
</style>
