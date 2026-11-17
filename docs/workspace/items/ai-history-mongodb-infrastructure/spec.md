# Spec: ai-history-mongodb-infrastructure — Hạ tầng MongoDB dự phòng cho lịch sử lần gọi AI

- Cập nhật 16/11/2026: hạ tầng này nay được `ai-assist` mount trong API, worker và `ops:ai-purge` (phần lưu trữ lịch sử, mục
  _Triển khai_ của ADR-0020). Chữ "dự phòng" bên dưới là trạng thái lúc làm hạng mục; kết quả và sửa lỗi sau đó ở [plan](plan.md).
- Phụ trách: AI (Claude Code) theo yêu cầu trực tiếp ngày 15/11/2026.
- Thiết kế ban đầu bởi: người soạn [đề xuất lịch sử AI dùng MongoDB](../../proposals/ai-history-mongodb/spec.md) (13/11/2026);
  hạng mục này lấy riêng phần hạ tầng §4, §10 của đề xuất.
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `5bb2e6a` (`QĐ-79a`, `QĐ-79c`, `QĐ-102h` — giữ nguyên, xem _Dependencies and blockers_), BE `18a48f3` cộng
  cây làm việc chưa commit của `ai-gateway-wiring`. Quyết định kỹ thuật: [ADR-0020](../../../decisions/0020-mongodb-for-ai-invocation-history.md)
  (Proposed).
- Nhóm roadmap: không thuộc nhóm G nào — yêu cầu trực tiếp (xem `## Sizing decision`).
- [Kế hoạch](plan.md).

## Business outcome

Dev chạy được MongoDB local bằng một lệnh Compose và BE có sẵn adapter `src/infrastructure/mongodb` (cấu hình kiểm chặt,
một `MongoClient` mỗi process, ping, đóng khi shutdown) đã có test, để hạng mục lưu trữ lịch sử AI chỉ cần mount nó; hôm nay
API, worker và lệnh **không** đổi hành vi và không cần MongoDB.

## Sizing decision

- Container: yêu cầu trực tiếp (15/11/2026): "thêm docs và spec, sau đó setup MongoDB", theo đề xuất `ai-history-mongodb`.
- Mode: `technical-enabler`.
- Outcome and owner: hạ tầng kỹ thuật MongoDB dự phòng; sở hữu `src/infrastructure/mongodb`, service Compose `mongodb`,
  biến `MONGODB_*`.
- Boundaries: không bảng PostgreSQL nào, không collection hay schema lịch sử, không route HTTP, không job; không process nào
  mount module; bảo mật: URI là secret, không log, production bắt có thông tin xác thực.
- Not larger: chuyển nội dung lần gọi sang MongoDB (outbox, worker giao, đọc, purge, cutover) cần ADR-0020 Accepted và đi
  qua migration, transaction và job bất đồng bộ — ranh giới phải tách theo quy tắc 4 của work-item sizing.
- Not smaller: cấu hình, vòng đời client và service Compose chỉ kiểm chứng được cùng nhau (client cần cấu hình để dựng, ping
  cần server); tách nữa là tách theo tầng.
- Siblings: `ai-gateway-wiring` (độc lập, cùng thời điểm); phía sau: `ai-history-mongodb-storage` (tên dự kiến, chưa tạo).
- Scope map: `n/a` — technical enabler ngoài nhóm G, không claim Story/AC.

## Primary Story/AC

| Story | AC               | Coverage | Phần còn lại thuộc                                 |
| ----- | ---------------- | -------- | -------------------------------------------------- |
| —     | ENABLER-AI-MONGO | n/a      | gỡ chặn `ai-history-mongodb-storage` (tên dự kiến) |

## Supporting references

- [Đề xuất lịch sử AI dùng MongoDB](../../proposals/ai-history-mongodb/spec.md) §4 (ownership), §10 (cấu hình, bảo mật), §12
  (phân rã).
- [ADR-0020](../../../decisions/0020-mongodb-for-ai-invocation-history.md) (Proposed).
- Mẫu hạ tầng dự phòng: `src/infrastructure/queue` (Owner `OD-R5`, `E2 = A`).
- `ai-assist-queue-summary-be` (nơi đang lưu `ai_invocation_contents` hôm nay).

## Explicit out of scope

