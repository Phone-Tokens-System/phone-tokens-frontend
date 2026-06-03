<script setup>
import { onMounted, reactive, ref } from 'vue';
import BaseDataTable from '../components/base/BaseDataTable.vue';
import BaseFormField from '../components/base/BaseFormField.vue';
import { createPackage, deletePackage, getPackages } from '../lib/api';
import { sessionState } from '../lib/session';

const loading = ref(false);
const creating = ref(false);
const deletingId = ref('');
const packages = ref([]);
const error = ref('');
const success = ref('');

const form = reactive({
  name: '',
  service: 'SMS',
  units: '',
  price: '',
  duration_days: '30',
  description: '',
});

const serviceOptions = ['SMS', 'Call'];

function resetForm() {
  form.name = '';
  form.service = 'SMS';
  form.units = '';
  form.price = '';
  form.duration_days = '30';
  form.description = '';
}

async function fetchPackages() {
  loading.value = true;
  error.value = '';
  try {
    const payload = await getPackages(sessionState.token);
    packages.value = Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить пакеты';
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  error.value = '';
  success.value = '';

  const units = Number(form.units);
  const price = Number(form.price);
  const duration = Number(form.duration_days);

  if (!form.name.trim()) { error.value = 'Укажите название пакета.'; return; }
  if (!Number.isFinite(units) || units <= 0) { error.value = 'Укажите количество единиц.'; return; }
  if (!Number.isFinite(price) || price <= 0) { error.value = 'Укажите цену.'; return; }

  creating.value = true;
  try {
    await createPackage(sessionState.token, {
      name: form.name.trim(),
      service: form.service,
      units,
      price,
      duration_days: duration > 0 ? duration : 30,
      description: form.description.trim(),
    });
    success.value = `Пакет «${form.name.trim()}» создан.`;
    resetForm();
    await fetchPackages();
  } catch (e) {
    error.value = e?.message || 'Не удалось создать пакет';
  } finally {
    creating.value = false;
  }
}

async function handleDelete(pkg) {
  if (!confirm(`Удалить пакет «${pkg.name}»?`)) return;
  deletingId.value = pkg.id;
  error.value = '';
  success.value = '';
  try {
    await deletePackage(sessionState.token, pkg.id);
    success.value = `Пакет «${pkg.name}» удалён.`;
    await fetchPackages();
  } catch (e) {
    error.value = e?.message || 'Не удалось удалить пакет';
  } finally {
    deletingId.value = '';
  }
}

onMounted(fetchPackages);
</script>

<template>
  <section class="card-grid">

    <!-- Форма создания -->
    <article class="card">
      <h3>Создать пакет</h3>

      <form class="form" aria-label="Форма создания пакета" @submit.prevent="handleCreate">
        <BaseFormField id="pkg-name" label="Название" required>
          <input id="pkg-name" v-model="form.name" class="input" type="text" placeholder="100 SMS в месяц" required />
        </BaseFormField>

        <BaseFormField id="pkg-service" label="Сервис" required>
          <select id="pkg-service" v-model="form.service" class="select" required>
            <option v-for="opt in serviceOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </BaseFormField>

        <div class="form-row">
          <BaseFormField id="pkg-units" label="Единиц" required>
            <input id="pkg-units" v-model="form.units" class="input" type="number" min="1" placeholder="100" required />
          </BaseFormField>

          <BaseFormField id="pkg-price" label="Цена (RUB)" required>
            <input id="pkg-price" v-model="form.price" class="input" type="number" min="0.01" step="0.01" placeholder="299.00" required />
          </BaseFormField>

          <BaseFormField id="pkg-duration" label="Срок (дней)">
            <input id="pkg-duration" v-model="form.duration_days" class="input" type="number" min="1" placeholder="30" />
          </BaseFormField>
        </div>

        <BaseFormField id="pkg-description" label="Описание">
          <input id="pkg-description" v-model="form.description" class="input" type="text" placeholder="Необязательно" />
        </BaseFormField>

        <button type="submit" class="btn btn-primary" :disabled="creating">
          {{ creating ? 'Создаём...' : 'Создать пакет' }}
        </button>
      </form>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="success" class="success" role="status">{{ success }}</p>
    </article>

    <!-- Список пакетов -->
    <article class="card">
      <div class="section-head">
        <div>
          <h3>Все пакеты</h3>
          <p class="subtitle">{{ packages.length }} пакетов</p>
        </div>
        <div class="section-actions">
          <button type="button" class="btn btn-secondary" :disabled="loading" @click="fetchPackages">
            {{ loading ? 'Загружаем...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <BaseDataTable
        v-if="packages.length"
        caption="Пакеты"
        aria-label="Список пакетов"
        :min-width="700"
      >
        <thead>
          <tr>
            <th scope="col">Название</th>
            <th scope="col">Сервис</th>
            <th scope="col">Единиц</th>
            <th scope="col">Цена</th>
            <th scope="col">Срок</th>
            <th scope="col">Описание</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pkg in packages" :key="pkg.id">
            <td><strong>{{ pkg.name }}</strong></td>
            <td><span class="badge">{{ pkg.service }}</span></td>
            <td>{{ pkg.units }}</td>
            <td class="mono">{{ Number(pkg.price).toFixed(2) }} ₽</td>
            <td>{{ pkg.duration_days || 30 }} дн.</td>
            <td class="pkg-desc-cell">{{ pkg.description || '—' }}</td>
            <td>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                :disabled="!!deletingId"
                @click="handleDelete(pkg)"
              >
                {{ deletingId === pkg.id ? '...' : 'Удалить' }}
              </button>
            </td>
          </tr>
        </tbody>
      </BaseDataTable>

      <p v-else-if="!loading" class="subtitle empty-state">Пакеты ещё не созданы.</p>
      <p v-else class="subtitle">Загружаем...</p>
    </article>

  </section>
</template>

<style scoped>
.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.pkg-desc-cell {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-muted, #64748b);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8125rem;
  min-height: 32px;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
