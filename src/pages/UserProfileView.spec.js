import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getUserProfileFiltersMock: vi.fn(),
  getDictionaryCountriesMock: vi.fn(),
  getDictionaryRegionsMock: vi.fn(),
  getDictionaryCitiesMock: vi.fn(),
  getMyUserProfileMock: vi.fn(),
  createMyUserProfileMock: vi.fn(),
  updateMyUserProfileMock: vi.fn(),
  sessionState: {
    token: 'jwt-token',
    claims: { userId: 'user-1', role: 'user' },
  },
}));

vi.mock('../lib/api', () => ({
  getUserProfileFilters: (...args) => mocks.getUserProfileFiltersMock(...args),
  getDictionaryCountries: (...args) => mocks.getDictionaryCountriesMock(...args),
  getDictionaryRegions: (...args) => mocks.getDictionaryRegionsMock(...args),
  getDictionaryCities: (...args) => mocks.getDictionaryCitiesMock(...args),
  getMyUserProfile: (...args) => mocks.getMyUserProfileMock(...args),
  createMyUserProfile: (...args) => mocks.createMyUserProfileMock(...args),
  updateMyUserProfile: (...args) => mocks.updateMyUserProfileMock(...args),
}));

vi.mock('../lib/session', () => ({
  sessionState: mocks.sessionState,
}));

let UserProfileView;

beforeAll(async () => {
  UserProfileView = (await import('./UserProfileView.vue')).default;
});

describe('UserProfileView', () => {
  beforeEach(() => {
    mocks.getUserProfileFiltersMock.mockReset();
    mocks.getDictionaryCountriesMock.mockReset();
    mocks.getDictionaryRegionsMock.mockReset();
    mocks.getDictionaryCitiesMock.mockReset();
    mocks.getMyUserProfileMock.mockReset();
    mocks.createMyUserProfileMock.mockReset();
    mocks.updateMyUserProfileMock.mockReset();

    mocks.getUserProfileFiltersMock.mockResolvedValue({
      Filters: [
        { Key: 'Gender', Type: 'select', Options: ['male', 'female'] },
        { Key: 'education', Type: 'select', Options: ['school', 'bachelor'] },
      ],
    });

    mocks.getDictionaryCountriesMock.mockResolvedValue([
      { id: 'RU', name: 'Russia' },
    ]);
    mocks.getDictionaryRegionsMock.mockImplementation(async (countryId) => (
      countryId === 'RU' ? [{ id: 'NSK', name: 'Novosibirsk Region' }] : []
    ));
    mocks.getDictionaryCitiesMock.mockImplementation(async (countryId, regionId) => (
      countryId === 'RU' && regionId === 'NSK' ? [{ id: 'NSK', name: 'Novosibirsk' }] : []
    ));
    mocks.getMyUserProfileMock.mockResolvedValue({});
    mocks.createMyUserProfileMock.mockResolvedValue({});
    mocks.updateMyUserProfileMock.mockResolvedValue({});
  });

  it('submits profile payload with selected ids', async () => {
    const wrapper = mount(UserProfileView);
    await flushPromises();

    await wrapper.get('#profile-birth-year').setValue('1995');
    await wrapper.get('#profile-birth-month').setValue('01');
    await wrapper.get('#profile-birth-day').setValue('15');
    await wrapper.get('#profile-gender').setValue('male');
    await wrapper.get('#profile-country').setValue('RU');
    await flushPromises();
    await wrapper.get('#profile-region').setValue('NSK');
    await flushPromises();
    await wrapper.get('#profile-city').setValue('NSK');
    await wrapper.get('#profile-education').setValue('bachelor');

    await wrapper.get('form[aria-label="Форма профиля пользователя"]').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.createMyUserProfileMock).toHaveBeenCalledWith('jwt-token', {
      birth_date: '1995-01-15',
      gender: 'male',
      country: 'RU',
      region: 'NSK',
      city: 'NSK',
      education: 'bachelor',
    });
  });

  it('keeps gender and education selectable when filters endpoint is unavailable', async () => {
    mocks.getUserProfileFiltersMock.mockRejectedValue(new Error('not found'));

    const wrapper = mount(UserProfileView);
    await flushPromises();

    await wrapper.get('#profile-birth-year').setValue('1995');
    await wrapper.get('#profile-birth-month').setValue('01');
    await wrapper.get('#profile-birth-day').setValue('15');
    await wrapper.get('#profile-gender').setValue('female');
    await wrapper.get('#profile-country').setValue('RU');
    await flushPromises();
    await wrapper.get('#profile-region').setValue('NSK');
    await flushPromises();
    await wrapper.get('#profile-city').setValue('NSK');
    await wrapper.get('#profile-education').setValue('school');

    await wrapper.get('form[aria-label="Форма профиля пользователя"]').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.createMyUserProfileMock).toHaveBeenCalledWith('jwt-token', {
      birth_date: '1995-01-15',
      gender: 'female',
      country: 'RU',
      region: 'NSK',
      city: 'NSK',
      education: 'school',
    });
  });

  it('keeps selected education when backend profile response omits education field', async () => {
    mocks.getMyUserProfileMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        birth_date: '1995-01-15',
        gender: 'male',
        country: 'RU',
        region: 'NSK',
        city: 'NSK',
        age: 30,
      });

    const wrapper = mount(UserProfileView);
    await flushPromises();

    await wrapper.get('#profile-education').setValue('bachelor');
    await wrapper.get('button.btn.btn-secondary').trigger('click');
    await flushPromises();

    expect(wrapper.get('#profile-education').element.value).toBe('bachelor');
  });
});
