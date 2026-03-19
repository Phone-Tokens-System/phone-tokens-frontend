<script setup>
import { onMounted, ref } from 'vue';
import { createBalanceTopUp, getBalance } from '../lib/api';
import { sessionState } from '../lib/session';

const loadingBalance = ref(false);
const loadingTopUp = ref(false);
const error = ref('');
const success = ref('');
const balance = ref(null);
const amount = ref('10');

async function refreshBalance() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!sessionState.agentId) {
    error.value = 'Укажите agent_id в левом блоке Agent Context.';
    return;
  }

  loadingBalance.value = true;
  error.value = '';

  try {
    const payload = await getBalance(sessionState.token, sessionState.agentId);
    const value = Number(payload?.balance ?? payload?.Balance ?? 0);
    balance.value = Number.isFinite(value) ? value : 0;
  } catch (requestError) {
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
    error.value = 'Укажите agent_id в левом блоке Agent Context.';
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

onMounted(() => {
  if (sessionState.agentId) {
    refreshBalance();
  }
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <div class="section-head">
        <div>
          <h3>Billing</h3>
          <p class="subtitle">
            Баланс и пополнение через Stripe Checkout (`POST/GET /api/v1/billing/balance`).
          </p>
        </div>

        <div class="section-actions">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loadingBalance"
            @click="refreshBalance"
          >
            {{ loadingBalance ? 'Обновляем...' : 'Обновить баланс' }}
          </button>
        </div>
      </div>

      <div class="card">
        <p class="subtitle">Текущий баланс</p>
        <p class="balance-value">
          {{ balance === null ? '—' : `${balance.toFixed(2)} USD` }}
        </p>
      </div>

      <form class="form" @submit.prevent="startTopUp">
        <label class="form-label">
          Сумма пополнения (USD)
          <input v-model="amount" class="input" type="number" min="1" step="0.01" />
        </label>

        <button type="submit" class="btn btn-primary" :disabled="loadingTopUp">
          {{ loadingTopUp ? 'Создаем checkout...' : 'Пополнить баланс' }}
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>

      <p class="subtitle billing-note">
        После оплаты Stripe отправляет webhook на бэкенд. Для UI успешного завершения используйте маршрут `/success`.
      </p>
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
