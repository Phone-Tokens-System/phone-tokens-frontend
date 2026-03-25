<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseFormField from '../components/base/BaseFormField.vue';
import { register } from '../lib/api';
import { normalizeRuPhone } from '../lib/phone';

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

  const normalizedPhone = normalizeRuPhone(form.phone);
  if (!normalizedPhone) {
    error.value = 'Введите российский номер в формате +7XXXXXXXXXX.';
    return;
  }

  if (isAgentRole.value) {
    if (!form.serviceName.trim() || !form.email.trim()) {
      error.value = 'Для роли agent обязательны поля service_name и email.';
      return;
    }
  }

  loading.value = true;

  try {
    await register({
      phone: normalizedPhone,
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

      <form class="form" aria-label="Форма регистрации" @submit.prevent="submitForm">
        <BaseFormField id="register-phone" label="Телефон" required>
          <input
            id="register-phone"
            v-model="form.phone"
            class="input"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="+7 999 123-45-67"
            required
          />
        </BaseFormField>

        <BaseFormField id="register-password" label="Пароль" required>
          <input
            id="register-password"
            v-model="form.password"
            class="input"
            type="password"
            placeholder="••••••••"
            required
          />
        </BaseFormField>

        <BaseFormField id="register-role" label="Роль">
          <select id="register-role" v-model="form.role" class="select">
            <option value="user">user</option>
            <option value="agent">agent</option>
          </select>
        </BaseFormField>

        <template v-if="isAgentRole">
          <BaseFormField id="register-service-name" label="Service Name (`service_name`)" required>
            <input
              id="register-service-name"
              v-model="form.serviceName"
              class="input"
              type="text"
              placeholder="my-service"
              required
            />
          </BaseFormField>

          <BaseFormField id="register-email" label="Email" required>
            <input
              id="register-email"
              v-model="form.email"
              class="input"
              type="email"
              placeholder="agent@example.com"
              required
            />
          </BaseFormField>
        </template>

        <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>
        <p v-if="success" class="success" role="status" aria-live="polite">{{ success }}</p>

        <button type="submit" class="btn btn-primary" :disabled="loading" :aria-busy="loading ? 'true' : 'false'">
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
