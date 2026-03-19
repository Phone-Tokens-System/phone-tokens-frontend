<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { register } from '../lib/api';

const router = useRouter();

const form = reactive({
  phone: '',
  password: '',
  role: 'user',
  serviceName: '',
  email: '',
});

const loading = ref(false);
const error = ref('');
const success = ref('');

const isAgentRole = computed(() => form.role === 'agent');

async function submitForm() {
  if (loading.value) {
    return;
  }

  error.value = '';
  success.value = '';

  if (isAgentRole.value) {
    if (!form.serviceName.trim() || !form.email.trim()) {
      error.value = 'Для роли agent обязательны поля service_name и email.';
      return;
    }
  }

  loading.value = true;

  try {
    await register({
      phone: form.phone.trim(),
      password: form.password,
      role: form.role,
      service_name: form.serviceName.trim(),
      email: form.email.trim(),
    });

    success.value =
      form.role === 'agent'
        ? 'Агент зарегистрирован. Теперь выполните вход.'
        : 'Пользователь зарегистрирован. Теперь выполните вход.';

    setTimeout(() => {
      router.push('/login');
    }, 700);
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось зарегистрироваться';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <section class="panel">
      <h1 class="title">Регистрация</h1>
      <p class="subtitle">Выберите роль и заполните поля. Для агента нужны дополнительные данные.</p>

      <form class="form" @submit.prevent="submitForm">
        <label class="form-label">
          Телефон
          <input v-model="form.phone" class="input" type="text" placeholder="79991234567" required />
        </label>

        <label class="form-label">
          Пароль
          <input v-model="form.password" class="input" type="password" placeholder="••••••••" required />
        </label>

        <label class="form-label">
          Роль
          <select v-model="form.role" class="select">
            <option value="user">user</option>
            <option value="agent">agent</option>
          </select>
        </label>

        <template v-if="isAgentRole">
          <label class="form-label">
            Service Name (`service_name`)
            <input v-model="form.serviceName" class="input" type="text" placeholder="my-service" required />
          </label>

          <label class="form-label">
            Email
            <input v-model="form.email" class="input" type="email" placeholder="agent@example.com" required />
          </label>
        </template>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="success" class="success">{{ success }}</p>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Сохраняем...' : 'Зарегистрироваться' }}
        </button>
      </form>

      <div class="link-row">
        <span class="subtitle">Уже есть аккаунт?</span>
        <RouterLink class="link" to="/login">Войти</RouterLink>
      </div>
    </section>
  </div>
</template>
