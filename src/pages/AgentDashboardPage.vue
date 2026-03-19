<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clearSession, sessionState, setAgentId } from '../lib/session';

const router = useRouter();
const route = useRoute();

const draftAgentId = ref(sessionState.agentId || '');
const saveInfo = ref('');

watch(
  () => sessionState.agentId,
  (value) => {
    draftAgentId.value = value || '';
  },
);

const claims = computed(() => sessionState.claims || {});
const isAgentRole = computed(() => claims.value.role === 'agent');
const dashboardTitle = computed(() =>
  isAgentRole.value ? 'Личный кабинет агента' : 'Личный кабинет пользователя',
);
const tabs = computed(() => {
  if (isAgentRole.value) {
    return [
      { name: 'dashboard-certificates', to: '/dashboard/certificates', label: 'Certificates' },
      { name: 'dashboard-sms', to: '/dashboard/sms', label: 'SMS Logs' },
      { name: 'dashboard-billing', to: '/dashboard/billing', label: 'Billing' },
    ];
  }

  return [{ name: 'dashboard-tokens', to: '/dashboard/tokens', label: 'My Tokens' }];
});

function persistAgentId() {
  setAgentId(draftAgentId.value);
  saveInfo.value = 'Agent ID сохранен.';
  setTimeout(() => {
    saveInfo.value = '';
  }, 1400);
}

async function logout() {
  clearSession();
  await router.push('/login');
}

function isActive(tabName) {
  return route.name === tabName;
}
</script>

<template>
  <div class="dashboard-page">
    <header class="dash-header">
      <div>
        <h1 class="dash-title">{{ dashboardTitle }}</h1>
        <div class="dash-meta">
          <span class="badge">role: {{ claims.role || 'unknown' }}</span>
          <span class="badge mono">phone: {{ claims.phone || '-' }}</span>
        </div>
      </div>

      <button type="button" class="btn btn-danger" @click="logout">Выйти</button>
    </header>

    <section class="dash-layout">
      <aside class="dash-sidebar">
        <nav class="dash-nav">
          <RouterLink
            v-for="tab in tabs"
            :key="tab.name"
            :to="tab.to"
            class="nav-link"
            :class="{ active: isActive(tab.name) }"
          >
            {{ tab.label }}
          </RouterLink>
        </nav>

        <div v-if="isAgentRole" class="card">
          <h3>Agent Context</h3>
          <p class="subtitle">
            Для `SMS Logs` и `Billing` нужен `agent_id` (UUID агента в бэкенде).
          </p>

          <label class="form-label">
            agent_id
            <input v-model="draftAgentId" class="input mono" type="text" placeholder="uuid" />
          </label>

          <p class="subtitle mono">user_id: {{ claims.userId || '-' }}</p>

          <div class="side-actions">
            <button type="button" class="btn btn-secondary" @click="persistAgentId">Сохранить</button>
            <p v-if="saveInfo" class="success">{{ saveInfo }}</p>
          </div>
        </div>
      </aside>

      <main class="dash-content">
        <RouterView />
      </main>
    </section>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  padding: clamp(20px, 5vw, 56px);
  display: grid;
  gap: 28px;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: clamp(20px, 3vw, 34px);
  box-shadow: var(--shadow);
}

.dash-title {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.dash-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.dash-layout {
  display: grid;
  grid-template-columns: minmax(250px, 300px) 1fr;
  gap: 24px;
}

.dash-sidebar {
  display: grid;
  gap: 18px;
  align-content: start;
}

.dash-nav {
  display: grid;
  gap: 10px;
}

.nav-link {
  text-decoration: none;
  color: #48586e;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: #ffffff;
  font-weight: 600;
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
}

.nav-link:hover {
  border-color: #c9d6e6;
  color: #25354a;
  background: #f7f9fc;
}

.nav-link.active {
  color: #24364d;
  background: var(--accent-soft);
  border-color: #c8d6e7;
}

.dash-content {
  min-width: 0;
}

.side-actions {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

@media (max-width: 980px) {
  .dash-header {
    flex-direction: column;
  }

  .dash-layout {
    grid-template-columns: 1fr;
  }
}
</style>
