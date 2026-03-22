<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseFormField from '../components/base/BaseFormField.vue';
import { getCurrentUser, login } from '../lib/api';
import { clearSession, sessionState, setAgentId, setToken } from '../lib/session';

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

    if (role === 'agent') {
      const profileAgentId = me?.agent_id || me?.agentId || '';
      setAgentId(profileAgentId);
    } else {
      setAgentId('');
    }

    const redirect =
      typeof route.query.redirect === 'string'
        ? route.query.redirect
        : role === 'agent'
          ? '/dashboard/certificates'
          : '/dashboard/profile';

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

      <form class="form" aria-label="Форма входа" @submit.prevent="submitForm">
        <BaseFormField id="login-role" label="Войти как">
          <select id="login-role" v-model="form.role" class="select">
            <option value="agent">agent</option>
            <option value="user">user</option>
          </select>
        </BaseFormField>

        <BaseFormField id="login-phone" label="Телефон" required>
          <input id="login-phone" v-model="form.phone" class="input" type="text" placeholder="79991234567" required />
        </BaseFormField>

        <BaseFormField id="login-password" label="Пароль" required>
          <input
            id="login-password"
            v-model="form.password"
            class="input"
            type="password"
            placeholder="••••••••"
            required
          />
        </BaseFormField>

        <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>

        <button type="submit" class="btn btn-primary" :disabled="loading" :aria-busy="loading ? 'true' : 'false'">
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
