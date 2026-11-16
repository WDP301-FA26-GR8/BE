# Spec: ai-gateway-wiring — Dựng và kiểm chứng cổng kết nối BE ↔ AI-service

- Phụ trách: Agent implement theo giao việc (15/11/2026), thực hiện theo GATEWAY_PLAN.md.
- Thiết kế ban đầu bởi: Agent.
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `5bb2e6a`, BE `18a48f3` (kế hoạch GATEWAY_PLAN.md, PLAN.md T2.4/T5.3, SPEC.md §4, §7, §9, §12).
- Nhóm roadmap: G10 — planning container cho AI và Mobile.
- [Kế hoạch](plan.md).

## Business outcome

Kỹ sư vận hành chạy một script smoke (`scripts/ai-gateway-smoke.sh`) tự động kiểm chứng toàn bộ đường truyền BE ↔ AI-service: kiểm tra trạng thái sức khỏe (`healthz`), xác thực bearer token, đồng bộ hợp đồng v1, và kiểm tra luồng tóm tắt hàng đợi bước duyệt theo `US-15-05`.

## Sizing decision

- Container: G10 (AI và Mobile).
- Mode: `technical-enabler`.
- Outcome and owner: Cổng kết nối HTTP giữa `HttpAiServiceClient` (BE) và FastAPI front (`AI-service`); capability `ai-assist/ai-service`.
- Boundaries: Biến môi trường (`AI_SERVICE_BASE_URL`, `AI_SERVICE_TOKEN`, `AI_SERVICE_TIMEOUT_MS`), script `scripts/ai-gateway-smoke.sh`. Không đổi schema database, không đổi wire contract v1.
- Not larger: Không bao gồm màn hình FE (`US-15-05` UI, task 4.1 của PLAN), không bao gồm chế độ giả lập (`AI_PROVIDER_MODE`, Phase 1 của PLAN), không đổi contract v1.
- Not smaller: Script smoke, đồng bộ cấu hình token/URL, và tài liệu vận hành đi cùng nhau để đảm bảo kiểm chứng được.
- Siblings: `ai-assist-queue-summary-be` (chức năng nghiệp vụ tóm tắt phía BE).
- Scope map: [G10](../../../roadmap.md#work-item-decomposition-g10).

## Primary Story/AC

| Story | AC            | Coverage | Phần còn lại thuộc                                                    |
| ----- | ------------- | -------- | --------------------------------------------------------------------- |
| —     | ENABLER-AI-GW | n/a      | gỡ chặn kiểm chứng đầu-cuối `ai-assist-queue-summary-be` (`US-15-05`) |

## Supporting references

- `US-15-05` (tóm tắt AI hàng đợi duyệt)
- `PLAN.md` (T2.4 nối BE với Modal, T5.3 thử lỗi)
- `GATEWAY_PLAN.md` (kế hoạch dựng cổng)
- `BE/src/modules/ai-assist/README.md`

## Explicit out of scope

- Triển khai VPS production và thay đổi `.env` production.
- Màn hình UI FE web / mobile.
- Tính năng tài chính `US-15-06` (chờ `US-12-14`).
- Thay đổi hợp đồng v1.

## Dependencies and blockers

| Phụ thuộc                       | Trạng thái                          | Ảnh hưởng                              |
| ------------------------------- | ----------------------------------- | -------------------------------------- |
| AI-service chạy stub hoặc Modal | Có (stub chạy local cổng 8000)      | Cho phép smoke direct và local E2E     |
| PostgreSQL cho BE               | Docker daemon chưa bật trên sandbox | Tạm chặn bước chạy full BE E2E (S1-S9) |
| Modal CLI authentication        | Chưa login                          | Chặn deploy Modal cloud (U4/U6)        |

## Ownership: module, data, API

- Module: `ai-assist` (`HttpAiServiceClient` ở `ai-service/ai-service-client.service.ts`, chính sách môi trường ở `ai-service/ai-service-environment.policy.ts`).
- Bảng: Không thay đổi bảng hay schema DB.
- API: Sử dụng các route hiện có của `ai-assist` (mọi controller BE có `version: '1'`, nên đường thật có `/api/v1`): `/api/v1/ai/access-request-summaries/source`, `/api/v1/ai/access-request-summaries`, `/api/v1/ai/access-request-summaries/{invocationId}`, `/api/v1/ai/invocations/{invocationId}/content`.
- Script: Thêm `scripts/ai-gateway-smoke.sh` phục vụ kiểm thử khép kín và phân tách tầng lỗi.

## Behavior and design

- Client `HttpAiServiceClient` gửi `POST {AI_SERVICE_BASE_URL}/v1/summaries/access-request-queue` với header `Authorization: Bearer <AI_SERVICE_TOKEN>` và `X-Request-Id: <invocationId>`.
- Timeout và retry: Một deadline `AI_SERVICE_TIMEOUT_MS` (mặc định 90 000, max 120 000). Retry đúng 1 lần sau 2 giây cho mã 429, 500, 503 hoặc lỗi mạng. Mã 504 không retry.
- Script smoke `scripts/ai-gateway-smoke.sh`:
  - Chế độ `--direct`: Kiểm tra trực tiếp dịch vụ AI ở `$AI_URL` qua Contract v1 (`healthz`, warmup 401, warmup 200, summarize 200).
  - Chế độ full: Đi qua 9 bước S1–S9, đăng nhập Super Admin, bật 2 công tắc, đăng nhập Manager, lấy `queueRevision`, gọi tóm tắt, poll đến `COMPLETED`, kiểm tra nội dung và số dòng.

## Test matrix

| Mã kiểm tra | Kịch bản                       | Kỳ vọng                                 | Cách kiểm                                         |
| ----------- | ------------------------------ | --------------------------------------- | ------------------------------------------------- |
| TM-01       | Kiểm tra AI-service trực tiếp  | 200, status ok, promptVersion hiện hành | `scripts/ai-gateway-smoke.sh --direct`            |
| TM-02       | Thiếu token khi gọi warmup AI  | 401 Unauthorized                        | `scripts/ai-gateway-smoke.sh --direct`            |
| TM-03       | Có URL mà thiếu token trong BE | BE từ chối khởi động, nêu tên biến      | Unit test `ai-service-environment.policy.spec.ts` |
| TM-04       | Hai công tắc AI tắt            | Trả 403 `AI.DISABLED` trước khi gọi AI  | Unit test `queue-summary.service.spec.ts`         |

## Sửa sau kiểm chứng (15/11/2026)

- Script mặc định `BE_URL` thiếu `/v1` ⇒ mọi bước S2–S9 sẽ nhận 404; đổi thành `http://127.0.0.1:4000/api/v1`.
- S8 kỳ vọng `stepCount - omittedCount` dòng là sai (`stepCount` đã là số bước được tóm tắt, ≤ 20); đổi thành `stepCount`.
- `--direct` thêm D2 (warmup thiếu token ⇒ 401) và D3 (warmup có token ⇒ 200) để khớp TM-02; lỗi D4 in mã HTTP và
  `error.code`. File tạm dùng `mktemp` thay đường cố định trong `/tmp`.
- Đã chạy lại `--direct` với AI-service stub: đúng token ⇒ D1–D4 PASS, exit 0; sai token ⇒ dừng ở D3 với 401, exit 1.
- Chế độ đầy đủ S1–S9 **chưa chạy** (cần PostgreSQL local).

## Definition of Done

1. Harness `scripts/ai-gateway-smoke.sh` thoát mã 0 ở chế độ `--direct`.
2. Token giữa `BE/.env` và `AI-service/.env` đồng bộ (cùng hash).
3. Cấu hình `AI_SERVICE_BASE_URL` và `AI_SERVICE_TIMEOUT_MS` có trong `BE/.env`.
4. Tài liệu module cập nhật cách chạy và xoay token.
5. `pnpm typecheck` và unit test `ai-assist` pass 100%.
