# Plan: ai-gateway-wiring — Dựng và kiểm chứng cổng kết nối BE ↔ AI-service

- [Spec](spec.md); revision đầu vào: BE `18a48f3`, AI-service `cdaf420`.
- Phụ trách: Agent implement. Thiết kế ban đầu bởi: Agent.
- Owner review: chưa review. Peer review: `/code-review` đã chạy nhiều lượt (15–16/11/2026; phát hiện và xử lý ghi trong
  `AI-services/gateway-run-log.md` §4, §7, §10, §11).
- Triển khai: `in-progress`. PR: chưa có.

## Before coding

Đã đọc `CONTRIBUTING.md`, `GATEWAY_PLAN.md`, `BE/src/modules/ai-assist/README.md`.
Xác nhận hiện trạng F1–F12: BE có sẵn `HttpAiServiceClient` và 4 route HTTP; AI-service có FastAPI front và stub runner. Thiếu URL cấu hình và token lệch.

## Tasks

### Task 1: Baseline và harness smoke (U0, U1)

- Files: `scripts/ai-gateway-smoke.sh`, `src/modules/ai-assist/README.md`.
- Depends on: none.
- Acceptance: Harness `scripts/ai-gateway-smoke.sh --direct` chạy thoát mã 0, khẳng định `healthz`, `promptVersion`, 401 khi thiếu auth, và kết quả tóm tắt Contract v1.
- Verify: `AI_URL=http://127.0.0.1:8000 AI_SERVICE_TOKEN=<token> bash scripts/ai-gateway-smoke.sh --direct` → exit 0.

### Task 2: Đồng bộ cấu hình token và URL (U2, U3)

- Files: `BE/.env`, `AI-service/.env`.
- Depends on: Task 1.
- Acceptance: Sinh token an toàn không in giá trị ra shell; hash 8 ký tự đầu khớp nhau trên cả hai repo; `BE/.env` có `AI_SERVICE_BASE_URL=http://127.0.0.1:8000`.
- Verify: Lệnh so hash in cùng chuỗi `1e053204`.

### Task 3: Tài liệu vận hành và rà soát code review (U5, U7)

- Files: `AI-service/README.md`, `BE/src/modules/ai-assist/README.md`, `AI-services/gateway-run-log.md`.
- Depends on: Task 2.
- Acceptance: Chạy `/code-review` xử lý triệt để các cảnh báo bảo mật (bỏ mật khẩu mặc định, thêm trap cleanup, bổ sung assertions); cập nhật README hai bên.
- Verify: `pnpm typecheck` (0 error) && `pnpm jest --runInBand -- src/modules/ai-assist` (212 passed).

### Checkpoint

- Cổng direct smoke hoạt động 100%.
- Đầy đủ audit log tại `AI-services/gateway-run-log.md`.
- ~~Đợi môi trường Docker trên máy host để chạy full E2E luồng BE (S1-S9).~~ Đã chạy 16/11/2026 (bên dưới).

### Task 4: Đầu-cuối, ca lỗi, Modal (U3–U6) — 16/11/2026

- Files: `scripts/ai-gateway-smoke.sh` (S9 chờ 409 `AI.HISTORY_PENDING`, healthz `-m 30`); AI-service `modal_app.py`,
  `src/ai_service/front.py`, prompt `aqs-prompt-v4`, `eval/`.
- Depends on: Task 2; PostgreSQL Docker local; Modal CLI đăng nhập (`hiamoutgame`).
- Acceptance: S1–S9 PASS với stub local, với front Modal và với model thật trên GPU; E1–E6 đúng mã lỗi; không container GPU khi
  chạy stub; log không chứa token hay nội dung.
- Verify: các dòng 16/11/2026 ở mục _Verification and handoff_.

## Verification and handoff

- `cd AI-service && UV_CACHE_DIR=/tmp/uv-cache uv run pytest -q --basetemp=/tmp/pytest_temp` (168 passed)
- `cd BE && pnpm typecheck` (0 error)
- `cd BE && pnpm jest --runInBand -- src/modules/ai-assist` (212 passed)
- `cd BE && bash scripts/ai-gateway-smoke.sh --direct` (PASS)

16/11/2026 (chi tiết, ID lần gọi và bằng chứng: `AI-services/gateway-run-log.md` §5–§11):

| Kiểm                                                                                           | Môi trường                                                         | Kết quả                                                  | Giới hạn / còn lại                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| S1–S9                                                                                          | PostgreSQL Docker local, seed `shared-demo-v4`, stub local, worker | PASS                                                     | S9 cần worker chạy (outbox)                          |
| E1–E6 (token sai, AI tắt, sai địa chỉ, hết giờ phía BE, 504 của AI, thiếu token, công tắc tắt) | như trên                                                           | đúng mã lỗi, hàng chờ duyệt vẫn 200, token không vào log | hết giờ phía AI-service chỉ kiểm được với model thật |
| U4: front Modal ở stub                                                                         | Modal `hiamoutgame`                                                | S1–S9 PASS, không container GPU                          | front lạnh 5–10 s                                    |
| U6: model thật (Qwen3.5-4B Q4_K_M)                                                             | Modal GPU (L4, dự phòng A10G/L40S)                                 | S1–S9 PASS với `aqs-prompt-v4`                           | Modal từng hết L4 > 20 phút: thêm GPU dự phòng       |
| Eval 60 ca `queue_v1`                                                                          | Modal GPU                                                          | v4 đạt mọi ngưỡng SPEC §18.2                             | chưa đo GPU lạnh p95 đủ 3 lượt; chưa chạy 9B         |
| 12 kịch bản cuối (`queue_scenarios_v1`)                                                        | Modal GPU                                                          | 12/12                                                    | —                                                    |
| `pnpm test:integration -- test/integration/ai-assist`                                          | PostgreSQL + MongoDB test local                                    | 94/94 (2 lượt)                                           | 1 lần thoát 1 dưới tải, không tái hiện               |
| `pnpm test:http -- test/http/ai-assist`                                                        | local                                                              | 56/56                                                    | —                                                    |
| `pnpm check` đầy đủ                                                                            | —                                                                  | chưa chạy                                                | theo quy ước: trước khi đẩy GitHub                   |

Lệch so với SPEC AI-service, người giao việc đồng ý 16/11/2026, Owner chưa review: GPU dự phòng ngoài L4; prompt đổi v1 → v4;
model có thể suy mục đích từ tên phần mềm khi `reason` sáo rỗng (ghi để cải thiện).