- Collection `ai_invocation_histories`, schema Zod của document, repository MongoDB — `ai-history-mongodb-storage`.
- Outbox `ai_history_deliveries`, worker giao, đổi `GET /api/v1/ai/invocations/{id}/content`, đổi `ops:ai-purge`, backfill
  và cutover — `ai-history-mongodb-storage`.
- Mount module vào API/worker/CLI, health readiness có MongoDB (dạng degraded) — `ai-history-mongodb-storage`.
- MongoDB trong `docker-compose.prod.yml`, backup, quyền tách theo process, replica set — task triển khai sau khi ADR-0020
  Accepted.
- Thay đổi dịch vụ AI (Python): giữ stateless, không kết nối MongoDB.

## Dependencies and blockers

| Phụ thuộc                                                  | Trạng thái                                                                            | Ảnh hưởng                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ADR-0020 Accepted + nguồn Docs thay `QĐ-102h` phần lưu trữ | Chưa có (Proposed 15/11/2026)                                                         | **Không** chặn hạng mục này (không lưu dữ liệu nào); **chặn** `ai-history-mongodb-storage` |
| Docker trên máy dev                                        | User `outgame` chưa thuộc nhóm `docker`, chưa có plugin `docker compose` (15/11/2026) | Chỉ chặn kiểm service Compose; ping thật đã làm trên Atlas                                 |

## Ownership: module, data, API

- Thư mục mới `src/infrastructure/mongodb/` (tầng `infrastructure`, chỉ dùng `core` và `infrastructure/config`). Không
  import module nghiệp vụ; không chứa tên collection hay schema lịch sử (đề xuất §4).
- Không bảng, không migration, không route, không OpenAPI đổi.
- `compose.yaml`: service `mongodb` profile `history`; `.env.example`: khối `MONGODB_*`; `package.json`: dependency
  `mongodb`.

## Behavior and design

**Cấu hình** (`mongodb.config.ts`, theo mẫu `queue.config.ts`; chỉ kiểm khi module được mount):

| Biến                                  | Mặc định ngoài production   | Production                       | Ràng buộc                           |
| ------------------------------------- | --------------------------- | -------------------------------- | ----------------------------------- |
| `MONGODB_URI`                         | `mongodb://127.0.0.1:27017` | bắt buộc, có username + password | scheme `mongodb` hoặc `mongodb+srv` |
| `MONGODB_DATABASE`                    | `slm_ai_history`            | như mặc định                     | `^[A-Za-z0-9_-]{1,63}$`             |
| `MONGODB_MAX_POOL_SIZE`               | 5                           | 5                                | số nguyên 1–50                      |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | 2 000                       | 2 000                            | 100–30 000                          |
| `MONGODB_OPERATION_TIMEOUT_MS`        | 3 000                       | 3 000                            | 100–60 000                          |

Thông báo lỗi chỉ nêu tên biến, không bao giờ nêu URI, host, username hay password.

**Vòng đời** (`mongodb-connection.service.ts` + `mongodb-infrastructure.module.ts`):

- Module dựng **một** `MongoClient` mỗi process từ cấu hình đã kiểm (`maxPoolSize`, `serverSelectionTimeoutMS`, `appName`;
  `MONGODB_OPERATION_TIMEOUT_MS` áp vào `connectTimeoutMS`, `socketTimeoutMS`, `waitQueueTimeoutMS` vì driver 7 bỏ
  `timeoutMS`). Không `connect()` lúc khởi động: driver tự kết nối ở thao tác đầu tiên, nên MongoDB tắt không chặn process
  khởi động (đề xuất §10: degraded, không vòng restart).
- `database()` trả `Db` của `MONGODB_DATABASE`; `ping()` chạy `{ ping: 1 }` và ném `MongoUnavailableError` (mã ổn định,
  không chứa message của driver) khi thất bại.
- `onApplicationShutdown` đóng client; đóng hai lần không lỗi.

**Compose**: `mongo:8.0`, chỉ bind `127.0.0.1:${MONGODB_PORT:-27017}`, volume `mongodb-data`, healthcheck `mongosh ping`;
local không bật xác thực (như Redis local), production không dùng file này.

Transaction, concurrency, migration, job, storage: không áp dụng — chưa ghi dữ liệu nào.

## Test matrix

