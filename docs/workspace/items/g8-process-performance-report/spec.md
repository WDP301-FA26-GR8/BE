# Spec: khung — Báo cáo hiệu suất quy trình

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Người có quyền xem thời gian xử lý và tỷ lệ quá SLA theo loại bước từ dữ liệu Request hiện có.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Người có quyền xem thời gian xử lý và tỷ lệ quá SLA theo loại bước từ dữ liệu Request hiện có.
- Boundaries: Chỉ đọc; dùng `timing`/`sla` của `requests` qua public API.
- Not larger: Không gồm chất lượng dữ liệu (`g8-data-quality-report`).
- Not smaller: Một báo cáo chỉ đọc.
- Siblings: `g8-data-quality-report`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC        | Coverage | Phần còn lại thuộc |
| -------- | --------- | -------- | ------------------ |
| US-12-06 | AC-1→AC-8 | full     | —                  |

## Supporting references

`KPI-2`, `KPI-4`, `US-05-09`, `US-05-10`, `OQ-F-17`.

## Explicit out of scope

Báo cáo sử dụng.

## Dependencies and blockers

Không chặn; cần mở public read của `requests`.

## Ownership: module, data, API

`requests`, cạnh capability `timing` và `sla` vì dữ liệu thuộc module này.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)                                 | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | ------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-06 AC-1 | Theo bước (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-06 AC-2 | Finance phản hồi đo riêng (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-06 AC-3 | Quá SLA (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-06 AC-4 | Nhánh (a): chỉ phần mềm nội bộ (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-06 AC-5 | Nghẽn (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-06 AC-6 | `KPI-4` đúng định nghĩa (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-06 AC-7 | Quyền (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-06 AC-8 | Nháp khi phòng chưa có Cost Center không vào `KPI-2` (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
