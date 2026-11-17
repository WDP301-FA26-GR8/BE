# WDP-2 — đưa prompt 5 (feat/p5 d3757876) sang BE WDP (17/11/2026)

Repo `Code/BE-WDP` (remote `WDP301-FA26-GR8/BE`), worktree `Code/be-wdp-2`, nhánh `feat/wdp-p5` từ `feat/wdp-ai-history` @ `1e760cbc`.
Commit đứng tên `Chill`, không dòng đồng tác giả, không `--no-verify`. Chỉ push nhánh này; không đụng `dev`/`main`, Docs, BE đồ án.

## Skill đã dùng

| Skill | Mục đích |
| --- | --- |
| `superpowers:executing-plans` | process: chạy theo `WDP-2-PROMPT.md` và các vòng sửa theo audit |
| `superpowers:verification-before-completion` | chỉ kết luận theo lệnh đã chạy |
| `agent-skills:context-engineering` | chọn phần cần đọc (spec 5C §A2, AUDIT-C, AUDIT-WDP-2) |

Không dùng subagent code: phần ghép phụ thuộc nhau và chạm cùng file; một agent giữ tích hợp.

## Cách ghép (không copy đè thư mục)

`git diff 94a8ee84..d3757876 --binary` (SEP) → `git apply --3way` trên WDP. Lần đầu bị từ chối cả gói vì 2 file: `invocation-content.repo.ts`
(WDP đã xóa) và `optimization/README.md` (blob lệch). Áp lại với `--exclude` hai file đó: 18 file xung đột. README tối ưu chèn tay
3 dòng phạm vi IT.

| File xung đột | Cách giải |
| --- | --- |
| `queue-summary.service.ts`, `queue-summary-run.service.ts`, `invocation-content-query.service.spec.ts`, `queue-summary-run.service.spec.ts` | lấy bản SEP (port `AiInvocationHistoryStore`, `AiServiceClients`, `canAnswerIn`); xóa `snapshotOf` và `available()` cũ của WDP |
| `invocation.repo.ts` | giữ WDP: `finish` vẫn ghi `ai_invocation_results`, `findOwned` đọc `ai_invocation_results` và `history_state`; thêm `providerModeOf`; `stuckOf` trả `{id, providerMode}` (từ SEP) |
| `invocation.types.ts` | import WDP (`invocation-result.json`) + `AiProviderMode`/`QueueContext`; lấy `InvocationContentRecord` của SEP (có `providerMode`) |
| `ai-assist.module.ts`, `purge/ai-assist-purge-cli.module.ts` | giữ outbox/store/worker của WDP; thêm `MongoInvocationHistoryRepo` và `{ provide: AiInvocationHistoryStore, useExisting: MongoInvocationHistoryRepo }` |
| `public/ai-purge.api.ts` (+ spec) | port cho `countPurgeable`/`purge`; vẫn giữ outbox + `drainPurges` + đếm `confirmed/pending/parked` của WDP; spec WDP dựng port bằng chính adapter trên các fake |
| `test/support/ai-assist-fakes.ts`, `ai-summary-harness.ts` | fake SEP (một `FakeInvocationRepo` làm cả port) + `providerModeOf`; harness giữ kho Mongo dùng-một-lần của WDP và `setMode('MODEL')` của SEP; bỏ `FakeHistoryRecord` |
| `test/integration/ai-assist/*` (4 file) | lấy bản WDP-1 làm nền, thêm `provider_mode`/`providerMode` của SEP; scenario stub (SEP R-1) kiểm bằng `resultRow`/`historyDocument` thay `contentRow` |
| `src/modules/ai-assist/README.md`, `docs/workspace/items/README.md` | gộp cả hai; viết lại phần port theo dữ liệu WDP (xem R-3) |
| `src/generated/prisma/**`, `openapi.json`, `docs/generated/*` | sinh lại bằng `pnpm prisma:generate`, `pnpm openapi:export`, `pnpm arch:graph`, `pnpm arch:routes` |

## Adapter

`src/modules/ai-assist/invocation-history/invocation-history-mongo.repo.ts`, class `MongoInvocationHistoryRepo implements AiInvocationHistoryStore`:

| Method | Làm gì |
| --- | --- |
| `recordAdmitted` | xếp snapshot v1 (context) vào outbox `ai_history_deliveries` qua `InvocationHistoryOutboxRepo.enqueueSnapshot` trong `tx` |
| `recordAnswered` | xếp snapshot đầy đủ (prompt, raw, parsed, `validation.rejections`); kết quả đã kiểm vẫn do `AiInvocationRepo.finish` ghi |
| `prepareRead(id)` | pha 1, **không transaction**: PostgreSQL quyết định (purged → null, chưa giao → 409, lỗi → 503), rồi đọc MongoDB |
| `confirmRead(tx, prepared)` | pha 2, trong transaction ngắn: `FOR SHARE`, kiểm lại generation/version, đọc `providerMode` và `result` |
| `find(tx, id)` | giao diện của port: ghép hai pha trong `tx` của người gọi; query service của WDP **không** dùng |
| `countPurgeable` / `purge(tx, before)` | `outbox.countPurgeable`; `lockPurgeable` + `dropResults` + `beginPurge` |

