<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import BaseFormField from '../components/base/BaseFormField.vue';
import {
  createMyUserProfile,
  getDictionaryCities,
  getDictionaryCountries,
  getDictionaryRegions,
  getMyUserProfile,
  getUserProfileFilters,
} from '../lib/api';
import { sessionState } from '../lib/session';

const PROFILE_CACHE_PREFIX = 'pt_frontend_user_profile_cache:';

const FALLBACK_FILTER_DEFINITIONS = Object.freeze([
  { key: 'Gender', type: 'select', options: ['male', 'female'] },
  { key: 'Country', type: 'select', option_source: 'api/v1/dictionary/countries' },
  { key: 'Region', type: 'select', option_source: 'api/v1/dictionary/regions/?country={country}' },
  { key: 'City', type: 'select', option_source: 'api/v1/dictionary/cities/?country={country}&region={region}' },
  { key: 'education', type: 'select', options: ['school', 'bachelor', 'master', 'phd'] },
]);

const loadingProfile = ref(false);
const loadingFilters = ref(false);
const loadingCountries = ref(false);
const loadingRegions = ref(false);
const loadingCities = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');

const profileExists = ref(false);
const serverAge = ref(null);
const lastLoadedProfile = ref(null);
const isHydratingLocation = ref(false);

const countryOptions = ref([]);
const regionOptions = ref([]);
const cityOptions = ref([]);
const genderOptions = ref([]);
const educationOptions = ref([]);

const form = reactive({
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  gender: '',
  country: '',
  region: '',
  city: '',
  education: '',
});

function getProfileCacheKey() {
  const userId = String(sessionState.claims?.userId || '').trim();
  return userId ? `${PROFILE_CACHE_PREFIX}${userId}` : '';
}

function readProfileCache() {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return null;
  }

  const key = getProfileCacheKey();
  if (!key) {
    return null;
  }

  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      birthDate: String(parsed?.birthDate || '').trim(),
      gender: String(parsed?.gender || '').trim(),
      country: String(parsed?.country || '').trim(),
      region: String(parsed?.region || '').trim(),
      city: String(parsed?.city || '').trim(),
      education: String(parsed?.education || '').trim(),
    };
  } catch {
    return null;
  }
}

function writeProfileCache(profile) {
  if (
    typeof localStorage === 'undefined' ||
    typeof localStorage.setItem !== 'function'
  ) {
    return;
  }

  const key = getProfileCacheKey();
  if (!key) {
    return;
  }

  localStorage.setItem(
    key,
    JSON.stringify({
      birthDate: String(profile?.birthDate || '').trim(),
      gender: String(profile?.gender || '').trim(),
      country: String(profile?.country || '').trim(),
      region: String(profile?.region || '').trim(),
      city: String(profile?.city || '').trim(),
      education: String(profile?.education || '').trim(),
    }),
  );
}

function normalizeFilterKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function capitalizeWords(value) {
  return String(value || '')
    .trim()
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
}

function normalizeSelectOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => {
      if (typeof option === 'string') {
        const value = option.trim();
        return {
          value,
          label: capitalizeWords(value),
        };
      }

      const value = String(option?.value ?? option?.id ?? '').trim();
      const label = String(option?.label ?? option?.name ?? '').trim() || capitalizeWords(value);
      return {
        value,
        label,
      };
    })
    .filter((option) => option.value);
}

function normalizeFilterDefinitions(payload) {
  const source = Array.isArray(payload?.filters)
    ? payload.filters
    : Array.isArray(payload?.Filters)
      ? payload.Filters
      : [];

  return source
    .map((item) => {
      const options = item?.options ?? item?.Options ?? [];
      return {
        key: String(item?.key ?? item?.Key ?? '').trim(),
        type: String(item?.type ?? item?.Type ?? '').trim().toLowerCase(),
        options: normalizeSelectOptions(options),
        optionSource: String(item?.option_source ?? item?.OptionSource ?? '').trim(),
      };
    })
    .filter((item) => item.key);
}

