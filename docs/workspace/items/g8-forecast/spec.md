# Spec: khung — Dự báo chi phí lớp L1 và kịch bản L3

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance xem dự báo L1 tính thẳng từ thuê bao/hợp đồng và ba kịch bản L3, mỗi con số kèm nguồn, giả định và thời điểm tính.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance xem dự báo L1 tính thẳng từ thuê bao/hợp đồng và ba kịch bản L3, mỗi con số kèm nguồn, giả định và thời điểm tính.
- Boundaries: Đọc thuê bao, lịch thanh toán; `forecast_scenarios`; không tạo khoản cam kết.
- Not larger: Không gồm L2 (`US-12-08`, `DEFERRED`).
- Not smaller: Một màn dự báo, ba lớp cùng phép tính kỳ.
- Siblings: `g8-period-close-report`, `g8-subscription-renewal`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC        | Coverage | Phần còn lại thuộc |
| -------- | --------- | -------- | ------------------ |
| US-12-03 | AC-1→AC-7 | full     | —                  |

## Supporting references

`FR-5.5`, `ADR-09`, `QĐ-25`, `QĐ-62s`, `QĐ-84a`(4), `QĐ-84f`, finding F35.

## Explicit out of scope

Mô hình thống kê; dự báo `consumption`.

## Dependencies and blockers

Blocker: F35 — `pricing.policy.ts` coi mọi kỳ có giá là ràng buộc; `QĐ-84a`(4) đòi kỳ hủy được chỉ là dự báo. Owner chốt chính sách giá trước AC-7. AC-5, AC-7 cần quyết định gia hạn của A (`g8-subscription-renewal`).

## Ownership: module, data, API

`budgets` capability `forecast`; `requests/access-request/pricing.policy.ts` nếu F35 đổi hành vi.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)                            | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | -------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-03 AC-1 | L1 (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-03 AC-2 | L3 (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-03 AC-3 | L2 (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-03 AC-4 | Không số trần trụi (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-03 AC-5 | Gia hạn không tạo cam kết (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-03 AC-6 | Quyền (chờ thiết kế)                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-03 AC-7 | Dự báo theo năm của kỳ không phải khoản cam kết (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
