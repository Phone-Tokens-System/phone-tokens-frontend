import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getAdminCsrRequestsMock: vi.fn(),
  approveAdminCsrRequestMock: vi.fn(),
  replaceMock: vi.fn(),
  routeQuery: {},
  sessionState: {
    token: 'admin-jwt-token',
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({
    replace: (...args) => {
      mocks.replaceMock(...args);
      const target = args[0] || {};
      const nextQuery = target.query || {};
      Object.keys(mocks.routeQuery).forEach((key) => {
        delete mocks.routeQuery[key];
      });
      Object.assign(mocks.routeQuery, nextQuery);
      return Promise.resolve();
    },
  }),
}));

vi.mock('../lib/api', () => ({
  getAdminCsrRequests: (...args) => mocks.getAdminCsrRequestsMock(...args),
  approveAdminCsrRequest: (...args) => mocks.approveAdminCsrRequestMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let AdminCsrView;

beforeAll(async () => {
  AdminCsrView = (await import('./AdminCsrView.vue')).default;
});

describe('AdminCsrView', () => {
  beforeEach(() => {
    mocks.getAdminCsrRequestsMock.mockReset();
    mocks.approveAdminCsrRequestMock.mockReset();
    mocks.replaceMock.mockReset();
    mocks.sessionState.token = 'admin-jwt-token';
    Object.keys(mocks.routeQuery).forEach((key) => {
      delete mocks.routeQuery[key];
    });
  });

  it('loads csr requests and filters by status', async () => {
    mocks.getAdminCsrRequestsMock.mockResolvedValue([
      { id: 10, email: 'a@example.com', status: 'PENDING', csr: 'CSR-10' },
      { id: 11, email: 'b@example.com', status: 'APPROVED', csr: 'CSR-11' },
    ]);

    const wrapper = mount(AdminCsrView);
    await flushPromises();

    expect(mocks.getAdminCsrRequestsMock).toHaveBeenCalledWith('admin-jwt-token');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);

    await wrapper.get('select').setValue('APPROVED');
    await flushPromises();

    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.text()).toContain('11');
  });

  it('approves pending request and refreshes table', async () => {
    mocks.getAdminCsrRequestsMock
      .mockResolvedValueOnce([
        { id: 42, email: 'pending@example.com', status: 'PENDING', csr: 'CSR-42' },
      ])
      .mockResolvedValueOnce([
        { id: 42, email: 'pending@example.com', status: 'APPROVED', csr: 'CSR-42' },
      ]);
    mocks.approveAdminCsrRequestMock.mockResolvedValue({});

    const wrapper = mount(AdminCsrView);
    await flushPromises();

    await wrapper.get('tbody .btn.btn-secondary').trigger('click');
    await flushPromises();

    expect(mocks.approveAdminCsrRequestMock).toHaveBeenCalledWith('admin-jwt-token', 42);
    expect(mocks.replaceMock).toHaveBeenCalled();
    expect(mocks.getAdminCsrRequestsMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('CSR #42 одобрен');
  });
});
