import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  pushMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.pushMock }),
}));

vi.mock('../lib/api', () => ({
  register: (...args) => mocks.registerMock(...args),
}));

let RegisterPage;

beforeAll(async () => {
  RegisterPage = (await import('./RegisterPage.vue')).default;
});

describe('RegisterPage', () => {
  beforeEach(() => {
    mocks.pushMock.mockReset();
    mocks.registerMock.mockReset();
  });

  it('shows validation error for agent role when service_name/email are empty', async () => {
    const wrapper = mount(RegisterPage, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await wrapper.get('#register-role').setValue('agent');
    await wrapper.get('#register-phone').setValue('79991112233');
    await wrapper.get('#register-password').setValue('secret123');
    await wrapper.get('form').trigger('submit.prevent');

    expect(mocks.registerMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('обязательны поля service_name и email');
  });

  it('submits user registration with expected payload', async () => {
    mocks.registerMock.mockResolvedValue({});

    const wrapper = mount(RegisterPage, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await wrapper.get('#register-role').setValue('user');
    await wrapper.get('#register-phone').setValue('79990000000');
    await wrapper.get('#register-password').setValue('pass');
    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.registerMock).toHaveBeenCalledWith({
      phone: '79990000000',
      password: 'pass',
      role: 'user',
      service_name: '',
      email: '',
    });
  });
});
