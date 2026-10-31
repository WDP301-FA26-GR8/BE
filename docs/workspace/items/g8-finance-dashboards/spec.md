# Spec: khung — Trang tổng quan Finance và Người duyệt chi

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance và Người duyệt chi mở trang tổng quan thấy đúng các mục việc và số tổng theo vai, không có thao tác duyệt của Finance.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance và Người duyệt chi mở trang tổng quan thấy đúng các mục việc và số tổng theo vai, không có thao tác duyệt của Finance.
- Boundaries: Read model tổng hợp; cấp phép tính tiền cho phần Manager của A-10 qua contract.
- Not larger: Không gồm dashboard vận hành (`g8-role-dashboards-and-alerts`).
- Not smaller: Hai trang cùng nguồn số liệu tài chính.
- Siblings: `g8-role-dashboards-and-alerts`, `g8-spend-summary`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc                                                                                                                  |
| -------- | ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| US-12-15 | AC-5, AC-6 | partial  | AC-1→AC-4, AC-7→AC-23: `g8-role-dashboards-and-alerts`; AC-24: `g5-budget-proposal-and-review`, `g3-downstream-finance-integration` |

## Supporting references

`FR-5.14`, BRD 5.5.4, `QĐ-82m` B.

## Explicit out of scope

Thao tác duyệt trên dashboard.

## Dependencies and blockers

`g8-spend-summary`; mục đề xuất gia hạn của AC-6 cần `g8-subscription-renewal`.

## Ownership: module, data, API

Chốt chỗ đặt khi thiết kế theo [hướng dẫn dev mới](../../../guides/huong-dan-dev-moi.md#3-thêm-x-thì-đặt-ở-đâu): `budgets` không import được `requests`, nên phần cần dữ liệu Request đặt ở `requests` (đã có cạnh `requests → budgets`).

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)            | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | ---------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-15 AC-5 | Trang tổng quan Finance (chờ thiết kế)         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-15 AC-6 | Trang tổng quan Người duyệt chi (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
