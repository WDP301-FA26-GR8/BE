# Spec: khung — IT Admin điều tra bản ghi phát hiện và lập hồ sơ BM-07

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G9 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-09 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

IT Admin lập hồ sơ quyết định với người dùng, người trả, đánh giá kỹ thuật và ý kiến trưởng phòng rồi chuyển Người duyệt chi.

## Sizing decision

- Container: G9 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: IT Admin lập hồ sơ quyết định với người dùng, người trả, đánh giá kỹ thuật và ý kiến trưởng phòng rồi chuyển Người duyệt chi.
- Boundaries: `discovery_dossiers`, `finding_context_requests`; quyền IT Admin; ý kiến trưởng phòng không chặn.
- Not larger: Không quyết định hợp thức hóa (`g9-finding-legalization`).
- Not smaller: Một hồ sơ, một luồng chuẩn bị.
- Siblings: `g9-discovery-findings`, `g9-finding-legalization`.
- Scope map: [G9](../../../roadmap.md#work-item-decomposition-g9).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-13-05 | AC-1→AC-17 | full     | —                  |

## Supporting references

`FR-6.6`, `QĐ-62d`, `BM-07`, `US-05-18` AC-7 (còn ở `g3-downstream-finance-integration`).

## Explicit out of scope

Thu hồi sau không duyệt (`US-13-06`).

## Dependencies and blockers

`g9-discovery-findings`.

## Ownership: module, data, API

Chốt khi thiết kế G9. Vùng C6 có bảng, nghiệp vụ và vai riêng nên có thể là bounded context mới; khi đó phải sửa `tiers.cjs`, bảng tầng ở `module-structure` và ADR-0019 trước khi code.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                        | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | -------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-13-05 AC-1  | Người chịu trách nhiệm (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-2  | Hỏi trưởng phòng (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-3  | Không duyệt (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-4  | Báo nhầm (chờ thiết kế)                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-5  | Không kết tội (chờ thiết kế)                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-6  | IT không quyết (DQ-06) (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-7  | Lý do bắt buộc (OI-14g) (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-8  | Bối cảnh không chặn quyết định (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-9  | Khoản chi không gắn phòng nào thì không hỏi ai (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-10 | Phòng thiếu trưởng phòng ⟹ chờ, không giao ai (chờ thiết kế)               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-11 | Mức kiểm soát chỉ là đầu vào (chờ thiết kế)                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-12 | Ý kiến Business Owner khi trùng chức năng, không chặn (chờ thiết kế)       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-13 | Khớp tin cậy thấp phải qua người trước khi quyết (chờ thiết kế)            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-14 | Nội dung hồ sơ `BM-07` (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-15 | Người giữ thẻ không phải người dùng (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-16 | Màn discovery ẩn họ tên (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-05 AC-17 | Lưu ý trước khi thu hồi trong đánh giá kỹ thuật của `BM-07` (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G9 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