| AC / rủi ro | Tình huống (gồm từ chối, edge case)                    | Cấp test            | Kết quả mong đợi                                                                         | Bằng chứng sau implement                                                                    |
| ----------- | ------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| MI-01       | Dev/test không đặt biến nào                            | unit                | dùng mặc định bảng trên                                                                  | `mongodb.config.spec.ts`                                                                    |
| MI-02       | Production thiếu `MONGODB_URI`                         | unit                | ném `EnvironmentValidationError` nêu `"MONGODB_URI" is required`                         | `mongodb.config.spec.ts`                                                                    |
| MI-03       | Production URI không có username/password              | unit                | từ chối, thông báo không chứa URI                                                        | `mongodb.config.spec.ts`                                                                    |
| MI-04       | URI scheme `http`, database có ký tự lạ, pool 0 hay 51 | unit                | từ chối, nêu tên biến                                                                    | `mongodb.config.spec.ts`                                                                    |
| MI-05       | Thông báo lỗi khi URI chứa mật khẩu giả                | unit                | thông báo không chứa mật khẩu                                                            | `mongodb.config.spec.ts`                                                                    |
| MI-06       | Mount module với cấu hình production sai               | unit                | factory ném, process không khởi động                                                     | `mongodb-infrastructure.module.spec.ts`                                                     |
| MI-07       | Client dựng đúng option từ cấu hình                    | unit                | `maxPoolSize`, các timeout, `appName` đúng; không gọi `connect`                          | `mongodb-infrastructure.module.spec.ts`                                                     |
| MI-08       | `ping()` thành công / server không trả lời             | unit (client giả)   | trả bình thường / `MongoUnavailableError` không chứa message gốc                         | `mongodb-connection.service.spec.ts`                                                        |
| MI-09       | Shutdown gọi hai lần                                   | unit                | `close()` chạy một lần, không ném                                                        | `mongodb-connection.service.spec.ts`                                                        |
| MI-10       | `.env.example` khớp schema                             | unit gate           | biến `MONGODB_*` liệt kê đúng một lần, đánh dấu `@production-required-when-mounted` đúng | `env-example.spec.ts`                                                                       |
| MI-11       | API/worker không mount module                          | arch + unit hiện có | `pnpm arch:check`, `env-schema.spec.ts` xanh; API khởi động không cần MongoDB            | gate                                                                                        |
| MI-12       | Ping, ghi/đọc/xóa thật bằng adapter                    | thủ công            | ping OK; một document ghi, đọc lại, xóa được                                             | 15/11/2026, Atlas (`mongodb+srv`) từ `.env` dev: ping 582–629 ms, ghi/đọc/xóa OK            |
| MI-13       | Sai mật khẩu; host không tồn tại                       | thủ công            | `MongoUnavailableError`, thông báo cố định, không lộ host/mật khẩu; dừng trong hạn       | 15/11/2026: sai mật khẩu → 930 ms; `127.0.0.1:27999` → 2 002 ms (server selection 2 000 ms) |
| MI-14       | Không truyền `timeoutMS` (driver 7 bỏ, không tác dụng) | unit                | option không có `timeoutMS`; chạy thật không còn cảnh báo deprecated                     | `mongodb-infrastructure.module.spec.ts`; lần chạy thật thứ hai                              |

## Definition of Done

- [x] MI-01 → MI-11, MI-14 có test unit xanh (24/24, 15/11/2026); MI-12, MI-13 chạy thật trên Atlas.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm arch:check`, `pnpm rules:check` xanh trên revision cuối.
- [ ] Spec/plan/items index/roadmap phản ánh implementation cuối; ADR-0020 vẫn `Proposed` cho tới khi Owner review.
- [ ] Không tăng legacy ledger kiến trúc.
- [ ] `ARCHITECTURE.md`, `src/README.md`, `docs/guides/containers.md`, `.env.example` mô tả MongoDB là hạ tầng dự phòng.

## Changes and acceptance

- 15/11/2026: tạo hạng mục, tách phần hạ tầng khỏi đề xuất `ai-history-mongodb`. Chưa nghiệm thu.
- 15/11/2026: chạy thật trên Atlas phát hiện driver 7 bỏ `timeoutMS`; đổi sang `connectTimeoutMS`/`socketTimeoutMS`/
  `waitQueueTimeoutMS`, thêm MI-14. Dev dùng Atlas thay Compose (ADR-0020 _Hệ quả_).
