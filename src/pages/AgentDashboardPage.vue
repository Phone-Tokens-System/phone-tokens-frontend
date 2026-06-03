<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SensitiveValue from '../components/base/SensitiveValue.vue';
import { getCurrentUser } from '../lib/api';
import { clearSession, sessionState, setAgentId } from '../lib/session';

const router = useRouter();
const route = useRoute();

const syncInfo = ref('');
const syncingProfile = ref(false);

const claims = computed(() => sessionState.claims || {});
const isAgentRole = computed(() => claims.value.role === 'agent');
const isAdminRole = computed(() => claims.value.role === 'admin');
const dashboardTitle = computed(() =>
  isAgentRole.value
    ? 'Личный кабинет агента'
    : isAdminRole.value
      ? 'Админ-панель'
      : 'Личный кабинет пользователя',
);
const tabs = computed(() => {
  if (isAdminRole.value) {
    return [
      { name: 'dashboard-admin-csr', to: '/dashboard/admin/csr', label: 'CSR' },
      { name: 'dashboard-admin-sms', to: '/dashboard/admin/sms', label: 'SMS Monitor' },
      { name: 'dashboard-admin-packages', to: '/dashboard/admin/packages', label: 'Packages' },
    ];
  }

  if (isAgentRole.value) {
    return [
      { name: 'dashboard-certificates', to: '/dashboard/certificates', label: 'Certificates' },
      { name: 'dashboard-sms', to: '/dashboard/sms', label: 'SMS' },
      { name: 'dashboard-billing', to: '/dashboard/billing', label: 'Billing' },
      { name: 'dashboard-packages', to: '/dashboard/packages', label: 'Packages' },
    ];
  }

  return [
    { name: 'dashboard-user-profile', to: '/dashboard/profile', label: 'My Profile' },
    { name: 'dashboard-tokens', to: '/dashboard/tokens', label: 'My Tokens' },
    { name: 'dashboard-user-sms', to: '/dashboard/user-sms', label: 'My SMS' },
  ];
});

async function syncAgentProfile() {
  if (!isAgentRole.value || !sessionState.token) {
    return;
  }

  syncingProfile.value = true;
  syncInfo.value = '';

  try {
    const me = await getCurrentUser(sessionState.token);
    const profileAgentId = me?.agent_id || me?.agentId || '';

    if (profileAgentId) {
      setAgentId(profileAgentId);
      syncInfo.value = 'agent_id загружен из профиля.';
      return;
    }

    syncInfo.value = 'agent_id не найден в профиле.';
  } catch (error) {
    syncInfo.value = 'Не удалось загрузить agent_id из профиля.';
  } finally {
    syncingProfile.value = false;
  }
}

async function logout() {
  clearSession();
  await router.push('/login');
}

function isActive(tabName) {
  return route.name === tabName;
}

onMounted(() => {
  if (isAgentRole.value && !sessionState.agentId) {
    syncAgentProfile();
  }
});
</script>

<template>
  <div class="dashboard-page">
    <header class="dash-header">
      <div class="dash-header-main">
        <h1 class="dash-title">{{ dashboardTitle }}</h1>
        <div class="dash-meta">
          <span class="badge">role: {{ claims.role || 'unknown' }}</span>
          <span class="badge mono">phone: {{ claims.phone || '-' }}</span>
        </div>

        <nav class="dash-nav" aria-label="Навигация кабинета">
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

        <div v-if="isAgentRole" class="agent-context">
          <h3>Agent Context</h3>

          <div class="agent-context-values">
            <p class="subtitle">
              user_id:
              <SensitiveValue :value="claims.userId" label="user_id" copy-label="Copy full dashboard user_id" />
            </p>
            <p class="subtitle">
              agent_id:
              <SensitiveValue :value="sessionState.agentId" label="agent_id" copy-label="Copy full dashboard agent_id" empty-label="не найден" />
            </p>
          </div>

          <div class="agent-context-actions">
            <button type="button" class="btn btn-secondary" :disabled="syncingProfile" @click="syncAgentProfile">
              {{ syncingProfile ? 'Обновляем...' : 'Обновить из профиля' }}
            </button>
            <p v-if="syncInfo" :class="sessionState.agentId ? 'success' : 'error'">{{ syncInfo }}</p>
          </div>
        </div>
      </div>

      <button type="button" class="btn btn-danger" @click="logout">Выйти</button>
    </header>

    <section class="dash-layout">
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

.dash-header-main {
  min-width: 0;
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
  gap: 24px;
}

.dash-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  text-decoration: none;
  color: #48586e;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px 16px;
  background: #ffffff;
  font-weight: 600;
  white-space: nowrap;
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

.agent-context {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px 18px;
  align-items: center;
  margin-top: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #f8fafc;
  padding: 14px;
}

.agent-context h3 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0;
}

.agent-context-values {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  min-width: 0;
}

.agent-context .subtitle {
  margin: 0;
}

.agent-context-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

@media (max-width: 980px) {
  .dash-header {
    flex-direction: column;
  }

  .dash-header .btn-danger {
    align-self: flex-start;
  }

  .dash-layout {
    grid-template-columns: 1fr;
  }

  .agent-context {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .dash-nav {
    display: grid;
    grid-template-columns: 1fr;
  }

  .nav-link {
    justify-content: flex-start;
  }
}
</style>
