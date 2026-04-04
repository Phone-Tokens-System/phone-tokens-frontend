import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getAdminSmsLogsMock: vi.fn(),
  refreshAdminSmsFromProviderMock: vi.fn(),
  sessionState: {
    token: 'admin-jwt-token',
  },
}));

vi.mock('../lib/api', () => ({
  getAdminSmsLogs: (...args) => mocks.getAdminSmsLogsMock(...args),
  refreshAdminSmsFromProvider: (...args) => mocks.refreshAdminSmsFromProviderMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let AdminSmsView;

beforeAll(async () => {
  AdminSmsView = (await import('./AdminSmsView.vue')).default;
});

describe('AdminSmsView', () => {
  beforeEach(() => {
    mocks.getAdminSmsLogsMock.mockReset();
    mocks.refreshAdminSmsFromProviderMock.mockReset();
    mocks.sessionState.token = 'admin-jwt-token';
  });

  it('loads sms logs and filters by status', async () => {
    mocks.getAdminSmsLogsMock.mockResolvedValue([
      {
        id: 'sms-1',
        service_name: 'svc-a',
        service_id: 'agent-1',
        token: 'token-1',
        text: 'hello',
        status: 1,
        date_created: 1700000000,
      },
      {
        id: 'sms-2',
        service_name: 'svc-b',
        service_id: 'agent-2',
        token: 'token-2',
        text: 'bye',
        status: 2,
        date_created: 1700000001,
      },
    ]);

    const wrapper = mount(AdminSmsView);
    await flushPromises();

    expect(mocks.getAdminSmsLogsMock).toHaveBeenCalledWith('admin-jwt-token');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);

    await wrapper.get('select').setValue('1');
    await flushPromises();

    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.text()).toContain('token-1');
  });

  it('syncs sms from provider and reloads logs', async () => {
    mocks.getAdminSmsLogsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'sms-10',
          service_name: 'svc-sync',
          service_id: 'agent-sync',
          token: 'token-sync',
          text: 'synced',
          status: 1,
          date_created: 1700000010,
        },
      ]);
    mocks.refreshAdminSmsFromProviderMock.mockResolvedValue([]);

    const wrapper = mount(AdminSmsView);
    await flushPromises();

    await wrapper.get('.section-actions .btn.btn-secondary').trigger('click');
    await flushPromises();

    expect(mocks.refreshAdminSmsFromProviderMock).toHaveBeenCalledWith('admin-jwt-token');
    expect(mocks.getAdminSmsLogsMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('SMS синхронизированы с провайдером');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
  });
});
