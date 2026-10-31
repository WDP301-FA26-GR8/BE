# Spec: khung — Dashboard vận hành theo vai và danh mục cảnh báo

- Phụ trách: Dev A (A-10, A-03); khung do Dev B lập cho scope map.
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: A-10 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Employee, trưởng phòng, IT Admin, Super Admin có trang tổng quan đúng vai và cảnh báo theo danh mục duy nhất.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Employee, trưởng phòng, IT Admin, Super Admin có trang tổng quan đúng vai và cảnh báo theo danh mục duy nhất.
- Boundaries: Hạng mục khung: A tách theo outcome khi nhận; phần tiền của Manager dùng contract của `g8-finance-dashboards`.
- Not larger: Giữ chỗ cho AC đã ánh xạ, không thêm AC.
- Not smaller: A chốt ranh giới khi thiết kế; dòng cảnh báo license có thể chuyển về `g4-notification-delivery` (A-03).
- Siblings: `g8-finance-dashboards`, `g4-notification-delivery`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC                    | Coverage | Phần còn lại thuộc                                                                                               |
| -------- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| US-12-15 | AC-1→AC-4, AC-7→AC-23 | partial  | AC-5, AC-6: `g8-finance-dashboards`; AC-24: `g5-budget-proposal-and-review`, `g3-downstream-finance-integration` |

## Supporting references

`FR-5.14`, BRD 5.5.4; danh sách DEV-A A-02, A-03, A-10.

## Explicit out of scope

Phần tài chính (`g8-finance-dashboards`).

## Dependencies and blockers

A tiếp quản; phụ thuộc A-02 và queue B-02/B-03/B-04 nằm ngoài phạm vi này.

## Ownership: module, data, API

A chốt khi thiết kế.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                              | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ---------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-15 AC-1  | Một danh mục duy nhất (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-2  | Trang tổng quan Employee (chờ thiết kế)                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-3  | Trang tổng quan trưởng phòng (chờ thiết kế)                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-4  | Trang tổng quan IT Admin (chờ thiết kế)                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-7  | Trang tổng quan Super Admin (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-8  | Employee nhận cảnh báo từ dữ liệu nội bộ (dòng 3) (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-9  | Thu hồi sắp thực hiện và đã hủy (dòng 4, 5) (chờ thiết kế)       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-10 | Hạn chót báo hủy (dòng 1) (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-11 | Cảnh báo chỉ tới người đúng vai (chờ thiết kế)                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-12 | Phiên bản ngân sách chờ duyệt (dòng 18, `QĐ-82a`) (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-13 | Phòng thiếu trưởng phòng (dòng 9) (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-14 | Thực hiện trễ (dòng 16) (chờ thiết kế)                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-15 | Kênh: thư điện tử chỉ cho hai loại (chờ thiết kế)                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-16 | Không push trên mobile (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-17 | Thiếu dữ liệu không bịa mốc (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-18 | Cảnh báo dựa trên usage chưa có (chờ thiết kế)                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-19 | Cảnh báo ngoài bảng BRD vẫn dẫn Story nguồn (chờ thiết kế)       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-20 | Cảnh báo mới của `QĐ-66` có trong danh mục (chờ thiết kế)        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-21 | Cảnh báo mới của `QĐ-77` có trong danh mục (chờ thiết kế)        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-22 | Cảnh báo mới của `QĐ-82` có trong danh mục (chờ thiết kế)        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-23 | Cảnh báo theo `QĐ-87` có trong danh mục (chờ thiết kế)           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
