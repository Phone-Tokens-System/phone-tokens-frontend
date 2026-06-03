import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  routeName: 'dashboard-tokens',
  pushMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  clearSessionMock: vi.fn(),
  sessionState: {
    token: 'jwt-token',
    agentId: '',
    claims: {
      userId: 'user-1',
      phone: '79999999997',
      role: 'user',
    },
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: mocks.routeName }),
  useRouter: () => ({ push: mocks.pushMock }),
}));

vi.mock('../lib/api', () => ({
  getCurrentUser: (...args) => mocks.getCurrentUserMock(...args),
}));

vi.mock('../lib/session', () => ({
  clearSession: (...args) => mocks.clearSessionMock(...args),
  setAgentId: vi.fn(),
  sessionState: mocks.sessionState,
}));

let AgentDashboardPage;

beforeAll(async () => {
  AgentDashboardPage = (await import('./AgentDashboardPage.vue')).default;
});

function mountDashboard() {
  return mount(AgentDashboardPage, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
        RouterView: {
          template: '<main data-test="router-view" />',
        },
      },
    },
  });
}

describe('AgentDashboardPage', () => {
  beforeEach(() => {
    mocks.routeName = 'dashboard-tokens';
    mocks.pushMock.mockReset();
    mocks.getCurrentUserMock.mockReset();
    mocks.clearSessionMock.mockReset();
    mocks.sessionState.agentId = '';
    mocks.sessionState.claims = {
      userId: 'user-1',
      phone: '79999999997',
      role: 'user',
    };
  });

  it('renders role navigation in the dashboard header for users', () => {
    const wrapper = mountDashboard();

    const headerNav = wrapper.get('.dash-header .dash-nav');
    expect(headerNav.text()).toContain('My Profile');
    expect(headerNav.text()).toContain('My Tokens');
    expect(headerNav.text()).toContain('My SMS');
    expect(wrapper.find('.dash-sidebar .dash-nav').exists()).toBe(false);
  });

  it('renders agent context in the dashboard header', () => {
    mocks.sessionState.claims = {
      userId: 'agent-user-1',
      phone: '79999999996',
      role: 'agent',
    };
    mocks.sessionState.agentId = 'agent-1';
    mocks.routeName = 'dashboard-sms';

    const wrapper = mountDashboard();

    const headerNav = wrapper.get('.dash-header .dash-nav');
    expect(headerNav.text()).toContain('Certificates');
    expect(headerNav.text()).toContain('SMS');
    expect(headerNav.text()).toContain('Billing');
    expect(wrapper.find('.dash-sidebar').exists()).toBe(false);
    expect(wrapper.get('.dash-header .agent-context').text()).toContain('Agent Context');
    expect(wrapper.get('.dash-header .agent-context').text()).toContain('agent-user-1');
    expect(wrapper.get('.dash-header .agent-context').text()).toContain('agent-1');
  });
});
