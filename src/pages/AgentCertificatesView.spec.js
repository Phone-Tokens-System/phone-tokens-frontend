import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  createCsrRequestMock: vi.fn(),
  getCurrentSignedCertificateMock: vi.fn(),
  getSignedCertificateMock: vi.fn(),
  sessionState: {
    token: 'agent-jwt-token',
    agentId: '6d88b995-41cb-4103-9fe2-556e7b31280c',
  },
}));

vi.mock('../lib/api', () => ({
  createCsrRequest: (...args) => mocks.createCsrRequestMock(...args),
  getCurrentSignedCertificate: (...args) => mocks.getCurrentSignedCertificateMock(...args),
  getSignedCertificate: (...args) => mocks.getSignedCertificateMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let AgentCertificatesView;

beforeAll(async () => {
  AgentCertificatesView = (await import('./AgentCertificatesView.vue')).default;
});

describe('AgentCertificatesView', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.createCsrRequestMock.mockReset();
    mocks.getCurrentSignedCertificateMock.mockReset();
    mocks.getSignedCertificateMock.mockReset();
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
  });

  it('stores a current signed certificate for SMS selection', async () => {
    mocks.getCurrentSignedCertificateMock.mockResolvedValue({
      csr_id: 42,
      certificate: '-----BEGIN CERTIFICATE-----\nCERT-42\n-----END CERTIFICATE-----',
    });

    const wrapper = mount(AgentCertificatesView);

    await wrapper.get('form[aria-label="Форма проверки новых сертификатов"]').trigger('submit.prevent');
    await flushPromises();

    const stored = JSON.parse(localStorage.setItem.mock.calls.find(([key]) => key === 'pt_frontend_agent_certificates')[1]);
    expect(stored[0]).toMatchObject({
      id: 'csr-42',
      label: 'CSR #42',
      certificate: '-----BEGIN CERTIFICATE-----\nCERT-42\n-----END CERTIFICATE-----',
    });
    expect(wrapper.text()).toContain('Новые сертификаты проверены.');
  });

  it('does not show csr history from another agent', async () => {
    mocks.getCurrentSignedCertificateMock.mockRejectedValue({ status: 404 });
    localStorage.setItem(
      'pt_frontend_csr_history',
      JSON.stringify([{ id: 1, email: 'foreign@old-key.test', createdAt: '2026-06-03T10:00:00.000Z' }]),
    );
    localStorage.setItem(
      'pt_frontend_csr_history:another-agent',
      JSON.stringify([{ id: 2, email: 'foreign@scoped-key.test', createdAt: '2026-06-03T10:00:00.000Z' }]),
    );

    const wrapper = mount(AgentCertificatesView);
    await flushPromises();

    expect(wrapper.text()).not.toContain('foreign@old-key.test');
    expect(wrapper.text()).not.toContain('foreign@scoped-key.test');
    expect(wrapper.text()).not.toContain('Последние CSR requests');
  });

  it('polls for newly approved certificates while page stays open', async () => {
    vi.useFakeTimers();
    mocks.getCurrentSignedCertificateMock.mockResolvedValue({
      csr_id: 43,
      certificate: '-----BEGIN CERTIFICATE-----\nCERT-43\n-----END CERTIFICATE-----',
    });

    const wrapper = mount(AgentCertificatesView);
    await flushPromises();
    expect(mocks.getCurrentSignedCertificateMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    expect(mocks.getCurrentSignedCertificateMock).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    vi.useRealTimers();
  });
});
