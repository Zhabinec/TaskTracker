# TaskTracker

Коммерческий трекер проектов и задач: Next.js App Router + FastAPI + PostgreSQL.

Архитектура и порядок реализации: [docs/architecture.md](docs/architecture.md). Развиваем продукт вертикальными сценариями в порядке раздела 17; бизнес-правила и доступ к данным остаются в FastAPI.

## Текущее состояние

Реализован основной каркас и вертикальный сценарий авторизации (шаги 1–2):

- Next.js с TypeScript, CSS variables, ESLint, серверным HTTP-клиентом и стартовой страницей;
- устанавливаемый пакет FastAPI с настройками окружения и health endpoints;
- зависимости зафиксированы в `frontend/package-lock.json` и `backend/uv.lock`;
- Dockerfiles с непривилегированными пользователями, локальный Compose с PostgreSQL;
- GitHub Actions: lint, typecheck, тесты, frontend build, npm audit и контейнерный smoke test.
- PostgreSQL через SQLAlchemy Async, Alembic и начальная схема `users` / `sessions`;
- отдельный migration job до запуска API и интеграционные тесты на настоящей PostgreSQL.
- регистрация, вход, восстановление сессии и выход с отзывом токена;
- формы Next.js, защищённая страница `/projects`, ошибки и pending-состояния;
- Argon2id, opaque sessions, Origin/CSRF-защита и общие PostgreSQL-лимиты попыток;
- генерируемые OpenAPI/TypeScript-контракты и браузерные Playwright-тесты.

Создание проектов и задач ещё не реализовано. `/projects` пока показывает текущий аккаунт и позволяет выйти; это первая рабочая защищённая страница.

## Быстрый старт и ручная проверка

Из корня репозитория в PowerShell:

```powershell
.\scripts\Start-Local.ps1
```

