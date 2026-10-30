# TaskTracker

Локальное пространство для проектов и задач с glassmorphism-интерфейсом. Без почты, пароля и серверной регистрации. Данные остаются в IndexedDB этого браузера; после первой подготовки PWA приложение работает без сети.

## Запуск

```powershell
.\scripts\Start-Local.ps1
```

Открыть [TaskTracker](http://localhost:3000). Назвать пространство, создать проект и добавить задачи. Статус выбирается явно: To do, In progress или Done — в том числе сразу при создании. Можно добавлять списком по строкам, выделять несколько задач, менять им статус вместе и удалять после подтверждения. Доступны дедлайн, фильтры, ограниченная загрузка и обновления между вкладками. Черновики новых проектов/задач и редактирования сохраняются автоматически. Для восстановления используйте Project drafts / Saved drafts → Resume; Cancel/Escape удаляет черновик правок.

Остановка: `docker compose down`. Для текущего режима достаточно frontend: API и PostgreSQL по умолчанию не запускаются. Облачная заготовка Identity доступна через `docker compose --profile cloud up --build --wait`; Workspace service и синхронизация ещё не реализованы.

Скрипт не перезаписывает существующий `.env`. Приватные env-файлы, локальные данные браузера и результаты тестов не включаются в Git. При изменении Next.js используйте новый build и перезапустите frontend. PWA предложит «Update», если открыт старый кеш.

## Телефон и офлайн

Дождитесь индикатора «Offline ready», затем можно отключить интернет, перезагрузить приложение и продолжить работу. Оболочка и её ресурсы кешируются отдельно от пользовательских данных.

На компьютере работает localhost. На телефоне для первого открытия и установки на экран «Домой» нужен доступный **HTTPS-адрес** приложения; localhost телефона указывает на сам телефон. Простой HTTP по IP компьютера не включает service worker. После установки и подготовки оболочки интернет не требуется. Реальный iOS/Android стенд и публичный HTTPS в этом этапе не разворачивались.

Проекты принадлежат конкретному origin и профилю браузера. Для переноса на другое устройство используйте Backups → Export backup / Import backup. Восстановление добавляет новые копии проектов после проверки и подтверждения; существующие данные сохраняются. Backup переносит подтверждённые задачи, но не незавершённые черновики. Облачной синхронизации нет. Очистка данных сайта удаляет локальные данные. Локальное имя — удобная настройка пространства, а не аутентификация и не шифрование данных.

## Разработка

```powershell
cd frontend
npm ci
npm run dev
```

Dev-сервер показывает UI и использует IndexedDB, но service worker включается только в production-сборке. Для полноценной офлайн-проверки используйте Docker либо `npm run build` и `npm start`.

CSS Modules и variables, локальные Plus Jakarta Sans (заголовки) и Inter (основной текст), анимации с reduced-motion и небольшой Client Component для pointer-параллакса. Страницы и layout остаются Server Components; локальные формы, IndexedDB и интерактивность находятся в Client Components.

## Проверки

```powershell
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E выполняется против запущенной production-сборки. Он проверяет открытие без credentials, проекты/задачи, reload без сети, создание данных офлайн, изоляцию проектов, межвкладочные обновления, мобильную ширину и reduced motion. Данные тестов изолированы браузерными контекстами.

Серверные проверки Identity остаются отдельными:

```powershell
docker compose -f compose.test.yaml up --wait
$env:TEST_DATABASE_URL = 'postgresql+asyncpg://tasktracker:isolated-tests-only@127.0.0.1:15433/tasktracker_test'
cd backend
uv sync --frozen
uv run --frozen ruff check src tests scripts
uv run --frozen mypy
uv run --frozen pytest
cd ..
docker compose -f compose.test.yaml down
Remove-Item Env:TEST_DATABASE_URL
```

Identity использует PostgreSQL, Argon2id и opaque sessions. SQL-проекции выбирают только поля, нужные сценарию. Миграции применяются отдельным release job; local-first клиент не обращается к auth API.

OpenAPI-контракты Identity: `cd backend; uv run --frozen python scripts/export_openapi.py`, затем `cd ../frontend; npm run contracts`. CI проверяет отсутствие расхождений. CI на GitHub пока не запускался: remote не настроен.

## Архитектура и коммиты

[Актуальные решения и границы сервисов](docs/architecture.md). [Результаты проверок](docs/verification.md). [Сценарии и оставшиеся критерии релиза](docs/release-readiness.md). Исходный облачный план сохранён отдельно; монолит и обязательный вход заменены local-first подходом.

Формат коммитов как в Finance Tracker: `type(scope): конкретное изменение`, по-английски, без точки. Один коммит — законченное связное изменение с проверками и причиной неочевидных решений.
