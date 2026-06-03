import { createRouter, createWebHistory } from 'vue-router';
import { isAuthenticated, sessionState } from '../lib/session';
import AdminCsrView from '../pages/AdminCsrView.vue';
import AdminPackagesView from '../pages/AdminPackagesView.vue';
import AdminSmsView from '../pages/AdminSmsView.vue';
import AgentBillingView from '../pages/AgentBillingView.vue';
import AgentPackagesView from '../pages/AgentPackagesView.vue';
import AgentCertificatesView from '../pages/AgentCertificatesView.vue';
import AgentDashboardPage from '../pages/AgentDashboardPage.vue';
import AgentSmsLogsView from '../pages/AgentSmsLogsView.vue';
import AgentTokensView from '../pages/AgentTokensView.vue';
import BillingCancelPage from '../pages/BillingCancelPage.vue';
import BillingSuccessPage from '../pages/BillingSuccessPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import NotFoundPage from '../pages/NotFoundPage.vue';
import RegisterPage from '../pages/RegisterPage.vue';
import SsoAuthorizePage from '../pages/SsoAuthorizePage.vue';
import UserSmsView from '../pages/UserSmsView.vue';
import UserProfileView from '../pages/UserProfileView.vue';

function dashboardPathByRole(role) {
  if (role === 'agent') return '/dashboard/certificates';
  if (role === 'admin') return '/dashboard/admin/csr';
  return '/dashboard/profile';
}

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
    path: '/sso',
    name: 'sso-authorize',
    component: SsoAuthorizePage,
    meta: { requiresAuth: true, requiresUser: true },
  },
  {
    path: '/dashboard',
    component: AgentDashboardPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: () => dashboardPathByRole(sessionState.claims?.role),
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
        path: 'packages',
        name: 'dashboard-packages',
        component: AgentPackagesView,
        meta: { requiresAgent: true },
      },
      {
        path: 'profile',
        name: 'dashboard-user-profile',
        component: UserProfileView,
        meta: { requiresUser: true },
      },
      {
        path: 'tokens',
        name: 'dashboard-tokens',
        component: AgentTokensView,
        meta: { requiresUser: true },
      },
      {
        path: 'user-sms',
        name: 'dashboard-user-sms',
        component: UserSmsView,
        meta: { requiresUser: true },
      },
      {
        path: 'admin/csr',
        name: 'dashboard-admin-csr',
        component: AdminCsrView,
        meta: { requiresAdmin: true },
      },
      {
        path: 'admin/sms',
        name: 'dashboard-admin-sms',
        component: AdminSmsView,
        meta: { requiresAdmin: true },
      },
      {
        path: 'admin/packages',
        name: 'dashboard-admin-packages',
        component: AdminPackagesView,
        meta: { requiresAdmin: true },
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
  const role = sessionState.claims?.role;

  if (to.meta.guestOnly && isAuthenticated.value) {
    return dashboardPathByRole(role);
  }

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.requiresAgent && sessionState.claims?.role !== 'agent') {
    return dashboardPathByRole(role);
  }

  if (to.meta.requiresUser && sessionState.claims?.role !== 'user') {
    return dashboardPathByRole(role);
  }

  if (to.meta.requiresAdmin && sessionState.claims?.role !== 'admin') {
    return dashboardPathByRole(role);
  }

  return true;
});

export default router;
