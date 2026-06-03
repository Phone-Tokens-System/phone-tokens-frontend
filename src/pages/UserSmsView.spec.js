import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getTokensByUserMock: vi.fn(),
  getSmsLogsByTokenMock: vi.fn(),
  sessionState: {
    token: 'jwt-token',
    claims: { userId: 'user-1' },
  },
}));

vi.mock('../lib/api', () => ({
  getTokensByUser: (...args) => mocks.getTokensByUserMock(...args),
  getSmsLogsByToken: (...args) => mocks.getSmsLogsByTokenMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let UserSmsView;

beforeAll(async () => {
  UserSmsView = (await import('./UserSmsView.vue')).default;
});

describe('UserSmsView', () => {
  beforeEach(() => {
    mocks.getTokensByUserMock.mockReset();
    mocks.getSmsLogsByTokenMock.mockReset();
    mocks.sessionState.token = 'jwt-token';
    mocks.sessionState.claims = { userId: 'user-1' };

    mocks.getTokensByUserMock.mockResolvedValue([
      {
        id: 'token-1',
        name: 'Primary token',
        token: 'client-token-1',
        agent_id: 'agent-1',
      },
      {
        id: 'token-2',
        name: 'Secondary token',
        token: 'client-token-2',
        agent_id: 'agent-2',
      },
    ]);

    mocks.getSmsLogsByTokenMock.mockImplementation(async (_jwt, tokenValue) => {
      if (tokenValue === 'client-token-1') {
        return [
          {
            id: 'sms-1',
            service_name: 'agent-service',
            from: '+7999999996',
            token: 'client-token-1',
            text: 'hello from agent',
            status: 1,
            date_created: 1700000000,
          },
        ];
      }

      return [];
    });
  });

  it('loads user tokens and renders sms addressed to those tokens', async () => {
    const wrapper = mount(UserSmsView);

    await flushPromises();
    await flushPromises();

    expect(mocks.getTokensByUserMock).toHaveBeenCalledWith('jwt-token', 'user-1');
    expect(mocks.getSmsLogsByTokenMock).toHaveBeenCalledWith('jwt-token', 'client-token-1');
    expect(mocks.getSmsLogsByTokenMock).toHaveBeenCalledWith('jwt-token', 'client-token-2');
    expect(wrapper.text()).toContain('Показано SMS: 1');
    expect(wrapper.text()).toContain('Primary token');
    expect(wrapper.text()).toContain('agent-service');
    expect(wrapper.text()).toContain('hello from agent');
  });
});
