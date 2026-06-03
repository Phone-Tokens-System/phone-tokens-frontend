<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import BaseDataTable from '../components/base/BaseDataTable.vue';
import BaseFormField from '../components/base/BaseFormField.vue';
import BaseStatusChip from '../components/base/BaseStatusChip.vue';
import SensitiveValue from '../components/base/SensitiveValue.vue';
import {
  getAgentUserProfilesFiltered,
  getCurrentSignedCertificate,
  getDictionaryCities,
  getDictionaryCountries,
  getDictionaryRegions,
  getSmsLogsByAgent,
  getUserProfileFilters,
  sendSms,
  sendSmsFiltered,
} from '../lib/api';
import { readAgentCertificates, saveSignedAgentCertificate } from '../lib/agentCertificates';
import { sessionState } from '../lib/session';

const loading = ref(false);
const sending = ref(false);
const sendingFiltered = ref(false);
const loadingCountries = ref(false);
const loadingRegions = ref(false);
const loadingCities = ref(false);
const loadingFilterConfig = ref(false);
const loadError = ref('');
const sendError = ref('');
const sendSuccess = ref('');
const filteredSendError = ref('');
const filteredSendSuccess = ref('');
const smsLogs = ref([]);
const certificateOptions = ref([]);
const syncingCurrentCertificate = ref(false);
let certificatePollId = null;

const countryOptions = ref([]);
const regionOptions = ref([]);
const cityOptions = ref([]);

const FALLBACK_FILTER_DEFINITIONS = Object.freeze([
  { key: 'Gender', type: 'select', options: ['male', 'female'] },
  { key: 'Country', type: 'select', option_source: 'api/v1/dictionary/countries' },
  { key: 'Region', type: 'select', option_source: 'api/v1/dictionary/regions/?country={country}' },
  { key: 'City', type: 'select', option_source: 'api/v1/dictionary/cities/?country={country}&region={region}' },
  { key: 'education', type: 'select', options: ['school', 'bachelor', 'master', 'phd'] },
]);

const filterDefinitions = ref([...FALLBACK_FILTER_DEFINITIONS]);

const sendForm = reactive({
  serviceName: '',
  certificateChoice: '',
  certificate: '',
  clientToken: '',
  text: '',
});

const filteredSendForm = reactive({
  serviceName: '',
  certificateChoice: '',
  certificate: '',
  text: '',
  gender: '',
  education: '',
  country: '',
  region: '',
  city: '',
});

const filters = reactive({
  status: 'all',
  serviceName: '',
  query: '',
  dateFrom: '',
  dateTo: '',
});

const statusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: '1', label: 'Delivered' },
  { value: '0', label: 'Queued' },
  { value: '4', label: 'Pending' },
  { value: '8', label: 'In Moderation' },
  { value: '2', label: 'Not Delivered' },
  { value: '6', label: 'Rejected' },
];

const MANUAL_CERTIFICATE_VALUE = '__manual_certificate__';

function normalizeSmsList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
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

function normalizeFilterKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function formatOptionLabel(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  return text
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeSelectOptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option) => {
      if (typeof option === 'string') {
        const normalized = option.trim();
        return {
          value: normalized,
          label: formatOptionLabel(normalized),
        };
      }

      const normalized = String(option?.value ?? option?.id ?? '').trim();
      return {
        value: normalized,
        label: String(option?.label ?? option?.name ?? '').trim() || formatOptionLabel(normalized),
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

function normalizeUserProfileList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function countSentSms(payload) {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data.length;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items.length;
  }

  if (payload && typeof payload === 'object' && (payload.id || payload.external_id)) {
    return 1;
  }

  return 0;
}

function loadCertificateOptions() {
  certificateOptions.value = readAgentCertificates(sessionState.agentId);
  const firstCertificate = certificateOptions.value[0]?.id || '';

  if (!sendForm.certificateChoice) {
    sendForm.certificateChoice = firstCertificate || MANUAL_CERTIFICATE_VALUE;
  }

  if (!filteredSendForm.certificateChoice) {
    filteredSendForm.certificateChoice = firstCertificate || MANUAL_CERTIFICATE_VALUE;
  }
}

async function syncCurrentCertificate() {
  if (!sessionState.token || syncingCurrentCertificate.value) {
    return;
  }

  syncingCurrentCertificate.value = true;
  try {
    const payload = await getCurrentSignedCertificate(sessionState.token);
    const saved = saveSignedAgentCertificate(payload, sessionState.agentId);
    if (!saved) {
      return;
    }

    loadCertificateOptions();
    if (sendForm.certificateChoice === MANUAL_CERTIFICATE_VALUE || !sendForm.certificateChoice) {
      sendForm.certificateChoice = saved.id;
    }
    if (filteredSendForm.certificateChoice === MANUAL_CERTIFICATE_VALUE || !filteredSendForm.certificateChoice) {
      filteredSendForm.certificateChoice = saved.id;
    }
  } catch {
    loadCertificateOptions();
  } finally {
    syncingCurrentCertificate.value = false;
  }
}

function startCertificatePolling() {
  if (certificatePollId !== null) {
    return;
  }

  certificatePollId = window.setInterval(() => {
    syncCurrentCertificate();
  }, 5000);
}

function stopCertificatePolling() {
  if (certificatePollId === null) {
    return;
  }

  window.clearInterval(certificatePollId);
  certificatePollId = null;
}

function selectedCertificateValue(choice, manualValue) {
  if (choice === MANUAL_CERTIFICATE_VALUE) {
    return String(manualValue || '').trim();
  }

  const selected = certificateOptions.value.find((item) => item.id === choice);
  return String(selected?.certificate || '').trim();
}

function sendCertificateValue() {
  return selectedCertificateValue(sendForm.certificateChoice, sendForm.certificate);
}

function filteredCertificateValue() {
  return selectedCertificateValue(filteredSendForm.certificateChoice, filteredSendForm.certificate);
}

function toTimestamp(value) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber * 1000;
  }

  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const timestamp = toTimestamp(value);
  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toLocaleString();
  }

  return String(value);
}

function statusLabel(value) {
  const status = Number(value);
  if (status === 1) return 'Delivered';
  if (status === 2) return 'Not Delivered';
  if (status === 0) return 'Queued';
  if (status === 8) return 'In Moderation';
  if (status === 4) return 'Pending';
  if (status === 6) return 'Rejected';
  return String(value ?? '-');
}

function statusTone(value) {
  const status = Number(value);
  if (status === 1) return 'ok';
  if (status === 0 || status === 4 || status === 8) return 'warn';
  if (status === 2 || status === 6) return 'error';
  return 'neutral';
}

const filterDefinitionsByKey = computed(() => {
  const map = {};
  for (const definition of filterDefinitions.value) {
    const key = normalizeFilterKey(definition.key);
    if (key) {
      map[key] = definition;
    }
  }
  return map;
});

const availableFilterFields = computed(() => ({
  gender: Boolean(filterDefinitionsByKey.value.gender),
  education: Boolean(filterDefinitionsByKey.value.education),
  country: Boolean(filterDefinitionsByKey.value.country),
  region: Boolean(filterDefinitionsByKey.value.region),
  city: Boolean(filterDefinitionsByKey.value.city),
}));

const filterFieldLabels = computed(() => ({
  gender: filterDefinitionsByKey.value.gender?.key || 'Gender',
  education: filterDefinitionsByKey.value.education?.key || 'Education',
  country: filterDefinitionsByKey.value.country?.key || 'Country',
  region: filterDefinitionsByKey.value.region?.key || 'Region',
  city: filterDefinitionsByKey.value.city?.key || 'City',
}));

const genderOptions = computed(() => {
  const options = normalizeSelectOptions(filterDefinitionsByKey.value.gender?.options || []);
  return options.length ? options : normalizeSelectOptions(['male', 'female']);
});

const educationOptions = computed(() => {
  const options = normalizeSelectOptions(filterDefinitionsByKey.value.education?.options || []);
  return options.length ? options : normalizeSelectOptions(['school', 'bachelor', 'master', 'phd']);
});