function normalizeNamedOptions(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => ({
      value: String(item?.id ?? '').trim(),
      label: String(item?.name ?? '').trim(),
    }))
    .filter((item) => item.value && item.label);
}

function normalizeBirthDateParts(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directMatch) {
    return {
      year: directMatch[1],
      month: directMatch[2],
      day: directMatch[3],
    };
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');

  if (year < 1900) {
    return null;
  }

  return {
    year: String(year),
    month,
    day,
  };
}

function normalizeProfilePayload(payload) {
  const birthDateRaw = payload?.birth_date ?? payload?.BirthDate ?? '';
  const birthDateParts = normalizeBirthDateParts(birthDateRaw);
  const ageValue = Number(payload?.age ?? payload?.Age);
  const hasEducationField =
    payload != null &&
    (Object.prototype.hasOwnProperty.call(payload, 'education') ||
      Object.prototype.hasOwnProperty.call(payload, 'Education'));

  return {
    birthDate: birthDateParts ? `${birthDateParts.year}-${birthDateParts.month}-${birthDateParts.day}` : '',
    birthDateParts,
    age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null,
    gender: String(payload?.gender ?? payload?.Gender ?? '').trim(),
    country: String(payload?.country ?? payload?.Country ?? '').trim(),
    region: String(payload?.region ?? payload?.Region ?? '').trim(),
    city: String(payload?.city ?? payload?.City ?? '').trim(),
    education: hasEducationField ? String(payload?.education ?? payload?.Education ?? '').trim() : '',
    educationProvided: hasEducationField,
  };
}

function isProfileFilled(profile) {
  return Boolean(
    profile.birthDate ||
      profile.gender ||
      profile.country ||
      profile.region ||
      profile.city ||
      profile.education,
  );
}

