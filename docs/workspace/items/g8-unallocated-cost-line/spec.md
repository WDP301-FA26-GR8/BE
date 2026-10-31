# Spec: khung — Dòng Chưa phân bổ Cost Center cho khoản chi chưa có căn cứ

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07/B-09 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Khoản sao kê chưa có căn cứ hiện ở dòng riêng trong thực chi, không thuộc Cost Center nào, và rời dòng đó đúng khi có căn cứ hoặc quyết định.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Khoản sao kê chưa có căn cứ hiện ở dòng riêng trong thực chi, không thuộc Cost Center nào, và rời dòng đó đúng khi có căn cứ hoặc quyết định.
- Boundaries: Đọc dòng sao kê và ngoại lệ của `g9-charge-reconciliation`; không có Cost Center giữ chỗ.
- Not larger: Không gồm phát hiện hay quyết định ngoại lệ (`g9-charge-reconciliation`).
- Not smaller: Một dòng báo cáo với một vòng đời đặt và rời dòng.
- Siblings: `g9-charge-reconciliation`, `g8-spend-summary`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-12-12 | AC-1→AC-11 | full     | —                  |

## Supporting references

`FR-5.2`, `FR-5.4`, `QĐ-50c`, `QĐ-66z`, `QĐ-90f`.

## Explicit out of scope

Lập ngân sách cho dòng này (không có thao tác).

## Dependencies and blockers

Blocker: chưa có `statement_lines`. Điều kiện gỡ: `g9-statement-import`, `g9-charge-reconciliation` có thiết kế `ready`.

## Ownership: module, data, API

Theo module của `g9-charge-reconciliation`, chốt khi `ready`.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-12 AC-1  | Chưa căn cứ: dòng riêng và thực chi (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-2  | Căn cứ thuê bao (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-3  | Căn cứ khoản cam kết: không đổi trạng thái (chờ thiết kế)          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-4  | Không phải Cost Center (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-5  | Không có ngân sách riêng (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-6  | Ngoại lệ vẫn mở (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-7  | Finance không đóng ngoại lệ (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-8  | Finance không gán Cost Center cho khoản chưa căn cứ (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-9  | Hóa đơn đến sau (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-10 | Trưởng phòng không thấy (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-12 AC-11 | Sau quyết định của Người duyệt chi (chờ thiết kế)                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
