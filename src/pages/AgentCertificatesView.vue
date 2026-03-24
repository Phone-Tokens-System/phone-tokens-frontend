<script setup>
import { onMounted, reactive, ref } from 'vue';
import { createCsrRequest, getSignedCertificate } from '../lib/api';
import { sessionState } from '../lib/session';

const HISTORY_KEY = 'pt_frontend_csr_history';

const form = reactive({
  email: '',
  csr: '',
});

const fetchId = ref('');
const certificate = ref('');
const loadingSubmit = ref(false);
const loadingCert = ref(false);
const error = ref('');
const success = ref('');
const history = ref([]);

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    history.value = raw ? JSON.parse(raw) : [];
  } catch (storageError) {
    history.value = [];
  }
}

function saveHistoryItem(item) {
  const next = [item, ...history.value].slice(0, 8);
  history.value = next;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function extractCsrId(payload) {
  if (typeof payload === 'number') {
    return payload;
  }

  if (typeof payload === 'string') {
    const value = Number(payload);
    return Number.isFinite(value) ? value : null;
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload.id ?? payload.csr_id ?? payload.csrId;
    const value = Number(candidate);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

function extractCertificate(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return payload.certificate || payload.Certificate || '';
  }

  return '';
}

async function submitCsr() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  loadingSubmit.value = true;
  error.value = '';
  success.value = '';

  try {
    const result = await createCsrRequest(sessionState.token, {
      email: form.email.trim(),
      csr: form.csr,
    });

    const csrId = extractCsrId(result);
    if (csrId !== null) {
      fetchId.value = String(csrId);
      saveHistoryItem({
        id: csrId,
        email: form.email.trim(),
        createdAt: new Date().toISOString(),
      });
      success.value = `CSR request отправлен. ID: ${csrId}`;
    } else {
      success.value = 'CSR request отправлен.';
    }
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось отправить CSR request';
  } finally {
    loadingSubmit.value = false;
  }
}

async function fetchCertificate() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!fetchId.value.trim()) {
    error.value = 'Введите CSR ID.';
    return;
  }

  loadingCert.value = true;
  error.value = '';
  success.value = '';

  try {
    const payload = await getSignedCertificate(sessionState.token, fetchId.value.trim());
    const cert = extractCertificate(payload);

    if (!cert) {
      throw new Error('Сертификат пока не получен или еще не approve админом.');
    }

    certificate.value = cert;
    success.value = 'Подписанный сертификат получен.';
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось получить сертификат';
  } finally {
    loadingCert.value = false;
  }
}

async function copyCertificate() {
  if (!certificate.value) {
    return;
  }

  await navigator.clipboard.writeText(certificate.value);
  success.value = 'Сертификат скопирован в буфер обмена.';
}

function useHistoryItem(item) {
  fetchId.value = String(item.id);
}

onMounted(() => {
  loadHistory();
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <h3>Новый CSR request</h3>

      <form class="form" @submit.prevent="submitCsr">
        <label class="form-label">
          Email
          <input v-model="form.email" class="input" type="email" required />
        </label>

        <label class="form-label">
          CSR (PEM)
          <textarea v-model="form.csr" class="textarea" placeholder="-----BEGIN CERTIFICATE REQUEST-----" required />
        </label>

        <button type="submit" class="btn btn-primary" :disabled="loadingSubmit">
          {{ loadingSubmit ? 'Отправка...' : 'Отправить CSR' }}
        </button>
      </form>
    </article>

    <article class="card">
      <h3>Получить подписанный сертификат</h3>

      <form class="form" @submit.prevent="fetchCertificate">
        <label class="form-label">
          CSR ID
          <input v-model="fetchId" class="input mono" type="text" placeholder="123" />
        </label>

        <div class="section-actions">
          <button type="submit" class="btn btn-primary" :disabled="loadingCert">
            {{ loadingCert ? 'Проверка...' : 'Получить сертификат' }}
          </button>

          <button type="button" class="btn btn-secondary" :disabled="!certificate" @click="copyCertificate">
            Копировать
          </button>
        </div>
      </form>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>

      <label v-if="certificate" class="form-label">
        Signed Certificate
        <textarea class="textarea" :value="certificate" readonly />
      </label>
    </article>

    <article class="card" v-if="history.length">
      <h4>Последние CSR requests</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Created At</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in history" :key="`${item.id}-${item.createdAt}`">
              <td class="mono">{{ item.id }}</td>
              <td>{{ item.email }}</td>
              <td class="mono">{{ new Date(item.createdAt).toLocaleString() }}</td>
              <td>
                <button type="button" class="btn btn-secondary" @click="useHistoryItem(item)">Use</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