const hasActiveFilters = computed(() =>
  filters.status !== 'all' ||
  filters.serviceName.trim() ||
  filters.query.trim() ||
  filters.dateFrom ||
  filters.dateTo,
);

const filteredSmsLogs = computed(() => {
  const query = filters.query.trim().toLowerCase();
  const serviceName = filters.serviceName.trim().toLowerCase();
  const fromTs = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : NaN;
  const toTs = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).getTime() : NaN;

  return [...smsLogs.value]
    .sort((a, b) => toTimestamp(b.date_created) - toTimestamp(a.date_created))
    .filter((item) => {
      if (filters.status !== 'all' && String(item.status) !== filters.status) {
        return false;
      }

      const itemServiceName = String(item.service_name || item.serviceName || '').toLowerCase();
      if (serviceName && !itemServiceName.includes(serviceName)) {
        return false;
      }

      if (query) {
        const haystack = [
          item.external_id,
          item.id,
          item.token,
          item.from,
          item.text,
          item.service_name,
          item.serviceName,
        ]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');

        if (!haystack.includes(query)) {
          return false;
        }
      }

      const createdTs = toTimestamp(item.date_created);
      if (Number.isFinite(fromTs) && (!Number.isFinite(createdTs) || createdTs < fromTs)) {
        return false;
      }
      if (Number.isFinite(toTs) && (!Number.isFinite(createdTs) || createdTs > toTs)) {
        return false;
      }

      return true;
    });
});

function resetFilters() {
  filters.status = 'all';
  filters.serviceName = '';
  filters.query = '';
  filters.dateFrom = '';
  filters.dateTo = '';
}

async function fetchSmsLogs() {
  if (!sessionState.token) {
    loadError.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!sessionState.agentId) {
    loadError.value = 'agent_id не найден в профиле. Выполните вход заново или обновите профиль в Agent Context.';
    return;
  }

  loading.value = true;
  loadError.value = '';

  try {
    const payload = await getSmsLogsByAgent(sessionState.token, sessionState.agentId);
    smsLogs.value = normalizeSmsList(payload);
  } catch (requestError) {
    loadError.value = requestError?.message || 'Не удалось загрузить SMS';
  } finally {
    loading.value = false;
  }
}

async function submitSms() {
  if (!sessionState.token) {
    sendError.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!sendForm.clientToken.trim()) {
    sendError.value = 'Укажите client_token.';
    return;
  }

  const certificate = sendCertificateValue();
  if (!certificate) {
    sendError.value = 'Укажите certificate.';
    return;
  }

  if (!sendForm.text.trim()) {
    sendError.value = 'Введите текст SMS.';
    return;
  }

  sending.value = true;
  sendError.value = '';
  sendSuccess.value = '';

  try {
    await sendSms(sessionState.token, {
      service_name: sendForm.serviceName.trim(),
      certificate,
      client_token: sendForm.clientToken.trim(),
      text: sendForm.text.trim(),
    });

    sendSuccess.value = 'SMS отправлена.';
    sendForm.text = '';
    await fetchSmsLogs();
  } catch (requestError) {
    if (requestError?.status === 403) {
      sendError.value = 'Сервер запретил отправку SMS для текущей роли (403).';
      return;
    }

    sendError.value = requestError?.message || 'Не удалось отправить SMS';
  } finally {
    sending.value = false;
  }
}

async function loadFilterDefinitions() {
  loadingFilterConfig.value = true;
  try {
    const payload = await getUserProfileFilters(sessionState.token);
    const definitions = normalizeFilterDefinitions(payload);
    filterDefinitions.value = definitions.length ? definitions : [...FALLBACK_FILTER_DEFINITIONS];
  } catch {
    filterDefinitions.value = [...FALLBACK_FILTER_DEFINITIONS];
  } finally {
    if (!availableFilterFields.value.country) {
      filteredSendForm.country = '';
      countryOptions.value = [];
    }
    if (!availableFilterFields.value.region) {
      filteredSendForm.region = '';
      regionOptions.value = [];
    }
    if (!availableFilterFields.value.city) {
      filteredSendForm.city = '';
      cityOptions.value = [];
    }
    if (!availableFilterFields.value.gender) {
      filteredSendForm.gender = '';
    }
    if (!availableFilterFields.value.education) {
      filteredSendForm.education = '';
    }
    loadingFilterConfig.value = false;
  }
}

