import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  pushMock: vi.fn(),
  loginMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  clearSessionMock: vi.fn(),
  setTokenMock: vi.fn(),
  setAgentIdMock: vi.fn(),
  routeQuery: {},
  sessionState: {
    token: '',
    claims: { role: '' },
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({ push: mocks.pushMock }),
}));

vi.mock('../lib/api', () => ({
  login: (...args) => mocks.loginMock(...args),
  getCurrentUser: (...args) => mocks.getCurrentUserMock(...args),
}));

vi.mock('../lib/session', () => ({
  clearSession: (...args) => mocks.clearSessionMock(...args),
  setToken: (...args) => mocks.setTokenMock(...args),
  setAgentId: (...args) => mocks.setAgentIdMock(...args),
  sessionState: mocks.sessionState,
}));

let LoginPage;

beforeAll(async () => {
  LoginPage = (await import('./LoginPage.vue')).default;
});

describe('LoginPage', () => {
  beforeEach(() => {
    mocks.pushMock.mockReset();
    mocks.loginMock.mockReset();
    mocks.getCurrentUserMock.mockReset();
    mocks.clearSessionMock.mockReset();
    mocks.setTokenMock.mockReset();
    mocks.setAgentIdMock.mockReset();
    mocks.routeQuery = {};
    mocks.sessionState.token = '';
    mocks.sessionState.claims = { role: '' };
    mocks.setTokenMock.mockImplementation((token) => {
      mocks.sessionState.token = token;
    });
  });

  it('shows role mismatch error when selected role differs from account role', async () => {
    mocks.loginMock.mockResolvedValue({ token: 'jwt-token' });
    mocks.getCurrentUserMock.mockResolvedValue({ role: 'user' });

    const wrapper = mount(LoginPage, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await wrapper.get('#login-role').setValue('agent');
    await wrapper.get('#login-phone').setValue('79991112233');
    await wrapper.get('#login-password').setValue('pwd');
    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.clearSessionMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Вы выбрали роль "agent"');
    expect(mocks.pushMock).not.toHaveBeenCalled();
  });

  it('selects user role when login redirects back to SSO', async () => {
    mocks.routeQuery = {
      redirect: '/sso?agent_id=11111111-2222-3333-4444-555555555555&redirect_uri=http%3A%2F%2Fexample.test%2Fcallback',
    };

    const wrapper = mount(LoginPage, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.get('#login-role').element.value).toBe('user');
  });
});
