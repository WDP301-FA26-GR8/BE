# Spec: khung — Bảng tổng chi: ngân sách, thực chi, cam kết, còn lại

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance và Người duyệt chi xem bốn con số theo kỳ và chiều gom, trưởng phòng chỉ thấy phần của phòng mình; tổng khớp các khoản nguồn và không đếm hai lần.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance và Người duyệt chi xem bốn con số theo kỳ và chiều gom, trưởng phòng chỉ thấy phần của phòng mình; tổng khớp các khoản nguồn và không đếm hai lần.
- Boundaries: Read model theo kỳ; hai cơ sở ghi nhận; quyền theo vai; không ghi dữ liệu.
- Not larger: Không gồm báo cáo bất biến (`g8-period-close-report`) và dashboard (`g8-finance-dashboards`).
- Not smaller: Một bảng đọc với một công thức, một test matrix đối chiếu tổng.
- Siblings: `g8-seat-cost-attribution`, `g8-period-close-report`, `g8-finance-dashboards`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-12-01 | AC-1→AC-13 | full     | —                  |

## Supporting references

`FR-5.1`→`FR-5.3`, `FR-5.8a`, `BR-29.1`→`BR-29.8`, `QĐ-50c`, `QĐ-85a`, `QĐ-86b`, `US-06-09` AC-12 (còn ở `g3-downstream-finance-integration`).

## Explicit out of scope

Doanh thu, ROI; lập ngân sách; khép kỳ.

## Dependencies and blockers

`g8-commitment-realization`, `g8-internal-cost-entry`, `g8-seat-cost-attribution`; AC-8 cần `g8-unallocated-cost-line` và `g9-charge-reconciliation`.

## Ownership: module, data, API

`budgets` capability `spend-summary`; đọc module khác qua public API.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                          | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ------------------------------------------------------------ | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-01 AC-1  | Bốn con số trên chi phí thực chịu (chờ thiết kế)             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-2  | Hai cơ sở (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-3  | Thời điểm phát sinh; seat không đi theo người (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-4  | Chiều gom (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-5  | Truy căn cứ (chờ thiết kế)                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-6  | Quyền (chờ thiết kế)                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-7  | Phạm vi trưởng phòng (chờ thiết kế)                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-8  | Dòng Chưa phân bổ Cost Center (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-9  | Không đếm hai lần (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-10 | Cam kết đã thành chi phí (chờ thiết kế)                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-11 | Cấp công ty là tổng các phòng (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-12 | Báo cáo đã phát hành là bản khác (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-01 AC-13 | Thời điểm cập nhật (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