Wiring: `ai-assist.module.ts` và `purge/ai-assist-purge-cli.module.ts`. Không có biến chọn adapter (WDP luôn bind adapter Mongo; bản PostgreSQL của SEP
không còn bảng).

## Lệnh → kết quả

| Lệnh | Kết quả |
| --- | --- |
| `git apply --3way` (exclude 2 file) | 18 file xung đột, giải hết; không còn đánh dấu |
| `pnpm prisma:generate`, `pnpm typecheck`, `eslint` (ai-assist, test/support, integration/ai-assist) | sạch |
| `prisma migrate deploy` trên DB trống (tới `20261117120000_ai_provider_mode`) + `prisma migrate diff --from-config-datasource --to-schema prisma --exit-code` | áp hết; drift **0** |
| `pnpm test src/modules/ai-assist src/modules/operating-parameters` | 365/365; sau audit `ai-assist` 331/331 |
| `pnpm test:gates` | 337/337 (17 suite) |
| `pnpm arch:check`, `pnpm arch:docs:check`, `pnpm rules:check`, `pnpm rules:format` | sạch (568 file, 0 lỗi link) |
| integration `ai-assist` + `operating-parameters` (Postgres 35445, Mongo 37017) | 155/157 lần đầu (2 đỏ: `stuckOf` đã sửa; 1 ca 409 chập chờn). Chạy lại riêng: qua |
| integration `licensing/subscription-renewal*` + `notifications` | 18 suite, 186/186 |
| `pnpm test:flows` | 11 suite qua, 70 test qua, 1 suite skip có sẵn; chạy 2 lần (trước và sau sửa audit) |
| seed trên DB trống: `migrate deploy` → `pnpm seed:local -- --continue` | **exit 0**, 64 bước `ĐÃ GHI` + 1 `ĐÃ CÓ`, 0 `LỖI`; chạy 2 lần (trước và sau sửa audit) |
| số tham số `PARAMETER_DEFINITIONS` | **30** (spec "pins the thirty keys", `parameters.size`, `api-collection-registry-exceptions.ts` `maxItems: 30`); số operation OpenAPI **426** |

Lưu ý seed local: lần đầu dừng ở bước `budget.year` (`TypeError`) vì BM-10 cần upload object storage; dựng MinIO từ `infra/minio`
(chạy `--user 0`) và đặt `OBJECT_STORAGE_*` giả vào `.env.seed.local` (không commit) thì qua. Đó là môi trường local, không phải lỗi mã.

## CI GitHub

| Run | Commit | Kết quả |
| --- | --- | --- |
| `44060986632` | `3f0b8bce` | đỏ có chủ đích (`stuckOf` trả `{id, providerMode}`, spec chưa sửa) — bỏ qua |
| `44061390863` | `b8d2d9bf` | **xanh** mọi job |
| `44066549022` | `20cf2015` (sau audit) | **đỏ** `integration (2)` (cả lần thử lại): `invocation-content-http` ca "when the event cannot be written" nhận 409 — nguyên nhân ở helper test, xem dưới |
| `44070333458` | `44fc9395` (commit cuối) | **xanh mọi job**: `select`, `quality`, `http-contract`, `integration` 1/2/3, `integration-inband`, `e2e-smoke` `success`; `Deploy to VPS` `skipped` (chỉ chạy trên `main`). https://github.com/WDP301-FA26-GR8/BE/actions/runs/44070333458 |

## Sửa theo `AUDIT-WDP-2-review.md` (mỗi mục một commit)

| Mục | Commit | Việc | Bằng chứng |
| --- | --- | --- | --- |
| R-1 | `45d9a531` | đọc MongoDB ngoài transaction (3 pha), port SEP không đổi | spec query service ghim `prepare → tx-open → confirm → audit`; spec adapter ghim `standingOf` pha 1 không nhận `tx`; mutation (đưa `prepareRead` vào `runner.run`) làm 3 test đỏ |
| R-2 | `0c5fecc3` | port 2 ca integration SEP (một lần gọi mỗi revision theo mode; `stuckOf` mọi mode) sang dữ liệu WDP | 8/8 pass; mutation `stuckOf` theo mode (`whose(owner)`) làm ca thứ hai đỏ |
| R-3, N-1 | `079bfb36` | README module + JSDoc port viết theo kho WDP; `contents` → `history` ở `AiPurgeApi` | `rules:check`, `rules:format` sạch |
| O-1 | `20cf2015` | 2 lỗi "đang chờ"/"không khả dụng" dời sang `invocation-history.errors.ts` | `arch:check`, gates 337/337, README R6 đúng chiều |

