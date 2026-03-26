<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createBalanceTopUp, getBalance } from '../lib/api';
import { sessionState } from '../lib/session';

const route = useRoute();
const router = useRouter();

const loadingBalance = ref(false);
const loadingTopUp = ref(false);
const error = ref('');
const success = ref('');
const balance = ref(null);
const balanceReadUnsupported = ref(false);
const amount = ref('10');

async function refreshBalance() {
  if (balanceReadUnsupported.value) {
    return;
  }

  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!sessionState.agentId) {
    error.value = 'agent_id не найден в профиле. Выполните вход заново или обновите профиль в Agent Context.';
    return;
  }

  loadingBalance.value = true;
  error.value = '';

  try {
    const payload = await getBalance(sessionState.token, sessionState.agentId);
    const value = Number(payload?.balance ?? payload?.Balance ?? 0);
    balance.value = Number.isFinite(value) ? value : 0;
  } catch (requestError) {
    if (requestError?.status === 404 || requestError?.status === 405) {
      balanceReadUnsupported.value = true;
      error.value = '';
      success.value = 'Чтение баланса сейчас недоступно. Пополнение работает.';
      balance.value = null;
      return;
    }
    error.value = requestError?.message || 'Не удалось загрузить баланс';
  } finally {
    loadingBalance.value = false;
  }
}

async function startTopUp() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!sessionState.agentId) {
    error.value = 'agent_id не найден в профиле. Выполните вход заново или обновите профиль в Agent Context.';
    return;
  }

  const numericAmount = Number(amount.value);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    error.value = 'Введите корректную сумму пополнения.';
    return;
  }

  loadingTopUp.value = true;
  error.value = '';
  success.value = '';

  try {
    const payload = await createBalanceTopUp(sessionState.token, {
      agent_id: sessionState.agentId,
      amount: numericAmount,
    });

    const checkoutUrl = payload?.checkout_url || payload?.checkoutUrl || payload?.url;
    if (!checkoutUrl) {
      throw new Error('Бэкенд не вернул checkout URL.');
    }

    success.value = 'Переход на Stripe Checkout...';
    window.location.assign(checkoutUrl);
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось создать checkout session';
  } finally {
    loadingTopUp.value = false;
  }
}

onMounted(async () => {
  const fromSuccess = route.query.payment === 'success';

  if (sessionState.agentId) {
    await refreshBalance();
    if (fromSuccess) {
      setTimeout(() => {
        refreshBalance();
      }, 1500);
    }
  }

  if (fromSuccess) {
    success.value = 'Платеж успешно завершен.';
    const cleanedQuery = { ...route.query };
    delete cleanedQuery.payment;
    delete cleanedQuery.agent;
    delete cleanedQuery.amount;
    router.replace({ path: route.path, query: cleanedQuery });
  }
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <div class="section-head">
        <div>
          <h3>Billing</h3>
        </div>

        <div class="section-actions">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loadingBalance || balanceReadUnsupported"
            @click="refreshBalance"
          >
            {{ loadingBalance ? 'Обновляем...' : balanceReadUnsupported ? 'Недоступно' : 'Обновить баланс' }}
          </button>
        </div>
      </div>

      <div class="card">
        <p class="subtitle">Текущий баланс</p>
        <p class="balance-value">
          {{ balance === null ? '—' : `${balance.toFixed(2)} RUB` }}
        </p>
        <p v-if="balanceReadUnsupported" class="subtitle billing-note">
          Текущий backend не отдает endpoint чтения баланса. Можно пополнять баланс через Stripe.
        </p>
      </div>

      <form class="form" @submit.prevent="startTopUp">
        <label class="form-label">
          Сумма пополнения (RUB)
          <input v-model="amount" class="input" type="number" min="1" step="0.01" />
        </label>

        <button type="submit" class="btn btn-primary" :disabled="loadingTopUp">
          {{ loadingTopUp ? 'Создаем checkout...' : 'Пополнить баланс' }}
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>
    </article>
  </section>
</template>

<style scoped>
.balance-value {
  margin: 8px 0 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-weight: 800;
}

.billing-note {
  margin-top: 16px;
}
</style>
