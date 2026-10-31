# Spec: khung — Finance ghi chi phí phần mềm nội bộ vào đúng một Cost Center

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance ghi khoản chi phí nội bộ cho một Cost Center `Unit`, thực chi tăng đúng khoản đó, không sinh hóa đơn, cam kết hay bước duyệt.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance ghi khoản chi phí nội bộ cho một Cost Center `Unit`, thực chi tăng đúng khoản đó, không sinh hóa đơn, cam kết hay bước duyệt.
- Boundaries: Một giao dịch ghi `internal_cost_entries` + audit; chỉ `FINANCE`; đọc Cost Center qua `OrganizationApi`.
- Not larger: Không gồm chiều báo cáo (`g8-spend-summary`) và khép kỳ (`g8-period-close-report`).
- Not smaller: Một Story, một bảng, một test matrix.
- Siblings: `g8-spend-summary`, `g8-period-close-report`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-12-11 | AC-1→AC-11 | full     | —                  |

## Supporting references

`FR-5.2`, `FR-5.3`, `INV-03`, `QĐ-49a`, `QĐ-49g`, `QĐ-62o`, Logical ERD 7.106, `LD-11`.

## Explicit out of scope

Phân bổ theo tỷ lệ (không tồn tại); Cost Center `Company` (`QĐ-86b`).

## Dependencies and blockers

`g8-commitment-realization` (nguồn thực chi một mối). `OQ-F-10` có lựa chọn Logical `LD-11`: cột hủy + lịch sử ở audit.

## Ownership: module, data, API

`budgets` capability `internal-cost`; bảng `internal_cost_entries`.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                 | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | --------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-11 AC-1  | Ghi một khoản (chờ thiết kế)                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-2  | Chia bằng nhiều khoản (chờ thiết kế)                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-3  | Không có tỷ lệ (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-4  | Phần mềm nội bộ phục vụ toàn công ty (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-5  | Chỉ phần mềm nội bộ (chờ thiết kế)                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-6  | Cost Center phải tồn tại (chờ thiết kế)             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-7  | Tiền tệ và tỷ giá (chờ thiết kế)                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-8  | Quyền (chờ thiết kế)                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-9  | Có mặt trong báo cáo (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-10 | Kỳ đã phát hành (chờ thiết kế)                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-11 AC-11 | Khoản có kỳ dài hơn kỳ báo cáo (chờ thiết kế)       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
