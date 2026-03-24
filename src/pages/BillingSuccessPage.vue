<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getBalance } from '../lib/api';
import { sessionState, setAgentId } from '../lib/session';

const route = useRoute();
const router = useRouter();

const balance = ref(null);
const loadingBalance = ref(false);
const balanceError = ref('');

const amount = computed(() => {
  const raw = typeof route.query.amount === 'string' ? route.query.amount.trim() : '';
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value.toFixed(2) : null;
});

const agent = computed(() =>
  typeof route.query.agent === 'string' ? route.query.agent : '',
);

async function loadBalance() {
  if (!sessionState.token) {
    return;
  }

  const agentId = sessionState.agentId || agent.value;
  if (!agentId) {
    return;
  }

  loadingBalance.value = true;
  balanceError.value = '';

  try {
    const payload = await getBalance(sessionState.token, agentId);
    const value = Number(payload?.balance ?? payload?.Balance ?? 0);
    balance.value = Number.isFinite(value) ? value : 0;
  } catch (requestError) {
    if (requestError?.status === 404 || requestError?.status === 405) {
      return;
    }
    balanceError.value = requestError?.message || 'Не удалось обновить баланс';
  } finally {
    loadingBalance.value = false;
  }
}

onMounted(async () => {
  if (!sessionState.agentId && agent.value) {
    setAgentId(agent.value);
  }

  await loadBalance();

  setTimeout(() => {
    router.replace({ path: '/dashboard/billing', query: { payment: 'success' } });
  }, 1600);
});
</script>

<template>
  <div class="page">
    <section class="panel">
      <h1 class="title">Платеж успешен</h1>
      <p class="subtitle">Оплата прошла. Возвращаем в кабинет...</p>

      <div class="card-grid">
        <article class="card" v-if="amount || loadingBalance || balance !== null">
          <p v-if="amount" class="mono">Сумма: {{ amount }} USD</p>
          <p v-if="loadingBalance" class="subtitle">Обновляем баланс...</p>
          <p v-else-if="balance !== null" class="mono">Баланс: {{ balance.toFixed(2) }} USD</p>
        </article>
      </div>

      <p v-if="balanceError" class="error">{{ balanceError }}</p>

      <div class="link-row">
        <RouterLink class="link" to="/dashboard/billing">В кабинет</RouterLink>
      </div>
    </section>
  </div>
</template>
