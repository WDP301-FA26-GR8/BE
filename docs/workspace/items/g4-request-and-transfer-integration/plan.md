# Plan: khung — phần nối Request (G5) và điều chuyển/đổi chức vụ (G6) với bộ chuẩn và cấp phát

- [Spec](spec.md); revision đầu vào: Docs `9416fe0`, BE `57b1e1c`.
- Phụ trách: Dev B (nhánh `hien-dev`), tiếp quản 31/10/2026. Thiết kế ban đầu bởi: AI theo giao việc Owner.
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `not-started`. PR: chưa có.

## Before coding

Hạng mục khung: không code. Đọc spec, xác nhận blocker ở mục _Dependencies and blockers_ đã được gỡ trước khi thiết kế.

## Tasks

### Task 1: gỡ blocker và thiết kế chi tiết

- Files: `spec.md`, `plan.md`.
- Depends on: blocker ở spec được gỡ.
- Acceptance: spec đủ contract, dữ liệu, quyền, lỗi, ma trận test cụ thể và quyết định chờ Owner; không còn câu hỏi chặn.
- Verify: `pnpm rules:check` và `pnpm rules:format` → xanh.

### Task 2: triển khai theo thiết kế

- Files: theo mục _Ownership_ của spec (chốt khi `ready`).
- Depends on: Task 1.
- Acceptance: các AC `full` trong bảng Primary có test đỏ-trước/xanh-sau; AC `partial` ghi đúng vế đã làm.
- Verify: `pnpm check`; thêm `pnpm test:e2e`, `pnpm openapi:export`, integration trên PostgreSQL riêng nếu đổi HTTP/schema.

### Task 3: chạy lại bằng chứng B-05

- Files: `spec.md` (cột bằng chứng), `plan.md`.
- Depends on: re-audit ở spec.
- Acceptance: `US-07-01` AC-3, AC-16; `US-07-04` AC-6, AC-12 (vế chưa chi); `US-01-12` AC-8, AC-9 có kết quả test thật.
- Verify: `pnpm test -- src/modules/requests/grant`; `pnpm test:integration -- test/integration/licensing test/integration/requests`.

### Task 4: test đỏ và sửa quyền đọc BM-04 của trưởng phòng

- Files: `src/modules/personnel/personnel-self-action.policy.ts`, `src/modules/personnel/transfer/transfers.controller.ts`, `transfer-query.service.ts`,
  `transfer.mapper.ts`, test ở `test/http/personnel/`, `test/integration/personnel/`.
- Depends on: D7.
- Acceptance: `US-01-12` AC-4 trừ vế `BM-06`.
- Verify: test đỏ trước; `pnpm test:http`, `pnpm openapi:export`, integration module `personnel`.

### Task 5: test Request hết hạn mức

- Files: `test/integration/requests/` hoặc `test/integration/licensing/`.
- Depends on: none.
- Acceptance: `US-07-04` AC-4.
- Verify: `pnpm test:integration -- test/integration/licensing`.

## Verification and handoff

| Lệnh / kiểm tra AC | Revision / môi trường | Kết quả thực chạy | Giới hạn / việc còn lại  |
| ------------------ | --------------------- | ----------------- | ------------------------ |
| —                  | —                     | chưa chạy         | hạng mục chưa triển khai |

- [ ] AC trong scope có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan/test design phản ánh đúng implementation cuối.
- [ ] Diff cuối đã tự review; tài liệu vận hành bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau đúng sự kiện thật.
