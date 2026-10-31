# Plan: khung — Bản ghi phát hiện một-bản-ghi-mở-mỗi-nhà-cung-cấp

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `not-started`. PR: chưa có.

## Before coding

Hạng mục khung: không code. Đọc spec, xác nhận mục _Dependencies and blockers_ trước khi thiết kế; đối chiếu lại source ở BE
hiện hành.

## Tasks

### Task 1: thiết kế chi tiết

- Files: `spec.md`, `plan.md`.
- Depends on: mục _Dependencies and blockers_ của spec.
- Acceptance: spec đủ contract, dữ liệu, quyền, lỗi, ma trận test cụ thể và quyết định chờ Owner; không còn câu hỏi chặn.
- Verify: `pnpm rules:check` và `pnpm rules:format` → xanh.

### Task 2: triển khai theo thiết kế

- Files: theo mục _Ownership_ của spec (chốt khi `ready`).
- Depends on: Task 1.
- Acceptance: các AC trong bảng Primary có test đỏ-trước/xanh-sau.
- Verify: `pnpm check`; thêm `pnpm test:http`, `pnpm openapi:export`, integration trên PostgreSQL riêng nếu đổi HTTP/schema.

## Verification and handoff

| Lệnh / kiểm tra AC | Revision / môi trường | Kết quả thực chạy | Giới hạn / việc còn lại  |
| ------------------ | --------------------- | ----------------- | ------------------------ |
| —                  | —                     | chưa chạy         | hạng mục chưa triển khai |

- [ ] AC trong scope có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan/test design phản ánh đúng implementation cuối.
- [ ] Diff cuối đã tự review; tài liệu vận hành bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau
      đúng sự kiện thật.
