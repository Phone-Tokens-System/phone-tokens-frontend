<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const amount = computed(() => {
  const value = Number(route.query.amount);
  return Number.isFinite(value) ? value.toFixed(2) : null;
});

const agent = computed(() =>
  typeof route.query.agent === 'string' ? route.query.agent : null,
);
</script>

<template>
  <div class="page">
    <section class="panel">
      <h1 class="title">Оплата завершена</h1>
      <p class="subtitle">
        Stripe вернул успешный checkout. Вебхук на бэкенде должен подтвердить пополнение баланса.
      </p>

      <div class="card-grid">
        <article class="card" v-if="amount || agent">
          <p v-if="amount" class="mono">amount: {{ amount }} USD</p>
          <p v-if="agent" class="mono">agent: {{ agent }}</p>
        </article>
      </div>

      <div class="link-row">
        <RouterLink class="link" to="/dashboard/billing">К биллингу</RouterLink>
        <RouterLink class="link" to="/dashboard/certificates">К кабинету</RouterLink>
      </div>
    </section>
  </div>
</template>
