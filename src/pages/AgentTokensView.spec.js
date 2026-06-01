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
    mocks.sessionState.agentId = '';
    mocks.sessionState.claims = { userId: 'user-1' };
    const storage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => storage.get(key) || null),
      setItem: vi.fn((key, value) => {
        storage.set(key, String(value));
      }),
      removeItem: vi.fn((key) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

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

  it('offers known agent_id values from session, local storage, query, and loaded tokens', async () => {
    mocks.sessionState.agentId = '22222222-2222-2222-2222-222222222222';
    mocks.routeQuery.agent_id = '11111111-1111-1111-1111-111111111111';
    localStorage.setItem('pt_frontend_known_agent_ids', JSON.stringify(['33333333-3333-3333-3333-333333333333']));
    mocks.getTokensByUserMock.mockResolvedValue([
      {
        id: 'token-1',
        name: 'First Token',
        token: '1234567890abcdef1234567890abcdef',
        permissions: ['sms'],
        status: 'active',
        expires_at: '2026-01-01T00:00:00Z',
        agent_id: '44444444-4444-4444-4444-444444444444',
      },
    ]);

    const wrapper = mount(AgentTokensView, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await flushPromises();

    const select = wrapper.get('select#token-agent-id');
    const values = wrapper
      .findAll('#token-agent-id option')
      .map((option) => option.element.value);

    expect(select.element.value).toBe('11111111-1111-1111-1111-111111111111');
    expect(values).toEqual(expect.arrayContaining([
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
    ]));
    expect(values).not.toContain('00000000-0000-0000-0000-000000000000');
  });

  it('suggests token name and keeps manual edits', async () => {
    const wrapper = mount(AgentTokensView, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await flushPromises();

    const nameInput = wrapper.get('#token-name');
    expect(nameInput.element.value).toMatch(/^Token \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    await nameInput.setValue('Partner token');
    await wrapper.get('select#token-agent-id').setValue('__manual_agent_id__');
    await wrapper.get('input[aria-label="Ввести agent_id вручную"]').setValue('55555555-5555-5555-5555-555555555555');

    expect(wrapper.get('#token-name').element.value).toBe('Partner token');
  });

  it('masks sensitive values while copy uses full values', async () => {
    const wrapper = mount(AgentTokensView, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('12345678...abcdef');
    expect(wrapper.text()).not.toContain('1234567890abcdef1234567890abcdef');
    expect(wrapper.text()).toContain('00000000...000000');
    expect(wrapper.text()).not.toContain('00000000-0000-0000-0000-000000000000');

    await wrapper.get('button[aria-label="Copy full token First Token"]').trigger('click');

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('1234567890abcdef1234567890abcdef');
  });
});
