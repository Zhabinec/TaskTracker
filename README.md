# TaskTracker

Коммерческий трекер проектов и задач: Next.js App Router + FastAPI + PostgreSQL.

Архитектура и порядок реализации: [docs/architecture.md](docs/architecture.md). Развиваем продукт вертикальными сценариями в порядке раздела 17; бизнес-правила и доступ к данным остаются в FastAPI.

## Текущее состояние

Подготовлен фундамент шага 1:

- Next.js с TypeScript, CSS variables, ESLint, серверным HTTP-клиентом и стартовой страницей;
- устанавливаемый пакет FastAPI с настройками окружения и health endpoints;
- зависимости зафиксированы в `frontend/package-lock.json` и `backend/uv.lock`;
- Dockerfiles с непривилегированными пользователями, локальный Compose с PostgreSQL;
- GitHub Actions: lint, typecheck, тесты, frontend build, npm audit и контейнерный smoke test.

Проекты, задачи, авторизация и миграции ещё не реализованы. PostgreSQL в Compose подготовлен для шага 2, API пока к нему не обращается. Контракты TypeScript будут генерироваться из OpenAPI вместе с первым прикладным API.

`/health/live` возвращает 200 у обоих приложений. API `/health/ready` намеренно возвращает 503 до появления проверки доступности БД **и версии схемы**. Frontend `/health/ready` проверяет готовность API серверным запросом и также возвращает 503 при недоступности upstream. В Compose пока проверяется жизнеспособность процессов; это не разрешение production-трафика.

## Требования

- Node.js 24 LTS и npm;
- Python 3.14 и uv 0.13.4;
- Docker Compose v2 для контейнерного стенда.

Timezone продукта: `Europe/Moscow`. Дедлайны в дальнейшем хранятся как календарные даты, технические timestamps — UTC.

## Локальная разработка

Backend, отдельный терминал PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
uv sync --frozen
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

Это локальный стенд. Публикация требует TLS, управления секретами, ограничений запросов, проверенной readiness, migration job, резервного копирования и выбранной инфраструктуры из последующих этапов плана. Базовые образы закреплены по digest. Dependabot предлагает обновления npm, Dockerfiles и GitHub Actions; обновления Python и образа PostgreSQL пока проверяются вручную.

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

## Следующий этап

Шаг 2: SQLAlchemy AsyncSession, PostgreSQL, проверенные Alembic-миграции, opaque sessions с хешами токенов, Argon2id, auth-мост Next.js, Origin/CSRF-защита и ограничения входа. После него — вертикальный сценарий создания и списка собственных проектов.
