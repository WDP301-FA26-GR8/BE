# WDP-1 — lịch sử AI (MongoDB) vào BE WDP (17/11/2026)

Repo `Code/BE-WDP` (remote `WDP301-FA26-GR8/BE`), worktree `Code/be-wdp-1`, nhánh `feat/wdp-ai-history` (từ `origin/dev` `f2131ec2`).
Danh tính git `Chill`, không dòng đồng tác giả, không `--no-verify`. Chỉ push nhánh này; không đụng `dev`/`main`, Docs, BE đồ án.

## Skill đã dùng

| Skill | Mục đích |
| --- | --- |
| `superpowers:executing-plans` | process: chạy W1→W9 của `WDP-1-PROMPT.md` tuần tự |
| `agent-skills:context-engineering` | chọn phần cần đọc |
| `superpowers:verification-before-completion` | chỉ kết luận theo lệnh đã chạy |

Không dùng subagent code (việc nhỏ, nhiều phụ thuộc; một agent giữ tích hợp).

## Việc → commit → kết quả

| # | Việc | Commit | Lệnh / bằng chứng |
| - | ---- | ------ | ----------------- |
| W1 | `switch -c feat/wdp-ai-history origin/dev` + `merge --no-ff origin/feat/AI-services` | `067f6724` | 3 conflict như dự báo |
| W2 | Giải conflict | `067f6724` | xem mục dưới |
| W3 | Kiểm sau merge | `067f6724` | `pnpm prisma:generate`, `pnpm typecheck` sạch, `pnpm openapi:export` không đổi `openapi.json` |
| W4 | B1 CI có MongoDB | `81aafe08`, `96006b17` | service `mongo:8.0` + `TEST_MONGODB_URI` ở `integration` (3 shard), `integration-inband`, `e2e-smoke`; bước compose prod ở `quality` có `MONGODB_ROOT_*` giả và kiểm thiếu |
| W5 | B2 compose prod | `46981535` | service `mongodb` (chỉ `slm-network`, không publish cổng, volume `mongodb-data`, healthcheck có xác thực, `restart: unless-stopped`); `api`, `worker` `depends_on: mongodb: service_healthy`; `.env.example` |
| W5b | Deploy script an toàn | `1ad22bf6` | xem mục dưới |
| W6 | Backup và triển khai | `fcb65c1a` | `docs/operations/wdp-mongodb-deploy.md`: bước Owner trên VPS, `pg_dump` tay, `mongodump`/`mongorestore` bằng lệnh tay |
| W7 | B3, B5 | `fcb65c1a` | ADR-0020 → *Accepted (WDP, Owner 17/11/2026: Mongo prod trong compose)*; Atlas chỉ dev với dữ liệu giả lập |
| — | Sửa lỗi lộ ra ở CI | `96006b17` | `openapi-presentation.http-spec` đòi một mô tả 503 cho mọi route có guard; route `GET /ai/invocations/{id}/content` dùng `GUARDED_SERVICE_UNAVAILABLE_RESPONSE`, `AI.HISTORY_UNAVAILABLE` vẫn là ví dụ |

### Cách giải conflict

- `src/generated/prisma/internal/class.ts`, `prismaNamespace.ts`: lấy bản `dev`, chạy `pnpm prisma:generate`; so với `origin/dev` chỉ còn phần sinh ra từ schema AI (9 file, +448/−197).
- `test/gates/architecture-boundaries.gate-spec.ts`: giữ toàn bộ model của `dev` (`AvatarPurge`, `Policy*`, `DecisionChecklist`), **bỏ `AiInvocationContent`** (bảng đã xóa), **thêm** `AiInvocationResult`, `AiHistoryDelivery`.

### File cả hai bên cùng đổi từ merge-base `44b2c3f1`

`ARCHITECTURE.md`, `docs/roadmap.md`, `openapi.json`, `module-graph.gate-spec.ts`, `queue-summary.integration-spec.ts` (git tự gộp, đọc lại khối ghép), 8 file `src/generated/prisma/**` (sinh lại), `architecture-boundaries.gate-spec.ts` (tay). Kết luận: `openapi.json` sinh lại bằng `pnpm openapi:export` khớp; không có đánh dấu conflict còn sót.

### Deploy script (`scripts/ops/deploy-release.sh`)

1. Trước mọi lệnh docker: dừng (exit 1, chưa đổi gì) nếu `.env` thiếu `MONGODB_ROOT_USER`/`MONGODB_ROOT_PASSWORD` hoặc `.env.app` thiếu `MONGODB_URI` có user và password. Không in giá trị.
2. Sau khi PostgreSQL sẵn sàng và **trước backup/preflight/migrate**: `up -d --no-recreate --wait --wait-timeout 120 mongodb`, rồi thử xác thực bằng đúng `MONGODB_URI` của API (`run … api node -e`, stderr bỏ). Lỗi → dừng, chưa migrate.
3. Rollback/recovery không bao giờ gọi `mongodb`, `down`, `-v`, `--remove-orphans` (header script + test).
4. Test: thêm 3 test (`scripts/verify/deploy-release.test.mjs`), cập nhật fixture `.env`/`.env.app`; gate `deployment-roles` mở đúng một ngoại lệ cho probe Mongo.

