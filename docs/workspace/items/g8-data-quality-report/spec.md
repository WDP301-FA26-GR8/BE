# Spec: khung — Báo cáo chất lượng dữ liệu và KPI-5

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Người có quyền xem chất lượng dữ liệu và KPI-5, phần phụ thuộc usage hiện lý do thiếu dữ liệu.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Người có quyền xem chất lượng dữ liệu và KPI-5, phần phụ thuộc usage hiện lý do thiếu dữ liệu.
- Boundaries: Chỉ đọc; tách vế không cần usage khỏi vế chờ G7.
- Not larger: Không gồm báo cáo quy trình (`g8-process-performance-report`).
- Not smaller: Một báo cáo chỉ đọc.
- Siblings: `g8-process-performance-report`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC        | Coverage | Phần còn lại thuộc |
| -------- | --------- | -------- | ------------------ |
| US-12-07 | AC-1→AC-8 | full     | —                  |

## Supporting references

`FR-5.12`, `KPI-5`.

## Explicit out of scope

Sửa dữ liệu nguồn.

## Dependencies and blockers

Vế usage chờ contract G7 (Owner); vế còn lại không chặn.

## Ownership: module, data, API

Chốt chỗ đặt khi thiết kế theo [hướng dẫn dev mới](../../../guides/huong-dan-dev-moi.md#3-thêm-x-thì-đặt-ở-đâu): `budgets` không import được `requests`, nên phần cần dữ liệu Request đặt ở `requests` (đã có cạnh `requests → budgets`).

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)    | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | -------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-07 AC-1 | KPI-5 (chờ thiết kế)                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-07 AC-2 | Phân quyền KPI-5 (chờ thiết kế)        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-07 AC-3 | KPI-1 (chờ thiết kế)                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-07 AC-4 | Độ mới (chờ thiết kế)                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-07 AC-5 | Không mục tiêu (chờ thiết kế)          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-07 AC-6 | Không đánh giá được ≠ 0 (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-07 AC-7 | Thuê bao thiếu hạn chót (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-07 AC-8 | Trạng thái bộ thu thập (chờ thiết kế)  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
