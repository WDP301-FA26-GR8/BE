# Spec: khung — Bổ sung API Request và ngân sách cho hai Story duyệt trên Mobile

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G10 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-10 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Trưởng phòng và Người duyệt chi đọc đủ dữ liệu của bước (dòng kế hoạch, snapshot chỉ đọc, hai loại việc) qua contract dùng chung web/mobile; không thêm quyết định chỉ-web.

## Sizing decision

- Container: G10 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Trưởng phòng và Người duyệt chi đọc đủ dữ liệu của bước (dòng kế hoạch, snapshot chỉ đọc, hai loại việc) qua contract dùng chung web/mobile; không thêm quyết định chỉ-web.
- Boundaries: Chỉ query/action/DTO của `requests`, `budgets`; không thêm kênh, không endpoint riêng cho mobile.
- Not larger: Không gồm integration và E2E (`g10-mobile-be-integration`, A).
- Not smaller: Hai Story dùng chung một lần rà contract duyệt.
- Siblings: `g10-mobile-be-integration`.
- Scope map: [G10](../../../roadmap.md#work-item-decomposition-g10).

## Primary Story/AC

| Story    | AC               | Coverage | Phần còn lại thuộc                                     |
| -------- | ---------------- | -------- | ------------------------------------------------------ |
| US-16-02 | AC-9             | partial  | AC-1→AC-8: `g10-mobile-be-integration`                 |
| US-16-03 | AC-1, AC-2, AC-4 | partial  | AC còn lại và vế tích hợp: `g10-mobile-be-integration` |

## Supporting references

`QĐ-61b`, `QĐ-61h`, `US-05-04`, `US-06-01`, DEV-A A-08.

## Explicit out of scope

`US-15-05`, `US-15-06`; bulk action; ứng dụng native.

## Dependencies and blockers

Dev B xác nhận 31/10/2026: B-01→B-04 độc lập với các gói được giao, không tính vào phạm vi này. Đối chiếu source: `US-16-02` AC-9 và `US-16-03` AC-1, AC-2 đi trên route đã có (`GET /access-requests/{id}`, `plan-line-suggestions`, `GET /spend-approvals`, `GET /access-requests/{id}/spend-approval`), nên không chặn. Riêng vế _hiện cùng hàng đợi_ của `US-16-03` AC-4 cần danh sách bước nhu cầu: `pageOpenSpendOf` chỉ trả bước chi, nên vế này chỉ đóng được khi có danh sách đó. Chốt với A hai list hay một projection.

## Ownership: module, data, API

`requests` (`spend-approval-view`, `need-decision`), `budgets`.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)                         | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | ----------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-16-02 AC-9 | Dòng kế hoạch trên mobile (chờ thiết kế)                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-1 | Snapshot chỉ đọc trên mobile (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-2 | Duyệt hoặc từ chối cùng quy tắc (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-4 | Bước nhu cầu của yêu cầu trưởng phòng tự gửi (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G10 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
