import { createRouter, createWebHistory } from 'vue-router';
import { isAuthenticated, sessionState } from '../lib/session';
import AgentBillingView from '../pages/AgentBillingView.vue';
import AgentCertificatesView from '../pages/AgentCertificatesView.vue';
import AgentDashboardPage from '../pages/AgentDashboardPage.vue';
import AgentSmsLogsView from '../pages/AgentSmsLogsView.vue';
import AgentTokensView from '../pages/AgentTokensView.vue';
import BillingCancelPage from '../pages/BillingCancelPage.vue';
import BillingSuccessPage from '../pages/BillingSuccessPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import NotFoundPage from '../pages/NotFoundPage.vue';
import RegisterPage from '../pages/RegisterPage.vue';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage,
    meta: { guestOnly: true },
  },
  {
    path: '/dashboard',
    component: AgentDashboardPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: () => (sessionState.claims?.role === 'agent' ? '/dashboard/certificates' : '/dashboard/tokens'),
      },
      {
        path: 'certificates',
        name: 'dashboard-certificates',
        component: AgentCertificatesView,
        meta: { requiresAgent: true },
      },
      {
        path: 'sms',
        name: 'dashboard-sms',
        component: AgentSmsLogsView,
        meta: { requiresAgent: true },
      },
      {
        path: 'billing',
        name: 'dashboard-billing',
        component: AgentBillingView,
        meta: { requiresAgent: true },
      },
      {
        path: 'tokens',
        name: 'dashboard-tokens',
        component: AgentTokensView,
        meta: { requiresUser: true },
      },
    ],
  },
  {
    path: '/success',
    name: 'billing-success',
    component: BillingSuccessPage,
  },
  {
    path: '/cancel',
    name: 'billing-cancel',
    component: BillingCancelPage,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (to.meta.guestOnly && isAuthenticated.value) {
    return sessionState.claims?.role === 'agent' ? '/dashboard/certificates' : '/dashboard/tokens';
  }

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.requiresAgent && sessionState.claims?.role !== 'agent') {
    return '/dashboard/tokens';
  }

  if (to.meta.requiresUser && sessionState.claims?.role !== 'user') {
    return '/dashboard/certificates';
  }

  return true;
});

export default router;