function buildBirthDateString() {
  const year = String(form.birthYear || '').trim();
  const month = String(form.birthMonth || '').trim();
  const day = String(form.birthDay || '').trim();

  if (!year || !month || !day) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

function calculateAgeByBirthDate(birthDate) {
  if (!birthDate) {
    return null;
  }

  const [year, month, day] = birthDate.split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDelta = now.getMonth() + 1 - month;
  const dayDelta = now.getDate() - day;
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function applyFilterDefinitions(definitions) {
  const byKey = {};
  for (const definition of definitions) {
    byKey[normalizeFilterKey(definition.key)] = {
      ...definition,
      options: normalizeSelectOptions(definition?.options ?? []),
    };
  }

  genderOptions.value = byKey.gender?.options?.length
    ? byKey.gender.options
    : normalizeSelectOptions(['male', 'female']);
  educationOptions.value = byKey.education?.options?.length
    ? byKey.education.options
    : normalizeSelectOptions(['school', 'bachelor', 'master', 'phd']);
}

async function loadFilterDefinitions() {
  loadingFilters.value = true;
  try {
    const payload = await getUserProfileFilters(sessionState.token);
    const definitions = normalizeFilterDefinitions(payload);
    applyFilterDefinitions(definitions.length ? definitions : FALLBACK_FILTER_DEFINITIONS);
  } catch {
    applyFilterDefinitions(FALLBACK_FILTER_DEFINITIONS);
  } finally {
    loadingFilters.value = false;
  }
}

async function loadCountries() {
  loadingCountries.value = true;
  try {
    const payload = await getDictionaryCountries();
    countryOptions.value = normalizeNamedOptions(payload);
  } catch {
    countryOptions.value = [];
  } finally {
    loadingCountries.value = false;
  }
}

async function loadRegions(countryId) {
  if (!countryId) {
    regionOptions.value = [];
    return;
  }

  loadingRegions.value = true;
  try {
    const payload = await getDictionaryRegions(countryId);
    regionOptions.value = normalizeNamedOptions(payload);
  } catch {
    regionOptions.value = [];
  } finally {
    loadingRegions.value = false;
  }
}

async function loadCities(countryId, regionId) {
  if (!countryId || !regionId) {
    cityOptions.value = [];
    return;
  }

  loadingCities.value = true;
  try {
    const payload = await getDictionaryCities(countryId, regionId);
    cityOptions.value = normalizeNamedOptions(payload);
  } catch {
    cityOptions.value = [];
  } finally {
    loadingCities.value = false;
  }
}

async function hydrateLocation(countryId, regionId, cityId) {
  isHydratingLocation.value = true;
  form.country = countryId || '';
  form.region = '';
  form.city = '';

  await loadRegions(form.country);
  form.region = regionId || '';

  await loadCities(form.country, form.region);
  form.city = cityId || '';
  isHydratingLocation.value = false;
}

async function fetchProfile() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  loadingProfile.value = true;
  error.value = '';

  try {
    const payload = await getMyUserProfile(sessionState.token);
    const profile = normalizeProfilePayload(payload);
    const cachedProfile = readProfileCache();
    const resolvedEducation = profile.educationProvided
      ? profile.education
      : profile.education || cachedProfile?.education || form.education || lastLoadedProfile.value?.education || '';
    const mergedProfile = {
      ...profile,
      education: resolvedEducation,
    };

    lastLoadedProfile.value = mergedProfile;
    profileExists.value = isProfileFilled(mergedProfile);
    serverAge.value = mergedProfile.age;

    form.gender = mergedProfile.gender;
    form.education = mergedProfile.education;
    form.birthYear = mergedProfile.birthDateParts?.year || '';
    form.birthMonth = mergedProfile.birthDateParts?.month || '';
    form.birthDay = mergedProfile.birthDateParts?.day || '';
    await hydrateLocation(mergedProfile.country, mergedProfile.region, mergedProfile.city);
    writeProfileCache(mergedProfile);

    if (profileExists.value) {
      success.value = 'Профиль загружен.';
    } else {
      success.value = 'Профиль пока не заполнен.';
    }
  } catch (requestError) {
    const cachedProfile = readProfileCache();
    if (cachedProfile) {
      form.gender = cachedProfile.gender;
      form.education = cachedProfile.education;
      const cachedBirthParts = normalizeBirthDateParts(cachedProfile.birthDate);
      form.birthYear = cachedBirthParts?.year || '';
      form.birthMonth = cachedBirthParts?.month || '';
      form.birthDay = cachedBirthParts?.day || '';
      await hydrateLocation(cachedProfile.country, cachedProfile.region, cachedProfile.city);
      success.value = 'Профиль загружен из локального кеша.';
    } else {
      error.value = requestError?.message || 'Не удалось загрузить профиль пользователя.';
    }
  } finally {
    loadingProfile.value = false;
  }
}

const monthOptions = Object.freeze([
  { value: '01', label: '01 - January' },
  { value: '02', label: '02 - February' },
  { value: '03', label: '03 - March' },
  { value: '04', label: '04 - April' },
  { value: '05', label: '05 - May' },
  { value: '06', label: '06 - June' },
  { value: '07', label: '07 - July' },
  { value: '08', label: '08 - August' },
  { value: '09', label: '09 - September' },
  { value: '10', label: '10 - October' },
  { value: '11', label: '11 - November' },
  { value: '12', label: '12 - December' },
]);

const birthYearOptions = computed(() => {
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = currentYear; year >= 1900; year -= 1) {
    years.push({
      value: String(year),
      label: String(year),
    });
  }

  return years;
});

const birthDayOptions = computed(() => {
  const year = Number(form.birthYear);
  const month = Number(form.birthMonth);
  const daysInMonth =
    Number.isFinite(year) && Number.isFinite(month) && month > 0
      ? new Date(year, month, 0).getDate()
      : 31;

  const days = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = String(day).padStart(2, '0');
    days.push({ value, label: value });
  }
  return days;
});