Скрипт создаёт `.env` со случайным паролем БД, только если файла ещё нет, затем собирает и запускает стенд. Открыть [TaskTracker](http://localhost:3000), создать аккаунт с паролем от 15 до 128 символов, обновить страницу, выйти и войти снова. Показ старого email после выхода не допускается; старый токен отозван в PostgreSQL. Тестовые аккаунты Playwright создаются со случайными email; для ручной проверки зарегистрируйте собственный.

Внешний адрес должен точно совпадать с `APP_ORIGIN` (по умолчанию `http://localhost:3000`): открытие через `127.0.0.1` при этом Origin не разрешает отправку форм. Изменение адреса требует обновления `APP_ORIGIN` и перезапуска frontend. Для публичного адреса допускается только HTTPS.

Остановка: `docker compose down`. Данные сохраняются в volume; последующий запуск скрипта восстанавливает стенд. Не удаляйте volume, если данные нужны.

`/health/live` возвращает 200 независимо от состояния БД. API `/health/ready` возвращает 200 только при доступной PostgreSQL и точном совпадении ревизий схемы с миграциями этого релиза. Отсутствующая, старая или более новая схема, неверные credentials и недоступная БД дают 503. Проверка ограничена тремя секундами, ответы не кешируются. Frontend `/health/ready` проверяет API серверным запросом. В production конфигурация БД обязательна.

## Требования

- Node.js 24 LTS и npm;
- Python 3.14 и uv 0.13.4;
- Docker Compose v2 для контейнерного стенда.

Timezone продукта: `Europe/Moscow`. Дедлайны в дальнейшем хранятся как календарные даты, технические timestamps — UTC.

## Локальная разработка

Сначала создать корневой `.env` из примера, установить случайный пароль БД и запустить PostgreSQL:

```powershell
Copy-Item .env.example .env
# Указать собственный POSTGRES_PASSWORD.
docker compose up -d --wait db
```

Backend, отдельный терминал PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
# TASKTRACKER_DB_PASSWORD должен совпадать с паролем в корневом .env.
uv sync --frozen
uv run --frozen alembic upgrade head
uv run --frozen uvicorn tasktracker.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, другой терминал:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Открыть http://localhost:3000. API-документация в development: http://127.0.0.1:8000/docs. В production документация отключена.

`FASTAPI_INTERNAL_URL` задаётся только серверу Next.js; префикс `NEXT_PUBLIC_` запрещён. Запросы к внешнему production API требуют HTTPS; HTTP разрешён только для loopback и имени `api` внутри Docker. Клиент использует известные endpoints из контракта, timeout 5 секунд, `no-store` и отказ от редиректов. Он передаёт только Bearer credential и CSRF-токен, когда сценарий их требует; произвольные cookies и headers не пересылаются.

### Сессии и защита запросов

Токен сессии — 32 случайных байта, срок по умолчанию 168 часов. В БД сохраняется только SHA-256 токена. Пароли хешируются Argon2id в ограниченном пуле потоков. Чтение `/auth/me` использует отдельный read scope; регистрация атомарно сохраняет пользователя и сессию. UNIQUE email разрешает гонку регистраций на уровне БД. Повторный вход с текущим credential заменяет и отзывает его; независимые устройства сохраняют собственные сессии.

Auth Route Handlers проверяют точный Origin, ограничивают тело 8 KiB и возвращают браузеру только `{ ok: true }` либо безопасную ошибку. Credential передаётся только в HttpOnly cookie (`SameSite=Lax`, `Path=/`, без Domain); на HTTPS используются Secure cookie с префиксом `__Host-`, локальный HTTP использует отдельные имена. Сессия не записывается в localStorage. CSRF-токен связан с конкретной сессией через HMAC; выход проверяется и Next.js, и FastAPI. При ошибке отзыва cookies сохраняются, чтобы выход можно было повторить. Прямые браузерные запросы с Origin в FastAPI отвергаются; backend предназначен для серверного BFF.

На login/register действуют фиксированные минутные лимиты: 5 попыток на нормализованный email и 60 суммарно. Счётчики общие для workers и хранятся в PostgreSQL; 429 возвращает Retry-After. Ключи email хешируются; старые окна удаляются. Значения настраиваются через `TASKTRACKER_AUTH_ACCOUNT_LIMIT` / `TASKTRACKER_AUTH_GLOBAL_LIMIT`. Это прикладное ограничение; публичный релиз также требует ограничения запросов на доверенном proxy/платформе. Восстановление пароля и подтверждение email ещё не реализованы.

## Контейнерный стенд

```powershell
Copy-Item .env.example .env
# Установить собственный случайный POSTGRES_PASSWORD в .env.
docker compose up --build --wait
docker compose down
```

Порты привязаны к loopback: 3000, 8000, 15432 (PostgreSQL; изменяется через `POSTGRES_PORT`). PostgreSQL хранит данные в named volume. `docker compose down` сохраняет его; удаление volume уничтожает локальные данные. Контейнерный API работает с production-настройками. Реальные секреты не включаются в build context.

Порядок запуска: PostgreSQL healthy → одноразовый `migrate` завершился успешно → API прошёл schema readiness → frontend. API не создаёт таблицы и не применяет миграции самостоятельно. Установленный пакет включает миграции; release job запускает `python -m tasktracker.infrastructure.db.migrate`. Пароль передаётся отдельным полем и безопасно обрабатывает специальные символы.

Это локальный стенд. Публикация требует TLS, управления секретами, настроенного proxy, резервного копирования и выбранной инфраструктуры из последующих этапов плана. Базовые образы закреплены по digest. Dependabot предлагает обновления npm, Dockerfiles и GitHub Actions; обновления Python и образа PostgreSQL пока проверяются вручную.

## Проверки

```powershell
cd backend
uv run --frozen ruff check src tests
uv run --frozen ruff format --check src tests
uv run --frozen mypy
uv run --frozen pytest

cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Контракты обновляются из кода FastAPI:

```powershell
cd backend
uv run --frozen python scripts/export_openapi.py
cd ../frontend
npm run contracts
```

В Git сохраняются OpenAPI snapshot и сгенерированные TypeScript-типы. CI повторяет генерацию и проверяет отсутствие расхождений.

Браузерные тесты выполняются против работающего полного стенда:

```powershell
cd frontend
npx playwright install chromium
npm run test:e2e
```

Они создают изолированные случайные аккаунты. `E2E_BASE_URL` и `E2E_API_URL` позволяют выбрать локальный тестовый стенд; не запускайте E2E против production. Trace/video выключены, чтобы не сохранять пароли и credentials в диагностических артефактах.

Фактические результаты текущей подготовки фиксируются в [docs/verification.md](docs/verification.md). CI запускается после размещения репозитория в GitHub; локальное наличие workflow не означает зелёный CI.

### Интеграционные тесты PostgreSQL

Из корня репозитория:

```powershell
docker compose -f compose.test.yaml up --wait
$env:TEST_DATABASE_URL = 'postgresql+asyncpg://tasktracker:isolated-tests-only@127.0.0.1:15433/tasktracker_test'
cd backend
uv run --frozen pytest
cd ..
docker compose -f compose.test.yaml down
Remove-Item Env:TEST_DATABASE_URL
```

Тестовый пароль публичный и предназначен только для изолированного стенда. Его данные находятся в tmpfs и удаляются при остановке контейнера. Порт меняется через `TEST_POSTGRES_PORT`; соответственно меняется URL тестов. Без `TEST_DATABASE_URL` интеграционные тесты явно пропускаются; CI запускает их отдельным обязательным job. Тесты отказываются работать с драйвером, отличным от PostgreSQL asyncpg, и с БД, имя которой не оканчивается на `_test`. Они откатывают и применяют схему; не направлять их на рабочие данные.

## Коммиты

Формат соответствует Finance Tracker: `type(scope): конкретное изменение`, на английском, без точки. Например, `feat(db): check schema revisions before accepting traffic`. Один коммит содержит законченное связное изменение с его проверками. В описании объясняем причину или неочевидное решение; названия вроде `updates`, `improvements` и `fix stuff` не используем.

## Следующий этап

Шаг 3: создать проект → увидеть свой список → открыть проект; обязательны сохранение после reload и изоляция владельцев. Затем — вертикальный сценарий создания задач из шага 4.
