# Spec: khung — Đối soát từng khoản chi với căn cứ phê duyệt

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G9, G8, G5 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-09 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Mỗi dòng sao kê đi đúng một đường đối soát; khoản khớp cam kết chỉ trừ một lần; ngoại lệ chờ Người duyệt chi; thực chi không nhân đôi.

## Sizing decision

- Container: G9, G8, G5 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Mỗi dòng sao kê đi đúng một đường đối soát; khoản khớp cam kết chỉ trừ một lần; ngoại lệ chờ Người duyệt chi; thực chi không nhân đôi.
- Boundaries: `statement_invoice_allocations`, `spend_exceptions`; giao dịch đối soát từng dòng; đối soát lại chỉ dòng được xác nhận.
- Not larger: Không gồm dòng báo cáo chưa phân bổ (`g8-unallocated-cost-line`).
- Not smaller: Ba Story là ba mặt của cùng phép đối soát một dòng sao kê.
- Siblings: `g9-statement-import`, `g8-unallocated-cost-line`, `g8-commitment-realization`.
- Scope map: [G9](../../../roadmap.md#work-item-decomposition-g9), [G8](../../../roadmap.md#work-item-decomposition-g8), [G5](../../../roadmap.md#work-item-decomposition-g5).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc                                                                                                                                |
| -------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-13-07 | AC-1→AC-20 | full     | —                                                                                                                                                 |
| US-12-10 | AC-12      | partial  | AC-1→AC-7, AC-10, AC-11: `g8-invoice-recording`; AC-8: `g8-invoice-subscription-match`; AC-9: `g8-period-close-report`                            |
| US-06-06 | AC-8       | partial  | AC-1, AC-5, AC-9, AC-11: `g8-commitment-realization`; AC-10, AC-12: `g8-spend-basis-on-failure`; AC-2→AC-4, AC-6, AC-7: `g5-commitment-lifecycle` |

## Supporting references

`QĐ-33b`, `QĐ-35a`, `QĐ-50c`, `QĐ-66y`, `QĐ-66z`, `QĐ-83a`(4), `US-05-09` AC-7 (còn ở `g3-downstream-finance-integration`).

## Explicit out of scope

Kết nối ngân hàng, thanh toán.

## Dependencies and blockers

`g9-statement-import`, `g8-commitment-realization`.

## Ownership: module, data, API

Chốt khi thiết kế G9. Vùng C6 có bảng, nghiệp vụ và vai riêng nên có thể là bounded context mới; khi đó phải sửa `tiers.cjs`, bảng tầng ở `module-structure` và ADR-0019 trước khi code.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                                 | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ----------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-13-07 AC-1  | Vendor đã duyệt ≠ mọi khoản chi hợp lệ (chờ thiết kế)                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-2  | Đã duyệt ≠ đã thanh toán (chờ thiết kế)                                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-3  | Không đoán căn cứ (chờ thiết kế)                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-4  | Không quy đổi, không đoán thời hạn (chờ thiết kế)                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-5  | Thẩm quyền (chờ thiết kế)                                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-6  | Một khoản không kéo theo khoản khác (chờ thiết kế)                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-7  | Tái nhập (chờ thiết kế)                                                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-8  | Lỗi tính tiền không sinh hồ sơ sai lệch (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-9  | Hóa đơn đã ghi nhận được đối chiếu, không đếm hai lần (chờ thiết kế)                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-10 | Phân bổ tay và sửa sai (chờ thiết kế)                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-11 | SLA của bước quyết (chờ thiết kế)                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-12 | Phần chưa được hóa đơn giải thích vẫn là thực chi, không đếm hai lần (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-13 | Có căn cứ thì đặt theo căn cứ (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-14 | Chưa có căn cứ thì dòng Chưa phân bổ Cost Center, ngoại lệ vẫn mở (chờ thiết kế)    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-15 | Phí thẻ/chênh lệch tỷ giá thuộc chi phí thực chịu (chờ thiết kế)                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-16 | Hóa đơn đang có `Discrepancy` mở: hiển thị, không tạo hồ sơ thứ hai (chờ thiết kế)  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-17 | Hóa đơn đến sau báo cáo đã phát hành (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-18 | Ngoại lệ đối soát không sinh `Discrepancy` (chờ thiết kế)                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-19 | Người giữ thẻ là Người duyệt chi (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-07 AC-20 | Sau quyết định ngoại lệ ở dòng Chưa phân bổ (chờ thiết kế)                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-10 AC-12 | Finance đánh dấu phí thẻ/chênh lệch tỷ giá khi đối soát (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-06-06 AC-8  | Sao kê khớp chưa có hóa đơn: không đổi trạng thái, chỉ trừ một lần (chờ thiết kế)   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G9, G8, G5 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
