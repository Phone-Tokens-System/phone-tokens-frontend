<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCurrentUser, login } from '../lib/api';
import { clearSession, sessionState, setToken } from '../lib/session';

const router = useRouter();
const route = useRoute();

const form = reactive({
  phone: '',
  password: '',
  role: 'agent',
});

const loading = ref(false);
const error = ref('');

async function submitForm() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const result = await login({
      phone: form.phone.trim(),
      password: form.password,
    });

    if (!result?.token) {
      throw new Error('Сервер не вернул токен');
    }

    setToken(result.token);

    const me = await getCurrentUser(sessionState.token).catch(() => null);
    const role = me?.Role || me?.role || sessionState.claims?.role;

    if (role !== form.role) {
      clearSession();
      error.value = `Вы выбрали роль "${form.role}", но аккаунт имеет роль "${role || 'unknown'}".`;
      return;
    }

    const redirect =
      typeof route.query.redirect === 'string'
        ? route.query.redirect
        : role === 'agent'
          ? '/dashboard/certificates'
          : '/dashboard/tokens';

    await router.push(redirect);
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось выполнить вход';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <section class="panel">
      <h1 class="title">Вход</h1>
      <p class="subtitle">Выберите роль и войдите в кабинет под своим аккаунтом.</p>

      <form class="form" @submit.prevent="submitForm">
        <label class="form-label">
          Войти как
          <select v-model="form.role" class="select">
            <option value="agent">agent</option>
            <option value="user">user</option>
          </select>
        </label>

        <label class="form-label">
          Телефон
          <input v-model="form.phone" class="input" type="text" placeholder="79991234567" required />
        </label>

        <label class="form-label">
          Пароль
          <input v-model="form.password" class="input" type="password" placeholder="••••••••" required />
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Входим...' : 'Войти' }}
        </button>
      </form>

      <div class="link-row">
        <span class="subtitle">Нет аккаунта?</span>
        <RouterLink class="link" to="/register">Создать</RouterLink>
      </div>
    </section>
  </div>
</template>