## Kiểm local (máy Windows, đã tải nặng)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck`, `pnpm rules:check`, `pnpm rules:format`, `pnpm arch:check`, `pnpm arch:docs:check` | sạch |
| `pnpm test src/infrastructure/config/env-example.spec.ts src/infrastructure/mongodb` | 33/33 |
| `pnpm test:gates` | 335 test: lần đầu 1 fail (`deployment-roles`, đã sửa), sau đó `deployment-roles` 23/23; **chưa chạy lại cả bộ sau sửa** |
| `node --test … deploy-release.test.mjs` (lọc `ADR-0020`, `keeps the live release`, test thành công chính) | pass; **cả file chưa chạy hết local** (≈27 s/test trên máy này) |
| `pnpm test:integration test/integration/ai-assist --maxWorkers=1` (Postgres 35445, Mongo 37017) | lần 1: 9 fail / 94; chạy lại riêng: `invocation-content-http` 12/12; `ai-purge-cli` lúc 3 fail lúc 1 fail (khác nhau mỗi lần) → nhiễu do máy (CLI chạy bằng ts-node, Mongo từ host) — **CI xanh cả 3 shard** nên không coi là lỗi sản phẩm |
| `pnpm test:http` | local bị `timeout` do tôi đặt; CI chạy đủ (xem dưới) |

## CI GitHub

