import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getTokensByUserMock: vi.fn(),
  createUserTokenMock: vi.fn(),
  deleteUserTokenMock: vi.fn(),
  freezeUserTokenMock: vi.fn(),
  unfreezeUserTokenMock: vi.fn(),
  updateUserTokenTTLMock: vi.fn(),
  routeQuery: {},
  sessionState: {
    token: 'jwt-token',
    agentId: '',
    claims: { userId: 'user-1' },
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
}));

vi.mock('../lib/api', () => ({
  getTokensByUser: (...args) => mocks.getTokensByUserMock(...args),
  createUserToken: (...args) => mocks.createUserTokenMock(...args),
  deleteUserToken: (...args) => mocks.deleteUserTokenMock(...args),
  freezeUserToken: (...args) => mocks.freezeUserTokenMock(...args),
  unfreezeUserToken: (...args) => mocks.unfreezeUserTokenMock(...args),
  updateUserTokenTTL: (...args) => mocks.updateUserTokenTTLMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let AgentTokensView;

beforeAll(async () => {
  AgentTokensView = (await import('./AgentTokensView.vue')).default;
});

describe('AgentTokensView', () => {
  beforeEach(() => {
    mocks.getTokensByUserMock.mockReset();
    mocks.createUserTokenMock.mockReset();
    mocks.deleteUserTokenMock.mockReset();
    mocks.freezeUserTokenMock.mockReset();
    mocks.unfreezeUserTokenMock.mockReset();
    mocks.updateUserTokenTTLMock.mockReset();
    delete mocks.routeQuery.agent_id;

    mocks.getTokensByUserMock.mockResolvedValue([
      {
        id: 'token-1',
        name: 'First Token',
        token: '1234567890abcdef1234567890abcdef',
        permissions: ['sms', 'calls'],
        status: 'active',
        expires_at: '2026-01-01T00:00:00Z',
        agent_id: '00000000-0000-0000-0000-000000000000',
      },
    ]);
  });

  it('renders row refresh button and reloads tokens on click', async () => {
    const wrapper = mount(AgentTokensView, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain('Refresh');

    await wrapper.find('button[aria-label="Refresh token First Token"]').trigger('click');
    await flushPromises();

    expect(mocks.getTokensByUserMock).toHaveBeenCalledTimes(2);
  });

  it('fills agent_id field from route query param', async () => {
    mocks.routeQuery.agent_id = '11111111-2222-3333-4444-555555555555';

    const wrapper = mount(AgentTokensView, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('#token-agent-id').element.value).toBe('11111111-2222-3333-4444-555555555555');
  });
});
