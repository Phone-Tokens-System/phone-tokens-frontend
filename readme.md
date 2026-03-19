# Agent Cabinet Frontend (Vue)

## Требования

- `Node.js` 20+ (или 18+)
- запущенный backend API

## Как запускать

1. Перейти в папку фронтенда:

```bash
cd phone-tokens-frontend
```

2. Установить зависимости:

```bash
npm install
```

3. Запустить dev-сервер:

```bash
npm run dev
```

Фронтенд будет доступен по адресу `http://localhost:5173`.

## Backend для локальной разработки

По умолчанию фронтенд проксирует запросы `/api/*` на `http://localhost:8080`, поэтому backend должен быть запущен на этом порту.

Пример запуска backend (из папки `phone-tokens-backend`):

```bash
make run
```

## Если backend на другом URL

Создайте файл `.env` в `phone-tokens-frontend`:

```bash
VITE_API_BASE_URL=http://localhost:8080
```

После изменения `.env` перезапустите `npm run dev`.

## Что реализовано

- Авторизация агента через `POST /api/v1/login`
- Регистрация с выбором роли (`user`/`agent`) и дополнительными полями для `agent`
- Раздел `Certificates`
- Раздел `SMS Logs`
- Раздел `Billing`
- Раздел `Tokens`
- Страницы `success` / `cancel` после checkout

## Важно

Для разделов `SMS Logs` и `Billing` нужен `agent_id` (UUID агента в backend). Его можно сохранить в левом блоке `Agent Context`.
