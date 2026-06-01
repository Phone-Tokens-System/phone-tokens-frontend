import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  completeSsoMock: vi.fn(),
  assignMock: vi.fn(),
  routeQuery: {},
  sessionState: {
    token: 'jwt-token',
    claims: { userId: 'user-1', role: 'user' },
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
}));

vi.mock('../lib/api', () => ({
  completeSso: (...args) => mocks.completeSsoMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let SsoAuthorizePage;

beforeAll(async () => {
  SsoAuthorizePage = (await import('./SsoAuthorizePage.vue')).default;
});

describe('SsoAuthorizePage', () => {
  beforeEach(() => {
    mocks.completeSsoMock.mockReset();
    mocks.assignMock.mockReset();
    mocks.routeQuery = {
      agent_id: '11111111-2222-3333-4444-555555555555',
      redirect_uri: 'http://external.test/callback',
      state: 'opaque-state',
    };
    vi.stubGlobal('location', { assign: mocks.assignMock });
  });

  it('shows validation error when required query params are missing', () => {
    mocks.routeQuery = { state: 'opaque-state' };

    const wrapper = mount(SsoAuthorizePage);

    expect(wrapper.text()).toContain('agent_id и redirect_uri обязательны');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('confirms SSO token issue and redirects to external service', async () => {
    mocks.completeSsoMock.mockResolvedValue({
      redirect_url: 'http://external.test/callback?token=issued-token&state=opaque-state',
      token: 'issued-token',
    });

    const wrapper = mount(SsoAuthorizePage);

    await flushPromises();
    expect(wrapper.get('#sso-token-name').element.value).toMatch(/^SSO 11111111\.\.\.555555 \d{4}-\d{2}-\d{2}$/);

    await wrapper.get('form[aria-label="Подтверждение SSO"]').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.completeSsoMock).toHaveBeenCalledWith('jwt-token', {
      agent_id: '11111111-2222-3333-4444-555555555555',
      redirect_uri: 'http://external.test/callback',
      state: 'opaque-state',
      token_name: expect.stringMatching(/^SSO 11111111\.\.\.555555 \d{4}-\d{2}-\d{2}$/),
      permissions: ['sms'],
      ttl_days: 365,
    });
    expect(mocks.assignMock).toHaveBeenCalledWith('http://external.test/callback?token=issued-token&state=opaque-state');
  });

  it('shows backend error and does not redirect', async () => {
    mocks.completeSsoMock.mockRejectedValue(new Error('unknown agent'));

    const wrapper = mount(SsoAuthorizePage);

    await wrapper.get('form[aria-label="Подтверждение SSO"]').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('unknown agent');
    expect(mocks.assignMock).not.toHaveBeenCalled();
  });
});
