import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getSmsLogsByAgentMock: vi.fn(),
  sendSmsMock: vi.fn(),
  sendSmsFilteredMock: vi.fn(),
  getUserProfileFiltersMock: vi.fn(),
  getAgentUserProfilesFilteredMock: vi.fn(),
  getDictionaryCountriesMock: vi.fn(),
  getDictionaryRegionsMock: vi.fn(),
  getDictionaryCitiesMock: vi.fn(),
  sessionState: {
    token: 'jwt-token',
    agentId: '00000000-0000-0000-0000-000000000000',
  },
}));

vi.mock('../lib/api', () => ({
  getSmsLogsByAgent: (...args) => mocks.getSmsLogsByAgentMock(...args),
  sendSms: (...args) => mocks.sendSmsMock(...args),
  sendSmsFiltered: (...args) => mocks.sendSmsFilteredMock(...args),
  getUserProfileFilters: (...args) => mocks.getUserProfileFiltersMock(...args),
  getAgentUserProfilesFiltered: (...args) => mocks.getAgentUserProfilesFilteredMock(...args),
  getDictionaryCountries: (...args) => mocks.getDictionaryCountriesMock(...args),
  getDictionaryRegions: (...args) => mocks.getDictionaryRegionsMock(...args),
  getDictionaryCities: (...args) => mocks.getDictionaryCitiesMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let AgentSmsLogsView;

beforeAll(async () => {
  AgentSmsLogsView = (await import('./AgentSmsLogsView.vue')).default;
});

describe('AgentSmsLogsView', () => {
  beforeEach(() => {
    mocks.getSmsLogsByAgentMock.mockReset();
    mocks.sendSmsMock.mockReset();
    mocks.sendSmsFilteredMock.mockReset();
    mocks.getUserProfileFiltersMock.mockReset();
    mocks.getAgentUserProfilesFilteredMock.mockReset();
    mocks.getDictionaryCountriesMock.mockReset();
    mocks.getDictionaryRegionsMock.mockReset();
    mocks.getDictionaryCitiesMock.mockReset();
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

    mocks.getSmsLogsByAgentMock.mockResolvedValue([
      {
        id: 'sms-1',
        external_id: 'ext-1',
        service_name: 'svc-a',
        from: 'Sender',
        token: 'token-1',
        text: 'hello',
        status: 1,
        cost: 1.2,
        date_created: 1700000000,
        date_sent: 1700000001,
      },
      {
        id: 'sms-2',
        external_id: 'ext-2',
        service_name: 'svc-b',
        from: 'Sender',
        token: 'token-2',
        text: 'bye',
        status: 2,
        cost: 1.1,
        date_created: 1700000002,
        date_sent: 1700000003,
      },
    ]);

    mocks.getUserProfileFiltersMock.mockResolvedValue({
      Filters: [
        { Key: 'Gender', Type: 'select', Options: ['male', 'female'] },
        { Key: 'Country', Type: 'select', OptionSource: 'api/v1/dictionary/countries' },
        { Key: 'Region', Type: 'select', OptionSource: 'api/v1/dictionary/regions/?country={country}' },
        { Key: 'City', Type: 'select', OptionSource: 'api/v1/dictionary/cities/?country={country}&region={region}' },
        { Key: 'education', Type: 'select', Options: ['school', 'bachelor', 'master', 'phd'] },
      ],
    });

    mocks.getAgentUserProfilesFilteredMock.mockResolvedValue([
      { token: 'token-1' },
      { token: 'token-2' },
    ]);

    mocks.getDictionaryCountriesMock.mockResolvedValue([
      { id: 'RU', name: 'Russia' },
      { id: 'US', name: 'United States' },
    ]);

    mocks.getDictionaryRegionsMock.mockImplementation(async (countryId) => {
      if (countryId === 'RU') {
        return [{ id: 'NSK', name: 'Novosibirsk Region' }];
      }
      return [];
    });

    mocks.getDictionaryCitiesMock.mockImplementation(async (countryId, regionId) => {
      if (countryId === 'RU' && regionId === 'NSK') {
        return [{ id: 'NSK', name: 'Novosibirsk' }];
      }
      return [];
    });
  });

  it('filters logs by selected status', async () => {
    const wrapper = mount(AgentSmsLogsView);
    await flushPromises();

    expect(wrapper.findAll('tbody tr')).toHaveLength(2);

    await wrapper.get('#sms-filter-status').setValue('1');
    await flushPromises();

    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.text()).toContain('hello');
  });

  it('requires certificate before sending sms', async () => {
    const wrapper = mount(AgentSmsLogsView);
    await flushPromises();

    await wrapper.get('#sms-client-token').setValue('token-1');
    await wrapper.get('#sms-text').setValue('Hello there');
    await wrapper.get('form[aria-label="Форма отправки SMS"]').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.sendSmsMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Укажите certificate.');
  });

  it('lets agent select an existing certificate for single sms', async () => {
    localStorage.setItem(
      'pt_frontend_agent_certificates',
      JSON.stringify([
        {
          id: 'csr-42',
          label: 'CSR #42',
          certificate: '-----BEGIN CERTIFICATE-----\nCERT-42\n-----END CERTIFICATE-----',
          createdAt: '2026-05-29T00:00:00.000Z',
        },
      ]),
    );
    mocks.sendSmsMock.mockResolvedValue({ id: 'sms-3' });

    const wrapper = mount(AgentSmsLogsView);
    await flushPromises();

    expect(wrapper.find('#sms-certificate').exists()).toBe(false);
    await wrapper.get('#sms-certificate-select').setValue('csr-42');
    await wrapper.get('#sms-client-token').setValue('token-1');
    await wrapper.get('#sms-text').setValue('Hello there');
    await wrapper.get('form[aria-label="Форма отправки SMS"]').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.sendSmsMock).toHaveBeenCalledWith('jwt-token', {
      service_name: '',
      certificate: '-----BEGIN CERTIFICATE-----\nCERT-42\n-----END CERTIFICATE-----',
      client_token: 'token-1',
      text: 'Hello there',
    });
  });

  it('submits filtered sms payload as FilterRequest map', async () => {
    mocks.sendSmsFilteredMock.mockResolvedValue([{ id: 'sms-3' }]);

    const wrapper = mount(AgentSmsLogsView);
    await flushPromises();

    await wrapper.get('#sms-filtered-service-name').setValue('svc-filtered');
    await wrapper.get('#sms-filtered-certificate-manual').setValue('CERTIFICATE');
    await wrapper.get('#sms-filtered-text').setValue('Promo message');
    await wrapper.get('#sms-filtered-gender').setValue('male');
    await wrapper.get('#sms-filtered-education').setValue('bachelor');
    await wrapper.get('form[aria-label="Форма отправки SMS по фильтрам"]').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.sendSmsFilteredMock).toHaveBeenCalledWith('jwt-token', {
      service_name: 'svc-filtered',
      certificate: 'CERTIFICATE',
      text: 'Promo message',
      agent_id: '00000000-0000-0000-0000-000000000000',
      filters: {
        filters: {
          gender: 'male',
          education: 'bachelor',
        },
      },
    });
    expect(wrapper.text()).toContain('Отправлено SMS по фильтрам: 1');
  });

  it('falls back to manual filtered send when send_filtered is not supported', async () => {
    mocks.sendSmsFilteredMock.mockRejectedValue({
      status: 500,
      message: 'client_token is required',
    });
    mocks.sendSmsMock.mockResolvedValue({ id: 'sms-item' });

    const wrapper = mount(AgentSmsLogsView);
    await flushPromises();

    await wrapper.get('#sms-filtered-certificate-manual').setValue('CERTIFICATE');
    await wrapper.get('#sms-filtered-text').setValue('Promo message');
    await wrapper.get('#sms-filtered-gender').setValue('male');
    await wrapper.get('form[aria-label="Форма отправки SMS по фильтрам"]').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.getAgentUserProfilesFilteredMock).toHaveBeenCalledWith('jwt-token', {
      filters: {
        gender: 'male',
      },
    });
    expect(mocks.sendSmsMock).toHaveBeenCalledTimes(2);
    expect(mocks.sendSmsMock).toHaveBeenNthCalledWith(1, 'jwt-token', {
      service_name: '',
      certificate: 'CERTIFICATE',
      client_token: 'token-1',
      text: 'Promo message',
    });
    expect(mocks.sendSmsMock).toHaveBeenNthCalledWith(2, 'jwt-token', {
      service_name: '',
      certificate: 'CERTIFICATE',
      client_token: 'token-2',
      text: 'Promo message',
    });
    expect(wrapper.text()).toContain('Отправлено SMS по фильтрам: 2');
  });
});
