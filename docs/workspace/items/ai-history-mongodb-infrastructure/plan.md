# Plan: ai-history-mongodb-infrastructure — Hạ tầng MongoDB dự phòng cho lịch sử lần gọi AI

- [Spec](spec.md); revision đầu vào: Docs `5bb2e6a`, BE `18a48f3` (cộng cây chưa commit của `ai-gateway-wiring`).
- Phụ trách: AI (Claude Code). Thiết kế ban đầu bởi: người soạn đề xuất `ai-history-mongodb`; tách hạng mục: AI.
- Owner review: chưa review. Peer review: không bắt buộc.
- Triển khai: `in-progress`. PR: chưa có.

## Before coding

Đã đọc `AGENTS.md`, `docs/rules/work-item-sizing.md`, mẫu spec/plan, `src/infrastructure/queue` (mẫu module dự phòng),
`src/infrastructure/config/env-example.spec.ts` (gate `.env.example`), đề xuất `ai-history-mongodb` §4, §10, §12.
Driver: `mongodb` 7.x (`engines.node >= 20.19`, Node dev 24.13). Docker local chưa dùng được (quyền socket).

## Tasks

### Task 1: ADR và hồ sơ hạng mục

- Files: `docs/decisions/0020-mongodb-for-ai-invocation-history.md`, `docs/workspace/items/ai-history-mongodb-infrastructure/{spec,plan}.md`,
  `docs/workspace/items/README.md`, `docs/roadmap.md`.
- Depends on: none.
- Acceptance: ADR `Proposed`; hạng mục đăng ký ở items index và bảng _Hạng mục_ của roadmap.
- Verify: `pnpm rules:check` → 0 errors; `pnpm rules:format`.

### Task 2: Dependency, Compose, `.env.example`

- Files: `package.json`, `pnpm-lock.yaml`, `compose.yaml`, `.env.example`, `src/infrastructure/config/env-example.spec.ts`.
- Depends on: Task 1.
- Acceptance: `mongodb` pin trong dependencies; service `mongodb` profile `history`; `MONGODB_*` liệt kê và đánh dấu đúng (MI-10).
- Verify: `pnpm test -- src/infrastructure/config` → xanh; `docker compose config --profiles` có `history`.

### Task 3: Adapter `src/infrastructure/mongodb`

- Files: `src/infrastructure/mongodb/{mongodb.config,mongodb.errors,mongodb-connection.service,mongodb-infrastructure.module}.ts` và spec.
- Depends on: Task 2.
- Acceptance: MI-01 → MI-09.
- Verify: `pnpm test -- src/infrastructure/mongodb` (đỏ trước/xanh sau); `pnpm typecheck`; `pnpm lint`; `pnpm arch:check`.

### Task 4: Tài liệu dự phòng

- Files: `ARCHITECTURE.md`, `src/README.md`, `docs/guides/containers.md`.
- Depends on: Task 3.
- Acceptance: ba tài liệu ghi MongoDB là hạ tầng dự phòng chưa mount, cách bật profile `history`.
- Verify: `pnpm rules:check`; `pnpm rules:format`.

### Checkpoint

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm arch:check`, `pnpm rules:check` xanh; tự review diff theo spec.

### Task 5: Kiểm thật với MongoDB (MI-12)

- Files: none (chỉ chạy).
- Depends on: Checkpoint; Docker dùng được trên máy dev.
- Acceptance: container healthy; ping qua adapter trả ok; dừng container thì ping ném `MongoUnavailableError` trong ~2 s.
- Verify: `docker compose --profile history up -d --wait`; script ping ghi ở mục _Verification and handoff_.
- Trạng thái: ping thật đã làm trên **Atlas** (MI-12, MI-13); service Compose chưa kiểm vì Docker chưa dùng được.

## Verification and handoff

| Lệnh / kiểm tra AC                                                              | Revision / môi trường                      | Kết quả thực chạy                              | Giới hạn / việc còn lại                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm test -- src/infrastructure/mongodb` (MI-01→MI-09, MI-14)                  | BE `18a48f3` + cây chưa commit, 15/11/2026 | 3 suite, 24/24 xanh                            | —                                                                          |
| `pnpm test -- src/infrastructure` (MI-10, gate `.env.example`)                  | như trên                                   | 58 suite, 723/723 xanh (trước khi đổi timeout) | —                                                                          |
| `tsc --noEmit`; eslint thư mục mới và `env-example.spec.ts`; `pnpm rules:check` | như trên                                   | xanh; rules 0 errors                           | eslint toàn repo cần `NODE_OPTIONS=--max-old-space-size=6144` trên máy dev |
| Ping + ghi/đọc/xóa thật qua `createMongoConnection` (MI-12)                     | Atlas, `.env` dev                          | OK, ping 582–629 ms                            | script một lần, không commit                                               |
| Sai mật khẩu / host không tồn tại (MI-13)                                       | Atlas / `127.0.0.1:27999`                  | `MongoUnavailableError` sau 930 ms / 2 002 ms  | —                                                                          |
| `pnpm check`, `test:http`, `test:integration`, `arch:check`, `test:gates`       | —                                          | **chưa chạy**                                  | theo quy ước dev: chạy đầy đủ trước khi đẩy GitHub                         |

