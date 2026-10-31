# Spec: khung — Báo cáo tiết kiệm hai con số tách riêng

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Người duyệt chi, Finance, IT Admin thấy tiết kiệm thực hiện ngay và tại kỳ gia hạn riêng, không cộng, kèm căn cứ.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Người duyệt chi, Finance, IT Admin thấy tiết kiệm thực hiện ngay và tại kỳ gia hạn riêng, không cộng, kèm căn cứ.
- Boundaries: Chỉ đọc; nhận sự kiện kết quả gia hạn của A và khuyến nghị đã thực hiện của Owner.
- Not larger: Không ghi tiết kiệm lúc thu hồi (`US-10-07`) hay lúc ghi kỳ mới (`US-11-03`).
- Not smaller: Một báo cáo chỉ đọc.
- Siblings: `g8-subscription-renewal`, `g8-spend-summary`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC        | Coverage | Phần còn lại thuộc |
| -------- | --------- | -------- | ------------------ |
| US-12-04 | AC-1→AC-8 | full     | —                  |

## Supporting references

`FR-4.15`, `FR-5.9`, `QĐ-24`, `QĐ-66w`, `US-03-04` AC-6.

## Explicit out of scope

ROI, xếp hạng nhân viên.

## Dependencies and blockers

Blocker: contract khuyến nghị đã thực hiện (G7, Owner) và kết quả gia hạn (A-06). Thiếu dữ liệu thì hiện lý do, không suy từ quyết định chưa thi hành.

## Ownership: module, data, API

Chốt chỗ đặt khi thiết kế theo [hướng dẫn dev mới](../../../guides/huong-dan-dev-moi.md#3-thêm-x-thì-đặt-ở-đâu): `budgets` không import được `requests`, nên phần cần dữ liệu Request đặt ở `requests` (đã có cạnh `requests → budgets`).

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)                 | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | --------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-04 AC-1 | Tách riêng (chờ thiết kế)                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-04 AC-2 | Căn cứ (chờ thiết kế)                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-04 AC-3 | Số thực tế (chờ thiết kế)                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-04 AC-4 | Quyền trưởng phòng (chờ thiết kế)                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-04 AC-5 | Quyền Super Admin (chờ thiết kế)                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-04 AC-6 | Thu hồi không tự thêm tiền (chờ thiết kế)           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-04 AC-7 | Chưa có hành động (chờ thiết kế)                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-04 AC-8 | Sự kiện ghi tiết kiệm thực hiện ngay (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
