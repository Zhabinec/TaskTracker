# Фактические проверки

29 октября 2026 года. Текущий продукт: local-first клиент с glassmorphism-дизайном; Identity остаётся отдельной необязательной серверной заготовкой.

| Проверка | Результат |
|---|---|
| Frontend ESLint / TypeScript | пройдены |
| Frontend Vitest | 14 тестов пройдены |
| Production build локально и в Docker | пройден |
| Playwright Chromium | локальное пространство, офлайн-перезагрузка, изоляция проектов, мобильная вёрстка, вкладки, обновление оболочки |
| Backend Ruff / mypy | пройдены |
| Backend pytest | 24 теста на выделенной PostgreSQL и в памяти пройдены |
| npm audit при чистой Docker-установке | 0 обнаруженных уязвимостей |
| Работа UI без API/PostgreSQL | cloud-контейнеры остановлены; frontend остаётся healthy |

## Офлайн и данные

Интерфейс переведён на английский. Проверены Plus Jakarta Sans в заголовках и Inter в основном тексте через computed styles, загрузка реального FontFace после offline reload и наличие всех трёх локальных font-файлов в Cache Storage. Шрифты и английская вёрстка просмотрены на desktop/mobile; 14 unit-тестов и 5 браузерных сценариев проходят.

Проверено: открытие без email/пароля и без вызовов /api/*, создание пространства, проектов и задач, смена статуса, дедлайн, повторный reload после Playwright setOffline(true), создание новой задачи и первого пространства уже без сети, переход к настройкам пространства без сети. Проверены фильтры, изоляция проектов и отражение изменений из другой вкладки.

Unit-тесты используют IndexedDB-compatible реализацию fake-indexeddb: сохранение профиля, атомарность задачи и счётчиков, rollback при отсутствующем проекте, конфликт одновременных обновлений одной версии, ограничение начального чтения 50 записями и фильтрация по составному индексу. completedAt сохраняется при повторном Done; невалидная календарная дата не записывается.

Оболочка PWA кешируется по build id, вместе с её hashed JS/CSS. Браузерный тест проверяет обновление service worker и сохранение IndexedDB. Данные пользователя не кладутся в HTTP-кеш. В мобильном viewport 390px нет горизонтального скролла, Tab перемещает фокус к действию; reduced-motion поддержан. Скриншоты desktop/mobile входа и рабочего пространства просмотрены.

## SQL и серверная часть

Профиль сессии выбирается одним SELECT с users.id и users.email_normalized, без password_hash/created_at и без материализации ORM-сущности. Тест наблюдает реально выполненный SQL. Login получает ровно id/email/password_hash. В обоих случаях LIMIT 1; условия соответствуют существующим UNIQUE email и token_hash. Высоконагрузочный benchmark и SLA latency не проводились.

Остальные 23 теста Identity по-прежнему покрывают миграции, проверку schema readiness, регистрацию, Argon2id, хеши opaque sessions, logout, срок сессии, конкурентную регистрацию, CSRF/Origin, общие лимиты workers, HTTP body limits, rollback и отмену транзакции. Cloud/BFF unit-тесты сохранены как проверки необязательного облачного адаптера; локальный UI его не использует.

## Границы

Это PWA, а не нативный APK/desktop-пакет. Для установки на физический телефон нужен доступный HTTPS-origin; на компьютере работает localhost. Публичный HTTPS и реальные iOS/Android устройства здесь не проверялись; мобильные тесты выполнялись в Chromium с эмуляцией viewport. Профиль локального браузера не является серверной аутентификацией или шифрованием. Синхронизация, переносимый backup/import, полноценное редактирование/архив и отдельный Workspace service ещё не реализованы.

CI обновлён: optional cloud stack проверяется отдельно, браузерные тесты проверяют local-first сценарии. GitHub CI ещё не запускался: remote не настроен. Локальные .env, PWA build id/icons и диагностические артефакты исключены из Git.
# Проверка редактирования задач — 2026-10-30

- Production Docker build и healthcheck прошли; локальный frontend обновлён.
- Frontend lint/typecheck прошли, Vitest: 15 тестов, Playwright Chromium: 7 сценариев.
- Подтверждены offline edit/reload, Escape/Cancel, возврат фокуса, сохранение дедлайна,
  сохранение статуса/completedAt/счётчиков, отклонение устаревшего черновика.
- При изменении из другой вкладки открытый черновик сохраняется; конфликт показан
  рядом с формой и не перезаписывает актуальную запись.
- Редактор проверен на 375 × 812 и 812 × 375, с reduced motion; горизонтального
  overflow нет. Скриншот mobile просмотрен. Физические телефоны не проверялись.
- UI/UX Pro Max и shadcn skills уже установлены. shadcn CLI проверил Next/RSC и
  отсутствие Tailwind/config. Astryx CLI 0.7.4 предоставил официальный каталог tokens.
  Runtime-зависимости shadcn/Astryx в приложение не добавлялись.

# Проверка сценариев локального релиза — 2026-10-30

- Production Docker build/healthcheck, frontend lint/typecheck: успешно.
- Vitest: 23 теста в 4 файлах. Playwright Chromium: 9 сценариев, успешно (21.5 s).
- Явный статус при создании и редактировании, создание сразу Done, batch до 100
  задач, групповые статусы и атомарный rollback при конфликте версии.
- Счётчики/даты завершения не дрейфуют при повторном Done и повторном открытии;
  невалидная строка/статус/дата отменяет batch до записи.
- Мобильный E2E (375 px): несколько Done-задач сразу, частичный выбор,
  смена статуса из активного фильтра и View destination, отмена/подтверждение
  массового удаления, reload без сети. Screenshot batch-composer-mobile просмотрен.
- Офлайн скачан настоящий JSON-файл; проверены preview до импорта, отказ от
  неподдерживаемого формата, импорт копиями и сохранность после reload.
- Unit-проверки backup: дубликаты ID, отсутствующий проект, несовместимая версия,
  невалидные даты/статусы/completedAt, некорректный JSON и превышение размера.
  При восстановлении новые IDs/ссылки, счётчики пересчитываются из задач.
- Backend не изменялся и повторно не проверялся. CI remote, Firefox/WebKit,
  физические телефоны и HTTPS-деплой не проверены; критерии до публичного
  релиза перечислены в release-readiness.md.

# Защита черновиков — 2026-10-30

- Production Docker build и healthcheck прошли; lint/typecheck без ошибок.
- Vitest: 31 тест в 6 файлах. Проверены миграция IndexedDB v1→v2 с
  сохранением существующих данных, сериализация быстрых изменений, отказ записи
  и Retry, expected version черновиков, атомарное создание задачи/очистка черновика,
  rollback при конфликте задачи и сохранение текста другого режима single/batch.
- Идентификатор черновика меняется после использования/удаления и при отсутствии
  записи после перезагрузки: старый writer не сможет совпасть с новой version 1.
- Playwright Chromium: 16 сценариев, включая 7 новых сценариев черновиков:
  проекты/фильтры и offline reload; Resume/Save/Cancel редактирования;
  две вкладки и Keep my copy; реальная активация обновления PWA;
  принудительный отказ draft put и beforeunload guard/Retry;
  восстановление из новой вкладки после закрытия исходной;
  Add as new task после удаления оригинала в другой вкладке.
- Восстановленный редактор проверен на 375 × 812, скриншот просмотрен,
  горизонтального overflow нет. Остальные предыдущие E2E также проходят.
- Найдена и исправлена гонка PWA: Offline ready появляется только после
  подключения страницы к service worker; при необходимости клиент отправляет
  CLAIM_CLIENTS уже активному worker.
- beforeunload проверен отправкой отменяемого события в браузере. Подавление
  предупреждений мобильной ОС и аварийное завершение процесса не проверялись.
  Физические телефоны, Firefox/WebKit, remote CI и публичный HTTPS остаются
  отдельными критериями приёмки.

# Local 1.0.0-rc.1 — 2026-10-30

- Frontend lint/typecheck и production Docker build проходят. Unit/storage:
  41 тест в 9 файлах. Отдельно подтверждены v1→v3 и v2→v3 миграции,
  сохранность старого черновика/Task.version, курсор без повторов, поиск по описанию,
  дедлайны по локальному календарю, архив/read-only и конфликт метаданных проекта.
- Операции переноса проверяют version каждой задачи, сохраняют status/completedAt
  и атомарно меняют оба счётчика. Конфликт/архив получателя откатывает весь batch.
- Backup v2 сохраняет state/description, принимает v1; round trip пустой базы и
  1,000 задач успешен. Ошибка записи при импорте откатывает созданные проекты.
- Сервер: ruff check/format, mypy и все 24 pytest-теста успешны. PostgreSQL был
  отдельным tmpfs-контейнером compose.test.yaml, после проверки остановлен/удалён.
- npm audit --omit=dev --audit-level=high: 0 vulnerabilities. Версии зависимостей
  не менялись; обновлён только номер локального приложения до 1.0.0-rc.1.
- Браузерная матрица: 22 сценария × Chromium/Firefox/WebKit — 66 passed (4.7m). Запускается через
  scripts/Test-Browsers.ps1 в официальном Linux Playwright 1.64.1, закреплённом digest.
  Для service worker loopback-прокси сохраняет localhost как secure context.
- В Firefox найдено блокирующее ожидание navigator.storage.persist(); разрешение
  теперь запрашивается фоном после сохранения профиля. Cancel черновика входит
  в pending queue, Update/flush ждёт удаления. Фокус редактора восстанавливается
  после DOM commit через useLayoutEffect. Эти регрессии покрыты тестами.
- В WebKit первая подготовка service worker могла выходить за 10-секундное
  ожидание теста. Подготовка ограничена таймаутом, есть Preparing/Retry; ожидание
  именно Offline ready допускает 30 s. Сценарий отказа register и Retry проверяется
  во всех движках. Автоматические повторы тестов отключены.
- Desktop/mobile скриншоты workspace/editor просмотрены; mobile inputs имеют
  размер 16px, формы не выходят за горизонтальные границы viewport.
- Caddyfile проверен caddy validate, Compose HTTPS overlay — config --quiet.
  Proxy не запускался; публичные DNS, порты и сертификат не проверены.
- Windows-пакет Firefox 1555 не запустился (mozglue/SxS); тестирование перенесено
  в штатный Linux-образ, не подменяет бинарники и не меняет настройки ОС.
- Физические iOS/Android, remote CI и настоящая публикация остаются приёмкой
  окружения. Инструкция: release.md. Workspace service/облачная синхронизация
  не входят в этот локальный RC и не объявляются реализованными.

## 2026-11-10 — переносы и мобильное рабочее пространство

- Frontend lint, TypeScript и 42 теста в 9 файлах прошли. Новый storage-сценарий
  проверяет фактическое число переносов, отсутствие изменений у same-project
  записи и смешанный набор. Существующая проверка rollback при stale task прошла.
- Production Docker build прошёл; frontend healthy. Схема IndexedDB остаётся v3,
  зависимости и границы облачных сервисов не менялись.
- 25 сценариев × Chromium/Firefox/WebKit: 75 passed (5.2m), без retries,
  scripts/Test-Browsers.ps1, закреплённый Linux Playwright image.
- Новые E2E: перенос в текущий проект не меняет и не объявляет смену статуса;
  мобильное Manage сохраняет черновик при сворачивании, возвращает фокус,
  оставляет прогресс и переключение проектов доступными; Retry workspace
  восстанавливается после временной ошибки чтения без reload.
- Дополнительный изолированный Edge smoke: Retry projects восстанавливает select,
  введённый текст редактора сохраняется. Desktop 1440px и mobile 390px скриншоты
  просмотрены. Автоматически измерены основные исправленные touch targets ≥44×44.
- Physical-device keyboard/safe-area/overlay acceptance, HTTPS deployment and
  remote CI remain external acceptance. Backend was unchanged and not rerun.

## 2026-11-10 — диалог задачи

- TaskCard — отдельный компонент представления. Клик по названию, статусу или
  свободной области карточки открывает native modal с названием, датой и статусом.
  Описание и проект доступны в More details. У карточек больше нет отдельного
  status select. Групповые операции по-прежнему используют явный выбор статуса.
- Общий Modal отвечает только за dialog/portal/scroll lock. TaskEditor сохраняет
  изменения через существующие draft/version-checked операции. Close, Cancel и
  Escape удаляют edit draft; reload сохраняет его для Resume. Операции БД,
  IndexedDB v3 и зависимости не менялись.
- Lint, TypeScript, 42 unit/storage tests и production Docker build прошли.
  Desktop/mobile окно просмотрено через изолированный Edge. Native dialog
  оставляет фон inert; переход Tab в chrome самого браузера разрешён.
- Во время проверки обнаружен ложный Update available после installed event без
  waiting worker. Сценарий отдельно воспроизведён на предыдущей сборке в Edge;
  runtime теперь проверяет реального waiting worker и очищает ожидание после
  controllerchange. Добавлен детерминированный браузерный regression test.
- Первый прогон новой матрицы выявил слишком строгое ожидание фокуса внутри
  документа и ложный update notice. После исправлений финальный полный прогон:
  27 сценариев × Chromium/Firefox/WebKit — 81 passed (5.1m), без retries.
  В том числе проверены открытие по статусной области карточки, совместное
  сохранение имени/даты/статуса, клавиатура, Close/Cancel/Escape, возврат фокуса,
  восстановление черновика после reload и защита от межвкладочных конфликтов.

## 2026-11-10 — визуальный ритм, иконки и движение

- Добавлены общие Icon, IconButton и DisclosureSummary: единый SVG grid/stroke,
  выравнивание через flex, aria-label/title для кнопок без текста. Убраны шрифтовые
  символы в действиях карточек, закрытии, добавлении и бренде.
- Уменьшены повторные подписи поиска и уведомлений; сохранённые черновики и offline
  readiness показываются иконками с доступным status text. Ошибки, подтверждение
  удаления, статусы задач и важные действия сохраняют текстовые названия.
- Расширены интервалы панелей/карточек/форм; исправлены центровка счётчиков проектов,
  SVG в кнопках и высоты поиска/списков. До 900px проектная панель компактна, чтобы
  задачи не занимали узкую колонку. Desktop/mobile/tablet скриншоты просмотрены.
- Введены motion tokens 160/280ms для обратной связи и появления панелей, списка,
  диалога; reduced-motion полностью отключает переходы и анимации. Постоянной
  анимации карточек нет. Новых runtime-зависимостей не добавлено.
- Frontend lint, TypeScript и production Docker build прошли. Unit/backend suites
  не перезапускались: изменения относятся к представлению, не к хранилищу/сервисам.
- Визуальный сценарий проверяет 320/390/768/1024/1440px, отсутствие горизонтального
  overflow, aria-label и размеры icon buttons ≥44px, смещение центра SVG ≤1px,
  появление modal и полное отключение анимации с reduced-motion. Он прошёл в
  Chromium/Firefox/WebKit; итоговые desktop/mobile/tablet экраны просмотрены.
- Полная production-матрица: 83 passed, 1 failed (5.9m). WebKit offline-edit case
  получил Offline setup unavailable при первой подготовке через навигацию.
  Для проверки именно редактирования shell prerequisite теперь явно готовится
  на entry page; первичная установка и Retry остаются отдельными сценариями.
  После изменения только тестовой подготовки этот case отдельно прошёл во всех
  трёх движках (3 passed, 20.5s), на той же production-сборке. Автоматических retries
  нет; повторный чистый полный прогон не выполнялся. Первичная подготовка может
  потребовать существующий Retry; физическая приёмка остаётся открытой.

## 2026-11-10 — восстановление первой установки PWA

- Старый сбой воспроизведён управляемым HTTP 503 для одного файла precache:
  WebKit оставлял частичный кеш, но ни одного registration/controller; ожидание
  Offline ready заканчивалось ошибкой. Простой быстрый вход без инъекции прошёл
  8 раз и не давал надёжного воспроизведения, поэтому использован loopback proxy,
  работающий с реальными worker requests во всех движках, без флагов в приложении.
- shared/pwa/offline-shell.ts наблюдает activated/controller и redundant вместо
  бесконечного глобального ready. Первичная неудачная установка повторяется один
  раз в том же общем бюджете 25 секунд; постоянный отказ оставляет ручной Retry.
  AbortSignal отменяет ожидания и снимает подписки при навигации. В offline режиме
  уже активный controller не заменяется worker с выдуманным fallback build id.
- Ранее добавленное предварительное ожидание на entry page в offline-edit E2E
  удалено: основной сценарий снова входит сразу, создаёт работу во время подготовки
  и затем проверяет offline edit/Cancel/Escape. Дополнительные сценарии держат
  asset request незавершённым во время навигации, выдают разовый 503 и постоянные
  503 с последующим явным Retry. Playwright retries остаются отключены.
- Первая реализация повторной установки выявила вторую проблему WebKit: controller
  уже activated, но в CacheStorage оставались assets без `/login` и `/projects`.
  Попытки установки теперь используют независимые cache ids; URL текущей сборки
  сохраняется при навигации. Install проверяет наличие каждой страницы и asset
  до публикации. Четыре целевых WebKit-сценария после этого прошли, включая
  настоящую перезагрузку без сети после разового/постоянного отказа.
- Lint, TypeScript, production Docker build и 50 тестов в 10 файлах прошли.
  Восемь новых модульных сценариев проверяют bounded retry, реальное получение
  управления, отмену и очистку таймеров/слушателей, поздний register result,
  старый активный worker с ожидающим update, сохранение same-build URL и работу без сети.
- UI-оформление, IndexedDB v3, SQL и облачные границы не менялись. Backend не
  перезапускался; физические телефоны, настоящий HTTPS и remote CI остаются
  отдельной приёмкой окружения.
- Итоговый чистый полный production-прогон: 31 сценарий × Chromium/Firefox/WebKit,
  **93 passed (7.3m)**, retries=0. Пройден исходный быстрый offline-edit сценарий
  без предварительного ожидания на entry page, а также реальные cache faults,
  получение управления, офлайн-перезагрузка и все предыдущие сценарии данных/UI.
  В mobile-management тесте уточнено ожидание завершения создания второго проекта
  перед его переключением; итоговый прогон выполнен целиком с окончательным кодом.

## 2026-11-11 — Render и Android release acceptance

- Выбраны Render и физический Android. Добавлены Docker Blueprint с health check
  `/health/ready`, деплоем после CI и Free только для приёмки; для публичного
  production требуется отдельно выбранный платный compute. Ни сервис, ни платный
  тариф в Render пока не создавались: подключение аккаунта не подтверждено.
- Blueprint проверен по официальной `https://render.com/schema/render.yaml.json`
  через установленный транзитивный Ajv 2020, без новых зависимостей. URI format
  не проверялся валидатором; Blueprint не содержит полей с этим format.
- Optional Identity origin принимает `RENDER_EXTERNAL_URL` только при `RENDER=true`;
  явный APP_ORIGIN имеет приоритет. Проверки exact origin, HTTPS и Secure cookies
  сохранены. Lint, TypeScript и 57 unit tests в 11 файлах прошли, включая 7 новых
  проверок deployment origin. IndexedDB и границы облачных сервисов не менялись.
- Production Docker image собран; временный контейнер с PORT=10000 и Render env
  успешно ответил `/health/ready`. Контейнер остановлен после проверки.
- Новый Test-Deployment.ps1 прошёл на локальном production: health, manifest,
  HTML оболочки, worker/build no-store, иконки и три font assets. Проверены отказы
  для public HTTP, URL с path/query/credentials. Локальная проверка не доказывает TLS.
  Скрипт добавлен в GitHub containers job для последующих запусков.
- Целевой production E2E: создание проекта/задач и reload без сети — 3 passed
  (36.8s), Chromium/Firefox/WebKit, retries=0. Полная предыдущая матрица 93 passed
  сохранена выше; повторять её локально для deployment config не требовалось.
- Документирован реальный Android install/offline/backup/text-scale checklist и
  update/rollback rehearsal с build IDs и сохранёнными данными. Публичный TLS,
  физическая приёмка и откат остаются pending до выполнения в окружении Render.

## 2026-11-11 — проверка опубликованной сборки Render

- Через существующий Blueprint в Dashboard подтверждён Live deploy
  `dep-dbpq83oae00c73capdt0` сервиса `srv-dbpq83gae00c73capcng`, SHA `83052ef`.
  Адрес: https://tasktracker-7wc0.onrender.com. Все четыре jobs этого SHA прошли:
  https://github.com/Zhabinec/TaskTracker/actions/runs/42918195830.
- Test-Deployment.ps1 успешно проверил публичный HTTPS, health endpoints,
  некешируемые worker/build metadata, manifest, страницы, иконки и локальные fonts.
  Повторная проверка с ExpectedBuild подтвердила тот же build
  `1e8b5913-12c6-4c15-ae38-6535aa08a8e1`. В in-app browser приложение загрузилось
  и показало Offline ready. TLS не обходился, пользовательское хранилище не очищалось.
- Production E2E выполнялись непосредственно против HTTPS Render в изолированных
  browser contexts. local.spec: 31 passed, 2 failed (5.4m), один worker;
  drafts/lifecycle/usability: 50 passed, 1 failed (4.2m), два workers одновременно
  с первым прогоном. Chromium и Firefox: по 28/28 passed. WebKit: 25/28 passed.
- Три WebKit failures ожидали Offline ready: первый быстрый вход, первый startup
  перед worker update и rename/archive lifecycle. Диагностика первых двух содержала
  заполненный shell cache и worker/controller в состоянии activating. В lifecycle
  достигнут общий test timeout. Во время проверки наблюдалась высокая CPU-нагрузка
  WebKit-контейнера; это наблюдение, а не установленная причина сбоя.
- После завершения обоих контейнеров три проблемных сценария повторены по два раза
  последовательно в WebKit, workers=1, без изменения приложения, ожиданий или retries:
  6 passed (1.5m). Это не исправление и не чистый полный повтор всех 84 сценариев.
  Нестабильность первой подготовки WebKit оставлена открытым критерием приёмки.
- Проверены проекты/задачи, offline reload/edit, bulk/status/moves, backups,
  draft recovery/conflicts, archive/search/pagination и мобильные размеры/центрирование.
  Update E2E регистрируют worker другой версии в browser context; они не заменяют
  фактический deploy B/rollback A в Render. Физический Android также ещё не проверен.
- Девять fault-proxy сценариев из pwa-startup.spec выполнялись в прежней CI/local
  матрице, а не против HTTPS: существующий loopback proxy использует HTTP upstream.
  Код приложения и IndexedDB в этой проверке не менялись. Free compute сохранён.

## 2026-11-11 — Telegram menu launcher

- Владелец выбрал Mini App через `@TaskTrackerPetBot` вместо обязательной установки
  PWA на физический Android. Отдельный постоянно работающий bot backend не добавлен:
  текущее действие бота — открыть существующий HTTPS frontend через Web App menu.
- Bot API getMe подтвердил ожидаемый username. Default menu настроено как Open app
  → `https://tasktracker-7wc0.onrender.com/login`; последующий getChatMenuButton
  подтвердил сохранение. Profile Main Mini App остаётся выключенным по getMe.
  Токен находится в игнорируемом deploy/.env.telegram.local вне frontend context;
  в Git добавлен только пустой example. Сообщения в Telegram не отправлялись.
- scripts/telegram-menu.mjs поддерживает read-only preview, проверку bot identity,
  readiness перед изменением, идемпотентность и readback. Bot API form payload
  содержит JSON-serialized menu_button и явный Content-Length. Ошибки не печатают
  URL с токеном или raw API descriptions. Семь Node tests прошли; добавлены в CI.
- Глобальный X-Frame-Options DENY мешал Telegram Web iframe. Теперь только /login
  и /projects разрешают CSP frame-ancestors https://web.telegram.org; остальные
  ответы имеют frame-ancestors 'none'. Никакой wildcard или отключения CSP нет.
  Локальная production HTTP-проверка подтверждает итоговые заголовки и PWA assets.
- Lint, TypeScript, 57 frontend unit tests и production Docker build прошли.
  Финальный чистый Telegram E2E: 6 passed (10.3s), retries=0, три browser engines.
  Проверяются реальные HTTP-заголовки и работа CSP на инертном HTTPS iframe probe.
  Ранняя фикстура была некорректна из-за mixed content; обращение к уже заблокированному
  iframe зависало в Firefox. Итоговая проверка использует HTTPS и authoritative CSP
  console error, не обращаясь к документу, загрузку которого браузер запретил.
- Схема IndexedDB, UI и доменные операции не менялись. Telegram SDK, нативные
  Telegram controls и server-side Telegram authentication не добавлены. Фактический
  запуск приложения в Telegram-клиенте и повторный публичный smoke новой сборки
  ещё требуют соответствующей проверки. WebKit startup finding остаётся открытым.

### Публикация Telegram-версии

- SHA `5e38bd9` прошёл backend/frontend/database/containers CI:
  https://github.com/Zhabinec/TaskTracker/actions/runs/42925646820.
- Автоматический deploy не появился после завершения CI. Через Render Dashboard
  выполнен Deploy latest commit; подтверждены source `5e38bd9` и Live deploy
  `dep-dbpquq0u01pc738uic70` (39.4s). Причина отсутствия auto-trigger не установлена.
- Публичный Test-Deployment.ps1 прошёл; build
  `7c0f4d23-2710-4d12-9596-85128dbe55f6`. Подтверждены HTTPS, health, shell assets,
  manifest, no-store и новая ограниченная frame-ancestors политика.
- Публичный Telegram policy E2E: **6 passed (27.5s)**, Chromium/Firefox/WebKit,
  retries=0. Пробник проверяет реальные заголовки; он не является авторизованным
  Telegram-клиентом. Отдельный свежий Chromium открыл приложение, дождался Offline
  ready и сохранил контрольный screenshot. В личное приложение Telegram доступ
  не предоставлен; повторных попыток обращения к нему не выполнялось.
- Кнопка Open app подтверждена Bot API. Profile Main Mini App ещё не включён.
  Реальный Telegram launch/close/reopen и фактический Render rollback остаются
  отдельной приёмкой; прежняя нестабильность startup WebKit не объявлена исправленной.

### Подтверждение владельца с телефона

11 ноября владелец сообщил: «проверил через телефон — зашло, воркает».
Запуск Mini App в Telegram с телефона принят. Отдельные результаты для сохранения
после close/reopen, offline cold start, backup transfer и обновления/отката этим
сообщением не подтверждались; версии ОС/Telegram не записаны. Установка Android
PWA остаётся вне обязательной приёмки по предыдущему решению владельца.

### Реальное обновление и откат на Render

- Владелец затем подтвердил наличие задачи/черновика после повторного открытия
  Telegram. Этот close/reopen сценарий принят; перенос backup в реальном клиенте
  остаётся отдельной проверкой.
- Новый operator-only scripts/rehearse-release.mjs запущен против публичного HTTPS
  в одном изолированном Chromium context. Подготовлены один проект, одна Done-задача,
  черновик создания задачи и черновик создания проекта; экспортирован baseline backup.
  После каждой смены сборки использованы реальный reload/reopen и кнопка Update,
  без подмены service worker или build metadata.
- A: `7c0f4d23-2710-4d12-9596-85128dbe55f6`, runtime SHA `5e38bd9`.
  Кешированный повтор этого SHA сохранил build ID и не был засчитан как обновление.
  Затем выполнен Clear build cache & deploy для `929b4f0`: его frontend tree
  `0942ff6adaa4712c587281856f9db978ece028b7` идентичен проверенному `5e38bd9`;
  между коммитами изменялись только документы.
- B: `d24a9c24-508a-49ca-90f0-c292075e5b4f`, deploy
  `dep-dbprasifngtc7388bc8g`. В 03:25 МСК подтверждены активный B worker, сохранённые
  task/project IDs, Done и агрегаты, оба черновика, идентичные backup records и
  offline reload. Исключён только ожидаемо новый exportedAt в каждом backup.
- Выполнен настоящий Rollback к артефакту A из `dep-dbpraa8n74is738qk640`.
  Итоговый Live deploy: `dep-dbprc69srm7s738kcfn0`, SHA `5e38bd9`. В 03:26 МСК
  тот же browser context принял Update обратно на A и повторил все проверки:
  backupUnchanged=true, draftsRetained=true, offlineReload=true, exit code 0.
  Публичный Test-Deployment.ps1 с ExpectedBuild A также прошёл.
- Локальный result.json и три screenshot находятся в
  frontend/test-results/render-rehearsal; тестовые контексты и контейнер закрыты.
  Пользовательские browser/Telegram хранилища, backend и database volumes не менялись.
  Lint и syntax check нового скрипта прошли.
- После rollback восстановлен After CI Checks Pass. До репетиции этот режим уже
  был выбран; Update Source → Git Provider при этом показывал Connect Git provider.
  Отсутствие подключённого провайдера объясняет ручные деплои публичного Git URL.
  После подключения GitHub коммит `6651ea7` прошёл CI (`42932290143`), а Render
  показал Live с триггером Auto-Deploy (`dep-dbprl1bncjis73ccgki0`). Публичная
  проверка сборки `1e4e7670-3bda-4419-867d-48d1190105ed` прошла.
- Последовательный прогон 28 сценариев WebKit на публичном стенде завершился
  успешно. `.last-run.json` содержит `passed` и пустой список упавших тестов.
  Причина таймаутов из параллельного прогона остаётся неизвестной.
