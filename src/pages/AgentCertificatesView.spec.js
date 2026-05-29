import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  createCsrRequestMock: vi.fn(),
  getSignedCertificateMock: vi.fn(),
  sessionState: {
    token: 'agent-jwt-token',
    agentId: '6d88b995-41cb-4103-9fe2-556e7b31280c',
  },
}));

vi.mock('../lib/api', () => ({
  createCsrRequest: (...args) => mocks.createCsrRequestMock(...args),
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
    mocks.createCsrRequestMock.mockReset();
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

  it('stores a fetched signed certificate for SMS selection', async () => {
    mocks.getSignedCertificateMock.mockResolvedValue({
      certificate: '-----BEGIN CERTIFICATE-----\nCERT-42\n-----END CERTIFICATE-----',
    });

    const wrapper = mount(AgentCertificatesView);

    await wrapper.get('input[placeholder="123"]').setValue('42');
    await wrapper.get('form[aria-label="Форма получения сертификата"]').trigger('submit.prevent');
    await flushPromises();

    const stored = JSON.parse(localStorage.setItem.mock.calls.find(([key]) => key === 'pt_frontend_agent_certificates')[1]);
    expect(stored[0]).toMatchObject({
      id: 'csr-42',
      label: 'CSR #42',
      certificate: '-----BEGIN CERTIFICATE-----\nCERT-42\n-----END CERTIFICATE-----',
    });
    expect(wrapper.text()).toContain('Сертификат сохранен для отправки SMS.');
  });
});
