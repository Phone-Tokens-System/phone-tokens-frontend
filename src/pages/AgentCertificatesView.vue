<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { createCsrRequest, getCurrentSignedCertificate, getSignedCertificate } from '../lib/api';
import { saveSignedAgentCertificate } from '../lib/agentCertificates';
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
let certificatePollId = null;

function historyKey() {
  const agentId = String(sessionState.agentId || '').trim();
  return agentId ? `${HISTORY_KEY}:${agentId}` : '';
}

function loadHistory() {
  const key = historyKey();
  if (!key) {
    history.value = [];
    return;
  }

  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    history.value = Array.isArray(parsed)
      ? parsed.filter((item) => !item?.agentId || item.agentId === sessionState.agentId)
      : [];
  } catch (storageError) {
    history.value = [];
  }
}

function saveHistoryItem(item) {
  const key = historyKey();
  if (!key) {
    return;
  }

  const next = [{ ...item, agentId: sessionState.agentId }, ...history.value].slice(0, 8);
  history.value = next;
  localStorage.setItem(key, JSON.stringify(next));
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

async function submitCsr() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  const csrValue = form.csr.trim();
  if (!csrValue.includes('-----BEGIN CERTIFICATE REQUEST-----') || !csrValue.includes('-----END CERTIFICATE REQUEST-----')) {
    error.value = 'Вставьте CSR в PEM формате: -----BEGIN CERTIFICATE REQUEST----- ... -----END CERTIFICATE REQUEST-----.';
    return;
  }

  loadingSubmit.value = true;
  error.value = '';
  success.value = '';

  try {
    const result = await createCsrRequest(sessionState.token, {
      email: form.email.trim(),
      csr: csrValue,
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

async function saveCertificatePayload(payload, fallbackCsrId = '') {
  const saved = saveSignedAgentCertificate(payload, sessionState.agentId);
  if (!saved?.certificate) {
    throw new Error('Сертификат пока не получен или еще не approve админом.');
  }

  certificate.value = saved.certificate;
  if (fallbackCsrId && !saved.id.startsWith('csr-')) {
    fetchId.value = String(fallbackCsrId);
  }
  return saved;
}

async function checkCurrentCertificate({ silent = false } = {}) {
  if (!sessionState.token) {
    if (!silent) {
      error.value = 'Сессия не найдена. Выполните вход заново.';
    }
    return;
  }

  if (silent && loadingCert.value) {
    return;
  }

  loadingCert.value = true;
  if (!silent) {
    error.value = '';
    success.value = '';
  }

  try {
    const payload = await getCurrentSignedCertificate(sessionState.token);
    const saved = await saveCertificatePayload(payload);
    if (!silent) {
      const csrLabel = saved.id.startsWith('csr-') ? ` (${saved.label})` : '';
      success.value = `Новые сертификаты проверены. Подписанный сертификат сохранен для отправки SMS${csrLabel}.`;
    }
  } catch (requestError) {
    if (silent && requestError?.status === 404) {
      return;
    }

    if (requestError?.status === 404) {
      error.value = 'Новых подписанных сертификатов пока нет.';
      return;
    }

    if (!silent) {
      error.value = requestError?.message || 'Не удалось проверить новые сертификаты';
    }
  } finally {
    loadingCert.value = false;
  }
}

async function fetchCertificateById(csrId) {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  const normalizedId = String(csrId || '').trim();
  if (!normalizedId) {
    error.value = 'CSR ID не найден.';
    return;
  }

  loadingCert.value = true;
  error.value = '';
  success.value = '';

  try {
    const payload = await getSignedCertificate(sessionState.token, normalizedId);
    const saved = await saveCertificatePayload(payload, normalizedId);
    success.value = `${saved.label} сохранен для отправки SMS.`;
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
  fetchCertificateById(item.id);
}

function startCertificatePolling() {
  if (certificatePollId !== null) {
    return;
  }

  certificatePollId = window.setInterval(() => {
    checkCurrentCertificate({ silent: true });
  }, 5000);
}

function stopCertificatePolling() {
  if (certificatePollId === null) {
    return;
  }

  window.clearInterval(certificatePollId);
  certificatePollId = null;
}

watch(
  () => sessionState.agentId,
  () => {
    loadHistory();
  },
);

onMounted(() => {
  loadHistory();
  checkCurrentCertificate({ silent: true });
  startCertificatePolling();
});

onUnmounted(() => {
  stopCertificatePolling();
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
      <h3>Проверить новые сертификаты</h3>
      <p class="subtitle">После approve админом подписанный сертификат сохранится для отправки SMS автоматически.</p>

      <form class="form" aria-label="Форма проверки новых сертификатов" @submit.prevent="checkCurrentCertificate()">
        <div class="section-actions">
          <button type="submit" class="btn btn-primary" :disabled="loadingCert">
            {{ loadingCert ? 'Проверка...' : 'Проверить новые сертификаты' }}
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
                <button type="button" class="btn btn-secondary" :disabled="loadingCert" @click="useHistoryItem(item)">
                  Проверить CSR
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