## D-n (tự chốt, Owner duyệt sáng)

- **D-1.** Port SEP giữ nguyên chữ ký `find(tx, id)`; query service của WDP gọi `prepareRead`/`confirmRead` của adapter (không qua port) để MongoDB không bị đọc
  trong transaction (`transaction-runner.ts:117`). Phương án thay: kiểm chéo timeout Mongo < timeout transaction (audit A) — không chọn theo chỉ đạo điều phối.
  Hệ quả: `invocation-content-query.service.ts` của WDP lệch bản SEP ở đúng chỗ đó khi sau này đồng bộ hai repo.
- **D-2.** `AiInvocationRepo.finish` vẫn ghi `ai_invocation_results` (không chuyển vào `recordAnswered`) nên `findOwned` đọc từ đó, giữ nguyên hành vi WDP-1.
- **D-3.** Adapter đặt hậu tố `.repo.ts` (bộ hậu tố của gate không có `.store`); không có biến chọn adapter.
- **D-4.** Số tham số 30 lấy nguyên từ patch (`operating-parameters` của WDP `dev` và SEP `94a8ee84` giống hệt; patch không đổi thêm).
- **D-5.** `InvocationContentView` giữ kiểu của SEP (`Omit<InvocationContentRecord, 'organizationId'>`) nên response có thêm `providerMode`.

## Breaking FE riêng của WDP

Không có breaking riêng của WDP so với SEP. Chung với P5: `GET` tóm tắt có thêm `simulated` (bắt buộc), nội dung Super Admin có thêm `providerMode`; màn tham số hiện
`AI_PROVIDER_MODE`. Máy dev đã áp migration cũ phải `prisma migrate reset` DB local.

## Env mới cho VPS (so với WDP-1)

- **Không có biến môi trường mới.** `AI_PROVIDER_MODE` là **tham số vận hành** do Super Admin đổi qua `PUT /operating-parameters/AI_PROVIDER_MODE` (có Audit Trail), chỉ có hiệu lực khi
  `AI_ENABLED` và `AI_ACCESS_REQUEST_SUMMARY_ENABLED` đều `ON`.
- **Mặc định là `SIMULATED`**: sau khi merge lên VPS WDP, FE hiện nhãn _Giả lập — không phải AI_ cho tới khi Super Admin đổi sang `MODEL`. Muốn `MODEL`: đặt `AI_SERVICE_BASE_URL`/`AI_SERVICE_TOKEN` trong `.env.app`,
  `/healthz` của dịch vụ AI có `modelId` khác `stub` (BE từ chối câu stub, QĐ-102f).
- Việc đã ghi cho WDP-1 vẫn đúng: `MONGODB_ROOT_*` ở `.env`, `MONGODB_URI` ở `.env.app`, kiểm đĩa, `pg_dump` tay — `docs/operations/wdp-mongodb-deploy.md` (đã thêm mục "Chế độ AI").
- Hai migration mới của P5 áp thêm trên VPS: `20261117100000…`, `20261117110*`, `20261117120000_ai_provider_mode`.

## Nợ test / Nghi lỗi logic

- **Nợ test:** không còn. Ca `invocation-content-http` đỏ ở CI (run `44066549022`) và chập chờn ở local có **nguyên nhân gốc là helper test**, đã sửa ở `44fc9395`:
  helper `insertCall` chèn dòng outbox với `available_at = now()` (đồng hồ PostgreSQL, làm tròn lên mili-giây), còn `deliverHistory` lấy các dòng đến hạn theo `new Date()` của tiến trình
  test (cắt xuống mili-giây). Claim đến cùng mili-giây hoặc sớm hơn thì không lấy được dòng nào, lịch sử còn `PENDING` (log: `attempts: 0`, không có ACK) và `GET` trả 409 `AI.HISTORY_PENDING`.
  Chứng minh: đặt đến hạn sau 30 ms ⇒ 4/12 test đỏ; đặt đến hạn trước 1 giây ⇒ 12/12 qua, 5 lần liên tiếp (trước đó 0/3 lần sạch). Không thêm retry, không nới assertion.
  Sản phẩm không dính: code thật xếp outbox bằng `new Date()` của service, cùng đồng hồ với worker. Chưa giải thích được vì sao CI đỏ cố định ở đúng ca thứ 10 (tôi chỉ chứng minh được cơ chế race ở helper).
  Còn thiếu từ WDP-1: không có ca HTTP integration cho 503 `AI.HISTORY_UNAVAILABLE` (chỉ unit adapter).
- **Nghi lỗi logic:** không.

## Chưa làm

- `pnpm check` và `pnpm test:http` đầy đủ chạy ở local (để CI chạy).
- Review độc lập phần ghép (audit WDP-2 đã đọc `b8d2d9bf`; các sửa R-1..O-1 chưa có lượt review riêng).
- Không dùng subagent code (xem trên).