async function loadCountries() {
  if (!availableFilterFields.value.country) {
    countryOptions.value = [];
    return;
  }

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
  if (!availableFilterFields.value.region || !countryId) {
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
  if (!availableFilterFields.value.city || !countryId || !regionId) {
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

function buildFilteredMap() {
  const map = {};

  if (availableFilterFields.value.gender && filteredSendForm.gender) {
    map.gender = filteredSendForm.gender;
  }
  if (availableFilterFields.value.country && filteredSendForm.country) {
    map.country = filteredSendForm.country;
  }
  if (availableFilterFields.value.region && filteredSendForm.region) {
    map.region = filteredSendForm.region;
  }
  if (availableFilterFields.value.city && filteredSendForm.city) {
    map.city = filteredSendForm.city;
  }
  if (availableFilterFields.value.education && filteredSendForm.education) {
    map.education = filteredSendForm.education;
  }

  if (Object.keys(map).length === 0) {
    throw new Error('Выберите хотя бы один фильтр для рассылки.');
  }

  return map;
}

function resetFilteredInputs() {
  filteredSendForm.gender = '';
  filteredSendForm.education = '';
  filteredSendForm.country = '';
  filteredSendForm.region = '';
  filteredSendForm.city = '';
}

function shouldUseFallbackFilteredSend(error) {
  const status = Number(error?.status);
  if (status === 403) {
    return false;
  }
  if (status === 404 || status === 405) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('client_token') ||
    message.includes('invalid input syntax for type uuid') ||
    message.includes('cannot unmarshal') ||
    message.includes('record not found')
  );
}

async function sendFilteredSmsViaFallback(filtersMap) {
  const profilesPayload = await getAgentUserProfilesFiltered(sessionState.token, {
    filters: filtersMap,
  });
  const profiles = normalizeUserProfileList(profilesPayload);
  const tokenSet = new Set();

  for (const profile of profiles) {
    const userToken = String(profile?.token ?? profile?.Token ?? '').trim();
    if (userToken) {
      tokenSet.add(userToken);
    }
  }

  if (tokenSet.size === 0) {
    return { sentCount: 0, failedCount: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  let firstError = null;

  for (const userToken of tokenSet) {
    try {
      await sendSms(sessionState.token, {
        service_name: filteredSendForm.serviceName.trim(),
        certificate: filteredCertificateValue(),
        client_token: userToken,
        text: filteredSendForm.text.trim(),
      });
      sentCount += 1;
    } catch (requestError) {
      failedCount += 1;
      if (!firstError) {
        firstError = requestError;
      }
    }
  }

  if (sentCount === 0 && firstError) {
    throw firstError;
  }

  return { sentCount, failedCount };
}

async function submitFilteredSms() {
  if (!sessionState.token) {
    filteredSendError.value = 'Сессия не найдена. Выполните вход заново.';
    return;
  }

  if (!sessionState.agentId) {
    filteredSendError.value = 'agent_id не найден в профиле. Выполните вход заново или обновите профиль в Agent Context.';
    return;
  }

  const certificate = filteredCertificateValue();
  if (!certificate) {
    filteredSendError.value = 'Укажите certificate.';
    return;
  }

  if (!filteredSendForm.text.trim()) {
    filteredSendError.value = 'Введите текст SMS.';
    return;
  }

  sendingFiltered.value = true;
  filteredSendError.value = '';
  filteredSendSuccess.value = '';

  try {
    const filtersMap = buildFilteredMap();
    const requestPayload = {
      service_name: filteredSendForm.serviceName.trim(),
      certificate,
      text: filteredSendForm.text.trim(),
      agent_id: sessionState.agentId,
      filters: { filters: filtersMap },
    };

    let sentCount = 0;
    let failedCount = 0;

    try {
      const payload = await sendSmsFiltered(sessionState.token, requestPayload);
      sentCount = countSentSms(payload);
    } catch (requestError) {
      if (!shouldUseFallbackFilteredSend(requestError)) {
        throw requestError;
      }

      const fallbackResult = await sendFilteredSmsViaFallback(filtersMap);
      sentCount = fallbackResult.sentCount;
      failedCount = fallbackResult.failedCount;
    }

    if (sentCount > 0 && failedCount > 0) {
      filteredSendSuccess.value = `Отправлено SMS: ${sentCount}, ошибок: ${failedCount}.`;
    } else if (sentCount > 0) {
      filteredSendSuccess.value = `Отправлено SMS по фильтрам: ${sentCount}`;
    } else {
      filteredSendSuccess.value = 'По выбранным фильтрам пользователи не найдены.';
    }

    await fetchSmsLogs();
  } catch (requestError) {
    if (requestError?.status === 403) {
      filteredSendError.value = 'Сервер запретил отправку SMS по фильтрам для текущей роли (403).';
      return;
    }

    filteredSendError.value = requestError?.message || 'Не удалось отправить SMS по фильтрам';
  } finally {
    sendingFiltered.value = false;
  }
}

watch(
  () => sessionState.agentId,
  (value, previous) => {
    if (value && value !== previous) {
      syncCurrentCertificate();
      fetchSmsLogs();
    }
  },
);

watch(
  () => filteredSendForm.country,
  (country) => {
    filteredSendForm.region = '';
    filteredSendForm.city = '';
    cityOptions.value = [];
    loadRegions(country);
  },
);

watch(
  () => filteredSendForm.region,
  (region) => {
    filteredSendForm.city = '';
    loadCities(filteredSendForm.country, region);
  },
);

watch(
  () => sessionState.token,
  async (value, previous) => {
    if (value && value !== previous) {
      await syncCurrentCertificate();
      await loadFilterDefinitions();
      await loadCountries();
    }
  },
);

onMounted(async () => {
  loadCertificateOptions();
  await syncCurrentCertificate();
  startCertificatePolling();
  await loadFilterDefinitions();
  await loadCountries();
  if (sessionState.agentId) {
    await fetchSmsLogs();
  }
});

onUnmounted(() => {
  stopCertificatePolling();
});
</script>

<template>
  <section class="card-grid">
    <article class="card">
      <h3>Отправить SMS</h3>

      <form class="form" aria-label="Форма отправки SMS" @submit.prevent="submitSms">
        <BaseFormField id="sms-service-name" label="service_name">
          <input id="sms-service-name" v-model="sendForm.serviceName" class="input" type="text" placeholder="provider/service" />
        </BaseFormField>

        <BaseFormField id="sms-client-token" label="client_token" required>
          <input
            id="sms-client-token"
            v-model="sendForm.clientToken"
            class="input mono"
            type="text"
            placeholder="user token"
            required
          />
        </BaseFormField>

        <BaseFormField id="sms-certificate-select" label="certificate" required>
          <select id="sms-certificate-select" v-model="sendForm.certificateChoice" class="select" required>
            <option value="">Выберите сертификат</option>
            <option v-for="item in certificateOptions" :key="item.id" :value="item.id">
              {{ item.label }}
            </option>
            <option :value="MANUAL_CERTIFICATE_VALUE">Ввести вручную</option>
          </select>
        </BaseFormField>

        <BaseFormField
          v-if="sendForm.certificateChoice === MANUAL_CERTIFICATE_VALUE"
          id="sms-certificate-manual"
          label="certificate вручную"
          required
        >
          <textarea
            id="sms-certificate-manual"
            v-model="sendForm.certificate"
            class="textarea mono textarea-small"
            placeholder="certificate text"
            required
          />
        </BaseFormField>

        <BaseFormField id="sms-text" label="text" required>
          <textarea id="sms-text" v-model="sendForm.text" class="textarea textarea-small" placeholder="message text" required />
        </BaseFormField>

        <button type="submit" class="btn btn-primary" :disabled="sending" :aria-busy="sending ? 'true' : 'false'">
          {{ sending ? 'Отправляем...' : 'Отправить SMS' }}
        </button>
      </form>

      <p v-if="sendError" class="error" role="alert" aria-live="assertive">{{ sendError }}</p>
      <p v-if="sendSuccess" class="success" role="status" aria-live="polite">{{ sendSuccess }}</p>
    </article>

    <article class="card">
      <h3>Отправить SMS по фильтрам</h3>
      <p v-if="loadingFilterConfig" class="subtitle">Загружаем конфигурацию фильтров...</p>

      <form class="form" aria-label="Форма отправки SMS по фильтрам" @submit.prevent="submitFilteredSms">
        <div class="filter-form-grid">
          <BaseFormField v-if="availableFilterFields.gender" id="sms-filtered-gender" :label="filterFieldLabels.gender">
            <select id="sms-filtered-gender" v-model="filteredSendForm.gender" class="select">
              <option value="">Любой</option>
              <option v-for="option in genderOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>

          <BaseFormField
            v-if="availableFilterFields.education"
            id="sms-filtered-education"
            :label="filterFieldLabels.education"
          >
            <select id="sms-filtered-education" v-model="filteredSendForm.education" class="select">
              <option value="">Любое</option>
              <option v-for="option in educationOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>

          <BaseFormField v-if="availableFilterFields.country" id="sms-filtered-country" :label="filterFieldLabels.country">
            <select id="sms-filtered-country" v-model="filteredSendForm.country" class="select" :disabled="loadingCountries">
              <option value="">{{ loadingCountries ? 'Загрузка...' : 'Любая' }}</option>
              <option v-for="option in countryOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>

          <BaseFormField v-if="availableFilterFields.region" id="sms-filtered-region" :label="filterFieldLabels.region">
            <select
              id="sms-filtered-region"
              v-model="filteredSendForm.region"
              class="select"
              :disabled="!filteredSendForm.country || loadingRegions || !availableFilterFields.country"
            >
              <option value="">{{ loadingRegions ? 'Загрузка...' : 'Любой' }}</option>
              <option v-for="option in regionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>

          <BaseFormField v-if="availableFilterFields.city" id="sms-filtered-city" :label="filterFieldLabels.city">
            <select
              id="sms-filtered-city"
              v-model="filteredSendForm.city"
              class="select"
              :disabled="!filteredSendForm.region || loadingCities || !availableFilterFields.region"
            >
              <option value="">{{ loadingCities ? 'Загрузка...' : 'Любой' }}</option>
              <option v-for="option in cityOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-secondary" @click="resetFilteredInputs">Сбросить фильтры</button>
        </div>

        <BaseFormField id="sms-filtered-service-name" label="service_name">
          <input
            id="sms-filtered-service-name"
            v-model="filteredSendForm.serviceName"
            class="input"
            type="text"
            placeholder="provider/service"
          />
        </BaseFormField>

        <BaseFormField id="sms-filtered-certificate-select" label="certificate" required>
          <select id="sms-filtered-certificate-select" v-model="filteredSendForm.certificateChoice" class="select" required>
            <option value="">Выберите сертификат</option>
            <option v-for="item in certificateOptions" :key="item.id" :value="item.id">
              {{ item.label }}
            </option>
            <option :value="MANUAL_CERTIFICATE_VALUE">Ввести вручную</option>
          </select>
        </BaseFormField>

        <BaseFormField
          v-if="filteredSendForm.certificateChoice === MANUAL_CERTIFICATE_VALUE"
          id="sms-filtered-certificate-manual"
          label="certificate вручную"
          required
        >
          <textarea
            id="sms-filtered-certificate-manual"
            v-model="filteredSendForm.certificate"
            class="textarea mono textarea-small"
            placeholder="certificate text"
            required
          />
        </BaseFormField>

        <BaseFormField id="sms-filtered-text" label="text" required>
          <textarea
            id="sms-filtered-text"
            v-model="filteredSendForm.text"
            class="textarea textarea-small"
            placeholder="message text"
            required
          />
        </BaseFormField>

        <button type="submit" class="btn btn-primary" :disabled="sendingFiltered" :aria-busy="sendingFiltered ? 'true' : 'false'">
          {{ sendingFiltered ? 'Отправляем...' : 'Отправить по фильтрам' }}
        </button>
      </form>

      <p v-if="filteredSendError" class="error" role="alert" aria-live="assertive">{{ filteredSendError }}</p>
      <p v-if="filteredSendSuccess" class="success" role="status" aria-live="polite">{{ filteredSendSuccess }}</p>
    </article>

    <article class="card">
      <div class="section-head">
        <div>
          <h3>SMS</h3>
          <p class="subtitle">Показано: {{ filteredSmsLogs.length }} из {{ smsLogs.length }}</p>
        </div>

        <div class="section-actions">
          <button type="button" class="btn btn-secondary" :disabled="loading || !hasActiveFilters" @click="resetFilters">
            Сбросить фильтры
          </button>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="fetchSmsLogs">
            {{ loading ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <div class="filters">
        <div class="filter-grid">
          <BaseFormField id="sms-filter-status" label="Status">
            <select id="sms-filter-status" v-model="filters.status" class="select">
              <option v-for="option in statusFilterOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </BaseFormField>

          <BaseFormField id="sms-filter-service" label="Service">
            <input id="sms-filter-service" v-model="filters.serviceName" class="input" type="text" placeholder="service_name" />
          </BaseFormField>

          <BaseFormField id="sms-filter-search" label="Search">
            <input
              id="sms-filter-search"
              v-model="filters.query"
              class="input"
              type="text"
              placeholder="text / token / external_id"
            />
          </BaseFormField>

          <BaseFormField id="sms-filter-date-from" label="Date from">
            <input id="sms-filter-date-from" v-model="filters.dateFrom" class="input" type="date" />
          </BaseFormField>

          <BaseFormField id="sms-filter-date-to" label="Date to">
            <input id="sms-filter-date-to" v-model="filters.dateTo" class="input" type="date" />
          </BaseFormField>
        </div>
      </div>

      <p v-if="loadError" class="error" role="alert" aria-live="assertive">{{ loadError }}</p>

      <BaseDataTable
        v-if="filteredSmsLogs.length"
        caption="SMS с фильтрами"
        aria-label="SMS с фильтрами"
        :min-width="860"
      >
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col">From</th>
            <th scope="col">Token</th>
            <th scope="col">Text</th>
            <th scope="col">Status</th>
            <th scope="col">Cost</th>
            <th scope="col">Created</th>
            <th scope="col">Sent</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in filteredSmsLogs" :key="`${item.external_id || item.id || index}-${index}`">
            <td>{{ item.service_name || item.serviceName || '-' }}</td>
            <td class="mono">{{ item.from || '-' }}</td>
            <td>
              <SensitiveValue
                :value="item.token"
                label="token"
                :copy-label="`Copy full SMS token ${item.external_id || item.id || index}`"
              />
            </td>
            <td>{{ item.text || '-' }}</td>
            <td>
              <BaseStatusChip
                :label="statusLabel(item.status)"
                :tone="statusTone(item.status)"
                :aria-label="`SMS status: ${statusLabel(item.status)}`"
              />
            </td>
            <td>{{ Number(item.cost || 0).toFixed(2) }}</td>
            <td class="mono">{{ formatDate(item.date_created) }}</td>
            <td class="mono">{{ formatDate(item.date_sent) }}</td>
          </tr>
        </tbody>
      </BaseDataTable>

      <p v-else-if="!loading && smsLogs.length" class="subtitle empty-state">
        По выбранным фильтрам ничего не найдено.
      </p>

      <p v-else-if="!loading" class="subtitle empty-state">
        Логи пока пустые или не найдены для указанного agent_id.
      </p>
    </article>
  </section>
</template>

<style scoped>
.filters {
  margin-bottom: 18px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr));
  gap: 10px;
}

.filter-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(200px, 1fr));
  gap: 12px;
}

.textarea-small {
  min-height: 120px;
}

@media (max-width: 1200px) {
  .filter-grid {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }
}

@media (max-width: 760px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .filter-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