### Sửa sau review phần lưu lịch sử (16/11/2026)

Phần lưu lịch sử (outbox, worker giao, purge; ghi ở mục _Triển khai_ của ADR-0020) chưa có hạng mục riêng. Hai lượt
`/code-review` trên cây chưa commit; đã sửa trong `ai-assist` và `cli/ai-purge`, mỗi sửa có unit test:

- `drainPurges` chỉ lấy tombstone đến hạn trước lúc bắt đầu và dừng sau một vòng MongoDB không nhận gì (trước: có thể không dừng).
- Một wave chỉ bắt đầu khi lease còn ít nhất 15 s; ack, close, park mất lease thì đếm `leaseLost`, không đếm là đã giao.
- Lỗi PostgreSQL sau lần ghi MongoDB không còn bị coi là lỗi ghi MongoDB và retry dưới mã khác.
- `park` chỉ đặt `ERROR` khi bản bị từ chối là version mới nhất.
- Đường đọc của API không tạo collection; chỉ đường ghi tạo collection và validator.
- Purge truyền id bằng `= ANY($1::uuid[])` (một tham số); dry-run và `--apply` dùng một predicate SQL.
- `ops:ai-purge` tách `parked` khỏi `pending`; dry-run còn tombstone chờ thì exit 0 và nói `--apply` sẽ giao.
- Không sửa: ngân sách 15 s cố định (đủ với timeout mặc định 3 s; vượt thì chỉ giao lặp, vốn idempotent), một lỗi PostgreSQL
  làm cả vòng thất bại, `pending` đếm cả tombstone worker đang giữ, hằng số trạng thái lặp ở hai repo.

Kiểm chứng: jest `src/modules/ai-assist src/cli src/worker src/infrastructure/mongodb src/infrastructure/config` 59 suite,
862/862 xanh; `tsc --noEmit`, eslint thư mục chạm, `arch:check` xanh; `ops:ai-purge` chạy thật trên PostgreSQL local + Atlas
(dry-run 9 → apply 9 confirmed, `COMPLETED` → `STALE`, exit 0/0/2 như hợp đồng); S1–S9 PASS trên bản build cuối.
Chạy thật `test:integration` và `test:http` của `ai-assist` (16/11/2026, PostgreSQL và MongoDB test trên máy dev): lần đầu
28/94, sau bốn sửa tận gốc 94/94 hai lượt liền; HTTP 56/56. Bốn lỗi:

- Driver 7 nạp `os` bằng `import()` động; Jest (`vm`) từ chối, driver gửi metadata rỗng, server từ chối bắt tay. Sửa: mọi
  `MongoClient` nhận `runtimeAdapters: { os }` (`MONGO_RUNTIME_ADAPTERS`, có unit test).
- Test lệnh purge chạy `NODE_ENV=test` chỉ với `DATABASE_URL`, `resolveDatabaseUrl` gắn `_test` lần hai. Sửa: `TEST_DATABASE_URL`
  (hai chỗ cùng mẫu).
- Migration `20261116100000_ai_history_mongodb` đặt tên index 68 ký tự, PostgreSQL cắt còn 63 và lệch tên Prisma sinh. Sửa: tên
  Prisma (`…_oper_key`); migration chưa commit nên sửa tại chỗ, DB dev local đổi tên index và checksum, `migrate status` khớp.
- v1 và v2 của một lần gọi giao cùng đợt đụng nhau ở `insert`, bản sau bị hẹn 1 s, Super Admin đọc lúc đó nhận 409. Sửa: store
  ghi lại ngay, tối đa 3 lần (unit test tái hiện).

Còn mở: một lần lệnh purge trong test thoát 1 khi 7 file chạy song song, hai lượt sau không tái hiện, không có output để tìm gốc.
`pnpm check` đầy đủ chưa chạy (theo quy ước, trước khi đẩy GitHub).

- [ ] AC trong scope có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan phản ánh đúng implementation cuối.
- [ ] Diff cuối đã tự review; tài liệu vận hành cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể (kèm ADR-0020). Chỉ ghi `merged-dev`, `accepted` sau đúng sự kiện thật.