- Run 1 `43945178585`: `select`, `e2e-smoke`, `integration` 1/2/3, `integration-inband` **xanh**; `http-contract` (1 test, mô tả 503) và `quality` (thiếu biến Mongo trong `prod.env` của bước kiểm compose) **đỏ** — cả hai đã sửa.
- Run 2 `43949254639` trên commit cuối `96006b17` (https://github.com/WDP301-FA26-GR8/BE/actions/runs/43949254639): **mọi job xanh** — `select`, `quality`, `http-contract`, `integration` 1/2/3, `integration-inband`, `e2e-smoke` đều `success`; `Deploy to VPS` `skipped` (đúng: chỉ chạy trên `main`).
- Nhánh `origin/feat/wdp-ai-history` = `96006b17`, không squash, không đổi lịch sử.

## D-n (tự chốt, chế độ đêm)

- **D-1.** Ứng dụng kết nối bằng **root user** của service (`authSource=admin`), đúng chữ prompt W5. User Mongo tách quyền theo process: chưa làm (ghi trong ADR, mục còn lại). Khuyến nghị: làm sau hội đồng.
- **D-2.** Root user/password nằm ở `.env` (Compose), `MONGODB_URI` ở `.env.app` (cùng giá trị): trùng lặp một mật khẩu nhưng giữ quy tắc H7 "`.env.app` không chứa biến `POSTGRES_*/DATABASE_*`" (Mongo không bị ràng buộc đó).
- **D-3.** Healthcheck Mongo **có xác thực** (không chỉ `ping`): tránh báo healthy khi server tạm của lần khởi tạo đầu chưa có user.
- **D-4.** Script chỉ kiểm `MONGODB_URI` có `user:password@`, **không ép host = `mongodb`** (không chặn nhầm cấu hình hợp lệ khác); probe xác thực thật là chốt chặn.
- **D-5.** Chỉ thêm Mongo vào job có suite AI (`integration`, `integration-inband`, `e2e-smoke`); `quality` và `http-contract` không cần (CI chứng minh: `quality`/`http-contract` không gọi `provisionHistoryStore`).
- **D-6.** `AiInvocationContent` bị bỏ khỏi map model của gate kiến trúc (bảng đã bị migration xóa).
- **D-7.** Worktree `be-wdp-1` do chat điều phối 123 gỡ nên tôi tạo lại từ `origin/dev`; làm từ đầu theo prompt.
- **D-8.** Không thêm `mongodump` vào service `backup` (image `postgres`); chỉ ghi lệnh tay trong runbook.
- **D-9.** Mô tả 503 của route nội dung dùng chữ chung của route có guard thay vì chữ riêng nhắc `AI.HISTORY_UNAVAILABLE` (test OpenAPI buộc một chữ); mã đó vẫn có trong ví dụ của 503.

## Chưa làm

- Chạy đủ local: cả `deploy-release.test.mjs`, `pnpm test:gates` sau sửa, `pnpm test:http`, `pnpm check` (để CI chạy).
- Sao lưu Mongo tự động; user Mongo tách quyền; xoay mật khẩu.
- Review độc lập phần migration/raw SQL của nhánh AI (review WDP.md yêu cầu trước khi merge) — chưa có người đọc.
- Việc của Owner **trước khi merge `main`**: thêm biến Mongo vào `.env` và `.env.app` trên VPS, kiểm đĩa, `pg_dump` tay (xem `docs/operations/wdp-mongodb-deploy.md`). Push `main` tự deploy.

## FIX sau audit (17/11, theo `p5/WDP-1-FIX-PROMPT.md`, mỗi FIX một commit)

| FIX | Commit | Nội dung | Kiểm |
| --- | ------ | -------- | ---- |
| R-1 | `58f9c50f` | Representation `ai-history-outbox` trong `DATA_REPRESENTATIONS`, đếm theo `to_regclass('public.ai_history_deliveries')` (không theo số dòng), thêm vào label `data-reads` của Dockerfile. Recovery sau `migrate deploy` ⟹ `REFUSED` với image cũ; trước migrate image cũ vẫn là đường lui. | `recovery-target.policy.spec.ts` (label khớp Dockerfile, ca INCOMPATIBLE/COMPATIBLE), 2 test mới ở `deploy-release.test.mjs` (REFUSED; image khai báo label thì dựng lại được), `recovery-target-facts.integration-spec.ts`. Local: 123/123 unit installation, 12/12 test "way back". |
| R-2 | `b1c1ab4b` | `ai-history-backfill.integration-spec.ts`: dựng DB tới migration trước, chèn 3 lần gọi kiểu cũ, chạy migration; kiểm 1 result, 2 snapshot v1 qua `historySnapshotSchema` (strict) với `validation` null khi chưa kiểm, lần gọi 3 `PURGED` có `history_purged_at`, bảng cũ mất, drift 0. | 1/1 pass local; **mutation** `'promptText'`→`'prompt_text'` trong migration làm test đỏ (đã hoàn nguyên). |
| R-3 | `bbaae81b` | `invocation-history-outbox.integration-spec.ts` (PostgreSQL thật, không mock repo): hai claim đồng thời rời nhau (SKIP LOCKED), lease hết hạn thì claim lại và ACK token cũ `false`, retry (`available_at`, xóa lease), park (chỉ version mới nhất ⟹ `ERROR`, giữ payload), purge đóng snapshot đang lease ⟹ ACK/park muộn `false`, ACK gen cũ không đổi call. | 8/8 pass local; **3 mutation** (bỏ `SKIP LOCKED`; bỏ `leaseToken` trong `close()`; bỏ `history_generation =` trong `acknowledge`) đều làm test đỏ (đã hoàn nguyên). |
| O-5 | `15258510` | Mongo 121 (validator), 10334 (quá lớn) và `BSONError` ⟹ `HistoryWriteRefusedError('PAYLOAD_INVALID')` ⟹ park, không retry vô hạn. | 3 ca refuse + 1 ca vẫn là MongoDB down (unit, 45/45 `invocation-history` + `history-delivery`). |
| O-7 | `15258510` | `acknowledge` và `park` lấy `SELECT … FROM ai_invocations FOR UPDATE` trước khi đóng dòng delivery: cùng thứ tự khóa với purge. | 8/8 outbox spec còn pass; **không có test tái hiện 40P01** (không tất định) — ghi rõ. |

Runbook `docs/operations/wdp-mongodb-deploy.md` đã đổi mục rollback: sau migrate recovery `REFUSED`, cách ra là release mới với `--attempt` mới.

D-10. Test của R-2 dùng 3 lần gọi như prompt (không thêm ca RUNNING/NO_VALID_OUTPUT của audit): các ca đó đi cùng nhánh SQL `JOIN ai_invocation_contents` nên không thêm đường mới. D-11. O-5 chỉ phân loại 121, 10334 và `BSONError`; mã 2 (BadValue) không đưa vào vì quá rộng.

Commit `1e760cbc` (sau `15258510`): gate `module-layout` cấm so khớp lỗi theo `name`, nên O-5 nhận `BSONError` bằng `error instanceof BSON.BSONError` (`mongodb` export `BSON`); spec đổi theo. Lần chạy `43961720643` trên `15258510` đỏ đúng ở gate này (job `quality`), các job khác xanh.

CI run `43965990602` trên commit cuối `1e760cbc` (https://github.com/WDP301-FA26-GR8/BE/actions/runs/43965990602): **mọi job xanh** — `select`, `quality`, `http-contract`, `integration` 1/2/3, `integration-inband`, `e2e-smoke` `success`; `Deploy to VPS` `skipped` (chỉ chạy trên `main`). `origin/feat/wdp-ai-history` = `1e760cbc`, không squash.
