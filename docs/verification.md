# Проверка подготовки проекта

Дата: 29 октября 2026 года. Объём: фундамент шага 1 и PostgreSQL/Alembic из шага 2 архитектурного плана.

## Пройдено фактически

| Проверка | Результат |
|---|---|
| Backend Ruff lint / format | успешно, 15 исходных файлов |
| Backend mypy strict | успешно |
| Backend pytest | 14 тестов (6 быстрых + 8 PostgreSQL), успешно, без предупреждений |
| Frontend ESLint 10 | успешно, без предупреждений |
| Frontend TypeScript | успешно |
| Frontend Vitest | 3 теста, успешно |
| Frontend production build | успешно локально и в Linux Docker |
| Backend Docker build | успешно, `uv sync --frozen --no-dev --no-editable` |
| Frontend чистая установка в Docker | `npm ci`, успешно, 0 найденных уязвимостей |
| npm audit runtime dependencies | 0 найденных уязвимостей на момент проверки |
| Docker Compose config | успешно |
| Полный временный Compose-стенд | migration job завершился с кодом 0; frontend, API и PostgreSQL healthy |
| HTTP frontend `/` | 200, HTML |
| HTTP frontend / API `/health/live` | 200, `status: ok` |
| HTTP frontend / API `/health/ready` после миграций | 200, `status: ok` |
| HTTP frontend / API readiness при остановленной БД | 503; liveness API остаётся 200 |
| HTTP API readiness после восстановления БД | снова 200 |
| HTTP production API `/docs` | 404 |
| Пользователи контейнеров | API uid 10001, frontend uid 1000 |
| Поиск `FASTAPI_INTERNAL_URL` / `api:8000` в клиентском `.next/static` | совпадений нет |
| Исключения Git | `.env.local`, backend `.env`, кеш и node_modules исключены |

Backend-тесты проверяют различие liveness/readiness, скрытие документации в production, timezone и конфигурацию БД. На отдельной PostgreSQL проверены upgrade → downgrade → upgrade, повторный upgrade, отсутствие расхождения ORM и миграции через Alembic check, отказ readiness для более новой схемы, UNIQUE email, конкурентная вставка одного email, rollback после выполненного INSERT, FK и ограничения сессий, timezone-aware timestamps, readiness при неверном пароле и недоступной БД. Таблицы не создаются через `create_all`.

Frontend-тесты проверяют отказ без конфигурации, запрет credential в URL и внешнего plaintext production upstream, запрет кеширования/редиректов и наличие timeout signal. Frontend в этом этапе не менялся; его проверки в таблице относятся к исходной подготовке. Контейнерный smoke test проверен повторно с новой схемой backend.

## Решения по совместимости

- Node.js 24 LTS, Python 3.14; точные зависимости — в lock-файлах.
- TypeScript 6.0.3: текущий TypeScript ESLint parser ещё не поддерживает TypeScript 7.
- ESLint 10 с официальными плагинами Next.js, React Hooks и TypeScript. Общий `eslint-config-next` заменён явной конфигурацией, поскольку его транзитивные React/import/a11y плагины ограничивали peer dependency до ESLint 9. Правила Next Core Web Vitals и React Hooks включены. Полная проверка доступности остаётся обязательной при реализации интерфейсов.
- Docker-образы Python, Node, uv и PostgreSQL закреплены по проверенным digest; официальные GitHub Actions закреплены по commit SHA.
- На этой машине порт 5432 занят существующей БД, а 55432 попадает в исключённый Windows диапазон. Используется проверенный порт 15432; он настраивается через `POSTGRES_PORT`.

## Границы проверки

Проверки не подтверждают готовность продукта к приёму пользовательских данных. ORM и начальная схема пользователей/сессий реализованы, но регистрация и управление сессиями ещё отсутствуют. Положительная readiness подтверждает только доступность и совместимость схемы БД с этим релизом.

Не выполнялись auth/CSRF/E2E сценарии, тесты конкуренции прикладных команд проектов и задач, аудит Python-зависимостей, полный поиск секретов специализированным сканером, backup/restore и публичный деплой: эти части ещё предстоит реализовать. npm audit не заменяет общий аудит безопасности.

Workflow CI подготовлен, но не запускался на GitHub: репозиторий инициализирован только локально, remote и публикация не настроены. Локальные проверки этого не подменяют.

Проверки выполнялись вне песочницы там, где она блокировала сеть, Docker, создание standalone-файлов или выполнение Python-тестов. После ошибочного захвата кеша первым запуском Ruff кеш исключён из его обхода, Python-окружение пересоздано из lock-файла; результаты выше относятся к чистому окружению.
