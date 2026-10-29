# TaskTracker

Коммерческий трекер проектов и задач: Next.js App Router + FastAPI + PostgreSQL.

Архитектура и порядок реализации: [docs/architecture.md](docs/architecture.md). Развиваем продукт вертикальными сценариями в порядке раздела 17; бизнес-правила и доступ к данным остаются в FastAPI.

## Текущее состояние

Подготовлен фундамент шага 1 и часть шага 2, отвечающая за хранение данных:

- Next.js с TypeScript, CSS variables, ESLint, серверным HTTP-клиентом и стартовой страницей;
- устанавливаемый пакет FastAPI с настройками окружения и health endpoints;
- зависимости зафиксированы в `frontend/package-lock.json` и `backend/uv.lock`;
- Dockerfiles с непривилегированными пользователями, локальный Compose с PostgreSQL;
- GitHub Actions: lint, typecheck, тесты, frontend build, npm audit и контейнерный smoke test.
- PostgreSQL через SQLAlchemy Async, Alembic и начальная схема `users` / `sessions`;
- отдельный migration job до запуска API и интеграционные тесты на настоящей PostgreSQL.

Проекты, задачи и авторизация ещё не реализованы. Таблицы пользователей и хешей сессий подготовлены для auth-сценариев; наличие таблиц не означает работающий вход. Контракты TypeScript будут генерироваться из OpenAPI вместе с первым прикладным API.

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

`FASTAPI_INTERNAL_URL` задаётся только серверу Next.js; префикс `NEXT_PUBLIC_` запрещён. Запросы к внешнему production API требуют HTTPS; HTTP разрешён только для loopback и имени `api` внутри Docker. Клиент использует allowlist endpoints, timeout 5 секунд, `no-store` и отказ от редиректов. Авторизационные заголовки появятся вместе с auth-сценарием; произвольные cookies и headers не пересылаются.

## Контейнерный стенд

```powershell
Copy-Item .env.example .env
# Установить собственный случайный POSTGRES_PASSWORD в .env.
docker compose up --build --wait
docker compose down
```

Порты привязаны к loopback: 3000, 8000, 15432 (PostgreSQL; изменяется через `POSTGRES_PORT`). PostgreSQL хранит данные в named volume. `docker compose down` сохраняет его; удаление volume уничтожает локальные данные. Контейнерный API работает с production-настройками. Реальные секреты не включаются в build context.

Порядок запуска: PostgreSQL healthy → одноразовый `migrate` завершился успешно → API прошёл schema readiness → frontend. API не создаёт таблицы и не применяет миграции самостоятельно. Установленный пакет включает миграции; release job запускает `python -m tasktracker.infrastructure.db.migrate`. Пароль передаётся отдельным полем и безопасно обрабатывает специальные символы.

Это локальный стенд. Публикация требует auth-сценариев, TLS, управления секретами, ограничений запросов, резервного копирования и выбранной инфраструктуры из последующих этапов плана. Базовые образы закреплены по digest. Dependabot предлагает обновления npm, Dockerfiles и GitHub Actions; обновления Python и образа PostgreSQL пока проверяются вручную.

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

Продолжение шага 2: opaque sessions с хешами токенов, Argon2id, auth-мост Next.js, Origin/CSRF-защита и ограничения входа. После него — вертикальный сценарий создания и списка собственных проектов.
