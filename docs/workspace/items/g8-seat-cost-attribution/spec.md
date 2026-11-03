# Spec: khung — Quy chi phí seat và thuê bao về phòng sở hữu; điều chuyển không chuyển chi phí

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance xem được mỗi chi phí seat/thuê bao thuộc Cost Center của phòng sở hữu thuê bao tại ngày phát sinh; điều chuyển người giữ seat không đổi chi phí.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance xem được mỗi chi phí seat/thuê bao thuộc Cost Center của phòng sở hữu thuê bao tại ngày phát sinh; điều chuyển người giữ seat không đổi chi phí.
- Boundaries: Hàm thuần quy phòng/Cost Center theo ngày; đọc lịch sử phòng sở hữu qua public API `catalog`, `organization`; không ghi Assignment.
- Not larger: Không dựng bảng tổng chi (`g8-spend-summary`) và không xử lý khoản chưa căn cứ (`g8-unallocated-cost-line`).
- Not smaller: Một quy tắc quy chi phí, một đường kiểm chứng theo ngày.
- Siblings: `g8-spend-summary`, `g8-unallocated-cost-line`, `g3-downstream-finance-integration`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-12-13 | AC-1→AC-10 | full     | —                  |

## Supporting references

`QĐ-89a`, `QĐ-89b`, `QĐ-87d`, `FR-5.2`; vế chi phí của G6: `US-03-01` AC-12, `US-03-07` AC-10, `US-07-09` AC-24 (còn ở `g3-downstream-finance-integration`, chuyển chủ khi `ready`).

## Explicit out of scope

Chia chi phí theo tỷ lệ, chia theo ngày khi điều chuyển (đã bị `QĐ-89b` thay).

## Dependencies and blockers

`g8-invoice-recording`. Cần đọc được lịch sử Cost Center của phòng tại ngày; A cung cấp contract assignment/ownership qua public API.

## Ownership: module, data, API

`budgets` capability `cost-attribution`; đọc qua `CatalogApi`, `LicensingApi`, không query bảng của hai module đó.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng. Cơ sở _theo dòng tiền_ (US-12-13 AC-3: Cost Center của phòng sở hữu tại ngày hóa đơn) đã được định hình ở cấp dòng hóa đơn trong hạng mục `g8-invoice-recording` (`invoice_lines.cost_center_id`), chốt khi ghi hóa đơn.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                          | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ---------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-13 AC-1  | Seat không đi theo người — ví dụ chuẩn (chờ thiết kế)                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-2  | Phòng cũ giữ nguyên tháng đã qua (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-3  | Theo dòng tiền: Cost Center của phòng sở hữu tại ngày hóa đơn (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-4  | Nhiều lần điều chuyển trong kỳ (chờ thiết kế)                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-5  | Báo cáo đã phát hành không đổi (chờ thiết kế)                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-6  | Tài khoản dịch vụ không đi theo người (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-7  | Tính lại cho cùng kết quả (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-8  | Seat trống hoặc đã thu hồi mà thuê bao chưa giảm (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-9  | Không có điều chuyển lùi ngày (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-13 AC-10 | Phòng sở hữu chưa có Cost Center hiện hành (chờ thiết kế)                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: ghi rõ cơ sở theo dòng tiền đã được giải quyết ở hạng mục `g8-invoice-recording` theo `docs/gehihi-plans/01-design-corrections.md`; chưa Owner review.

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