const selectedBirthDate = computed(() => buildBirthDateString());
const calculatedAge = computed(() => calculateAgeByBirthDate(selectedBirthDate.value));
const shownAge = computed(() => serverAge.value || calculatedAge.value);

function validateForm() {
  if (!selectedBirthDate.value) {
    return 'Выберите полную дату рождения.';
  }
  if (!form.gender) {
    return 'Выберите gender.';
  }
  if (!form.country) {
    return 'Выберите country.';
  }
  if (!form.region) {
    return 'Выберите region.';
  }
  if (!form.city) {
    return 'Выберите city.';
  }
  if (!form.education) {
    return 'Выберите education.';
  }

  return '';
}

async function saveProfile() {
  if (!sessionState.token) {
    error.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  const validationError = validateForm();
  if (validationError) {
    error.value = validationError;
    return;
  }

  saving.value = true;
  error.value = '';
  success.value = '';

  try {
    const payload = {
      birth_date: selectedBirthDate.value,
      gender: form.gender,
      country: form.country,
      region: form.region,
      city: form.city,
      education: form.education,
    };

    await createMyUserProfile(sessionState.token, payload);
    writeProfileCache({
      birthDate: payload.birth_date,
      gender: payload.gender,
      country: payload.country,
      region: payload.region,
      city: payload.city,
      education: payload.education,
    });

    profileExists.value = true;
    await fetchProfile();
    success.value = 'Профиль сохранен.';
  } catch (requestError) {
    error.value = requestError?.message || 'Не удалось сохранить профиль.';
  } finally {
    saving.value = false;
  }
}

watch(
  () => form.birthMonth,
  (monthValue) => {
    if (!monthValue) {
      form.birthDay = '';
      return;
    }

    const availableDay = birthDayOptions.value.some((option) => option.value === form.birthDay);
    if (!availableDay) {
      form.birthDay = '';
    }
  },
);

watch(
  () => form.country,
  async (countryValue) => {
    if (isHydratingLocation.value) {
      return;
    }
    form.region = '';
    form.city = '';
    cityOptions.value = [];
    await loadRegions(countryValue);
  },
);

watch(
  () => form.region,
  async (regionValue) => {
    if (isHydratingLocation.value) {
      return;
    }
    form.city = '';
    await loadCities(form.country, regionValue);
  },
);

watch(
  () => sessionState.token,
  async (tokenValue, previousToken) => {
    if (tokenValue && tokenValue !== previousToken) {
      await loadFilterDefinitions();
      await loadCountries();
      await fetchProfile();
    }
  },
);

onMounted(async () => {
  await loadFilterDefinitions();
  await loadCountries();
  await fetchProfile();
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <div class="section-head">
        <div>
          <h3>User Profile</h3>
          <p class="subtitle">Создание/редактирование через `POST /api/v1/user-profile`.</p>
          <p class="subtitle mono">user_id из JWT: {{ sessionState.claims?.userId || '-' }}</p>
          <p class="subtitle">Статус: {{ profileExists ? 'профиль существует' : 'новый профиль' }}</p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-secondary" :disabled="loadingProfile" @click="fetchProfile">
            {{ loadingProfile ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <form class="form" aria-label="Форма профиля пользователя" @submit.prevent="saveProfile">
        <div class="birth-grid">
          <BaseFormField id="profile-birth-year" label="Birth year" required>
            <select id="profile-birth-year" v-model="form.birthYear" class="select">
              <option value="">Year</option>
              <option v-for="option in birthYearOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>

          <BaseFormField id="profile-birth-month" label="Birth month" required>
            <select id="profile-birth-month" v-model="form.birthMonth" class="select">
              <option value="">Month</option>
              <option v-for="option in monthOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>

          <BaseFormField id="profile-birth-day" label="Birth day" required>
            <select id="profile-birth-day" v-model="form.birthDay" class="select" :disabled="!form.birthMonth">
              <option value="">Day</option>
              <option v-for="option in birthDayOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>
        </div>

        <p class="subtitle">Возраст (расчет): {{ shownAge ?? '-' }}</p>

        <BaseFormField id="profile-gender" label="Gender" required>
          <select id="profile-gender" v-model="form.gender" class="select" :disabled="loadingFilters">
            <option value="">{{ loadingFilters ? 'Loading...' : 'Select gender' }}</option>
            <option v-for="option in genderOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </BaseFormField>

        <BaseFormField id="profile-country" label="Country (ID)" required>
          <select id="profile-country" v-model="form.country" class="select" :disabled="loadingCountries">
            <option value="">{{ loadingCountries ? 'Loading...' : 'Select country' }}</option>
            <option v-for="option in countryOptions" :key="option.value" :value="option.value">
              {{ option.label }} ({{ option.value }})
            </option>
          </select>
        </BaseFormField>

        <BaseFormField id="profile-region" label="Region (ID)" required>
          <select id="profile-region" v-model="form.region" class="select" :disabled="!form.country || loadingRegions">
            <option value="">{{ loadingRegions ? 'Loading...' : 'Select region' }}</option>
            <option v-for="option in regionOptions" :key="option.value" :value="option.value">
              {{ option.label }} ({{ option.value }})
            </option>
          </select>
        </BaseFormField>

        <BaseFormField id="profile-city" label="City (ID)" required>
          <select id="profile-city" v-model="form.city" class="select" :disabled="!form.region || loadingCities">
            <option value="">{{ loadingCities ? 'Loading...' : 'Select city' }}</option>
            <option v-for="option in cityOptions" :key="option.value" :value="option.value">
              {{ option.label }} ({{ option.value }})
            </option>
          </select>
        </BaseFormField>

        <BaseFormField id="profile-education" label="Education" required>
          <select id="profile-education" v-model="form.education" class="select" :disabled="loadingFilters">
            <option value="">{{ loadingFilters ? 'Loading...' : 'Select education' }}</option>
            <option v-for="option in educationOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </BaseFormField>

        <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>
        <p v-if="success" class="success" role="status" aria-live="polite">{{ success }}</p>

        <button type="submit" class="btn btn-primary" :disabled="saving" :aria-busy="saving ? 'true' : 'false'">
          {{ saving ? 'Сохраняем...' : profileExists ? 'Сохранить изменения' : 'Создать профиль' }}
        </button>
      </form>
    </article>

    <article class="card">
      <h3>Текущие данные</h3>
      <p class="subtitle">Последние данные, полученные с `GET /api/v1/user-profile/me`.</p>

      <dl class="kv-grid">
        <dt>birth_date</dt>
        <dd class="mono">{{ lastLoadedProfile?.birthDate || '-' }}</dd>

        <dt>age</dt>
        <dd>{{ lastLoadedProfile?.age || shownAge || '-' }}</dd>

        <dt>gender</dt>
        <dd>{{ lastLoadedProfile?.gender || '-' }}</dd>

        <dt>country</dt>
        <dd class="mono">{{ lastLoadedProfile?.country || '-' }}</dd>

        <dt>region</dt>
        <dd class="mono">{{ lastLoadedProfile?.region || '-' }}</dd>

        <dt>city</dt>
        <dd class="mono">{{ lastLoadedProfile?.city || '-' }}</dd>

        <dt>education</dt>
        <dd>{{ lastLoadedProfile?.education || '-' }}</dd>
      </dl>
    </article>
  </section>
</template>

<style scoped>
.birth-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: 12px;
}

.kv-grid {
  display: grid;
  grid-template-columns: minmax(120px, 160px) 1fr;
  gap: 8px 14px;
  margin: 18px 0 0;
}

.kv-grid dt {
  color: var(--text-dim);
  font-weight: 600;
}

.kv-grid dd {
  margin: 0;
}

@media (max-width: 760px) {
  .birth-grid {
    grid-template-columns: 1fr;
  }

  .kv-grid {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
