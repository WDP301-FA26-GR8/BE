# Spec: khung — Bản ghi phát hiện một-bản-ghi-mở-mỗi-nhà-cung-cấp

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G9 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-09 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Mỗi nhà cung cấp ngoài danh mục có tối đa một bản ghi cần xem xét đang mở, cập nhật số lần xuất hiện và tầng rủi ro từ dữ liệu IT đã ghi.

## Sizing decision

- Container: G9 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Mỗi nhà cung cấp ngoài danh mục có tối đa một bản ghi cần xem xét đang mở, cập nhật số lần xuất hiện và tầng rủi ro từ dữ liệu IT đã ghi.
- Boundaries: `discovery_findings`; ràng buộc một bản ghi mở (`INV-13`); chạy trong giao dịch xác nhận lô hoặc bước sau đó.
- Not larger: Không gồm điều tra và quyết định (`g9-finding-investigation`, `g9-finding-legalization`).
- Not smaller: Một quy tắc tạo/cập nhật/mở lại.
- Siblings: `g9-statement-import`, `g9-finding-investigation`.
- Scope map: [G9](../../../roadmap.md#work-item-decomposition-g9).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-13-03 | AC-1→AC-10 | full     | —                  |

## Supporting references

`FR-6.4`, `FR-6.6`→`FR-6.8`, `INV-13`, `QĐ-33c`, `SoD-6`.

## Explicit out of scope

Nguồn IdP và bộ thu thập (`US-13-02`, `US-13-04` `DEFERRED`).

## Dependencies and blockers

`g9-statement-import`.

## Ownership: module, data, API

Chốt khi thiết kế G9. Vùng C6 có bảng, nghiệp vụ và vai riêng nên có thể là bounded context mới; khi đó phải sửa `tiers.cjs`, bảng tầng ở `module-structure` và ADR-0019 trước khi code.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                         | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | --------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-13-03 AC-1  | Tạo (chờ thiết kế)                                                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-2  | Không trùng (chờ thiết kế)                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-3  | Mở lại báo nhầm (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-4  | Đã trong danh mục (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-5  | Không tự đóng (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-6  | Không duyệt rồi tái xuất hiện (OI-14f) (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-7  | Đã duyệt hợp thức hóa thì không mở lại (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-8  | Nhà cung cấp đã duyệt: ngoại lệ ở khoản chi, không ở bản ghi (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-9  | Tầng rủi ro chỉ từ dữ liệu IT đã ghi (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-03 AC-10 | Chỉ Người duyệt chi đóng bản ghi (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G9 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
