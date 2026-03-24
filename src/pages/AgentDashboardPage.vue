<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCurrentUser } from '../lib/api';
import { clearSession, sessionState, setAgentId } from '../lib/session';

const router = useRouter();
const route = useRoute();

const syncInfo = ref('');
const syncingProfile = ref(false);

const claims = computed(() => sessionState.claims || {});
const isAgentRole = computed(() => claims.value.role === 'agent');
const dashboardTitle = computed(() =>
  isAgentRole.value ? 'Личный кабинет агента' : 'Личный кабинет пользователя',
);
const tabs = computed(() => {
  if (isAgentRole.value) {
    return [
      { name: 'dashboard-certificates', to: '/dashboard/certificates', label: 'Certificates' },
      { name: 'dashboard-sms', to: '/dashboard/sms', label: 'SMS' },
      { name: 'dashboard-billing', to: '/dashboard/billing', label: 'Billing' },
    ];
  }

  return [
    { name: 'dashboard-user-profile', to: '/dashboard/profile', label: 'My Profile' },
    { name: 'dashboard-tokens', to: '/dashboard/tokens', label: 'My Tokens' },
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

          <p class="subtitle mono">user_id: {{ claims.userId || '-' }}</p>
          <p class="subtitle mono">agent_id: {{ sessionState.agentId || 'не найден' }}</p>

          <div class="side-actions">
            <button type="button" class="btn btn-secondary" :disabled="syncingProfile" @click="syncAgentProfile">
              {{ syncingProfile ? 'Обновляем...' : 'Обновить из профиля' }}
            </button>
            <p v-if="syncInfo" :class="sessionState.agentId ? 'success' : 'error'">{{ syncInfo }}</p>
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
