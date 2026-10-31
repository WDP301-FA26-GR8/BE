# Spec: khung — Finance import sao kê, chuẩn hóa và chấm mức tin cậy

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G9 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-09 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance import CSV sao kê qua bước xem trước; mỗi dòng có tên chuẩn hóa hoặc vào hàng đợi review của IT Admin; hủy ở xem trước không ghi gì.

## Sizing decision

- Container: G9 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance import CSV sao kê qua bước xem trước; mỗi dòng có tên chuẩn hóa hoặc vào hàng đợi review của IT Admin; hủy ở xem trước không ghi gì.
- Boundaries: `statement_imports`, `statement_lines`, `statement_review_items`; giao dịch xác nhận một lô; tệp mục đích `COST_STATEMENT`.
- Not larger: Không đối chiếu danh mục (`g9-discovery-findings`) và không đối soát khoản chi (`g9-charge-reconciliation`).
- Not smaller: Xem trước và xác nhận cùng một lô; chuẩn hóa là bước của xác nhận.
- Siblings: `g9-discovery-findings`, `g9-charge-reconciliation`.
- Scope map: [G9](../../../roadmap.md#work-item-decomposition-g9).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-13-01 | AC-1→AC-13 | full     | —                  |

## Supporting references

`FR-6.2`→`FR-6.6`, `QĐ-31a`, `QĐ-34c`, `QĐ-38`, `QĐ-66h`, `US-04-04` AC-11 (còn ở `g3-downstream-finance-integration`), khung import `US-02-01`.

## Explicit out of scope

Mẫu CSV ngân hàng thật (`QĐ-32c`); gợi ý AI (`QĐ-69`).

## Dependencies and blockers

`g8-invoice-recording` cho liên kết hóa đơn. Tệp thật chỉ dùng ở môi trường và quyền được giao.

## Ownership: module, data, API

Chốt khi thiết kế G9. Vùng C6 có bảng, nghiệp vụ và vai riêng nên có thể là bounded context mới; khi đó phải sửa `tiers.cjs`, bảng tầng ở `module-structure` và ADR-0019 trước khi code. `data-import` cho khung xem trước nếu dùng lại được.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                         | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | --------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-13-01 AC-1  | Khớp theo mẫu (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-2  | Khớp mờ (chờ thiết kế)                                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-3  | Tin cậy từ phương pháp (chờ thiết kế)                                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-4  | Quyền import (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-5  | Tên nhà cung cấp phải ở vị trí bên nhận tiền (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-6  | Chỉ dẫn tiếng Việt là văn bản đáng ngờ (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-7  | Hủy ở xem trước không ghi gì (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-8  | Chỉ CSV và mã hóa được hỗ trợ (chờ thiết kế)                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-9  | IT Admin xác nhận nhà cung cấp rồi đối soát lại đúng dòng đó (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-10 | Mục review không bao giờ bị xóa và mỗi dòng đúng một đường (chờ thiết kế)   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-11 | Hoàn tiền là bối cảnh (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-12 | Nhà cung cấp nhiều dòng dịch vụ không tự chuẩn hóa (chờ thiết kế)           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-01 AC-13 | Tệp sao kê mang mục đích sao kê chi phí (chờ thiết kế)                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G9 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
