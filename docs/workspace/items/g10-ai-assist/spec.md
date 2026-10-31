# Spec: khung — Tóm tắt hàng đợi và bản nháp diễn giải bằng AI

- Phụ trách: Bên AI (phân công Owner 31/10/2026); khung do Dev B lập cho scope map.
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G10 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: bên AI ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Trưởng phòng/Người duyệt chi có tóm tắt hàng đợi và Finance có bản nháp diễn giải trên web.

## Sizing decision

- Container: G10 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `grouped-stories`.
- Outcome and owner: Trưởng phòng/Người duyệt chi có tóm tắt hàng đợi và Finance có bản nháp diễn giải trên web.
- Boundaries: Hạng mục khung: hai dev BE không implement; chỉ giữ chỗ cho scope map.
- Not larger: Giữ chỗ cho AC đã ánh xạ.
- Not smaller: Bên AI chốt ranh giới khi thiết kế.
- Siblings: `g10-mobile-be-integration`.
- Scope map: [G10](../../../roadmap.md#work-item-decomposition-g10).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-15-05 | AC-1→AC-15 | full     | —                  |
| US-15-06 | AC-1→AC-12 | full     | —                  |

## Supporting references

`QĐ-78`, `QĐ-79`, audit 31/10/2026.

## Explicit out of scope

AI trên mobile (BRD 6.4).

## Dependencies and blockers

Blocker: handoff và chính sách dữ liệu của bên AI.

## Ownership: module, data, API

Bên AI chốt khi thiết kế.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                                        | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ------------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-15-05 AC-1  | Happy path (chờ thiết kế)                                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-2  | Mỗi dòng dẫn request nguồn (chờ thiết kế)                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-3  | Chỉ hàng đợi của chính mình (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-4  | Không dữ liệu thô (chờ thiết kế)                                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-5  | AI không quyết (chờ thiết kế)                                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-6  | AI tắt hoặc lỗi: hàng đợi chạy như cũ (chờ thiết kế)                                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-7  | Dòng thiếu nguồn hoặc ngoài hàng đợi không hiển thị (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-8  | Người duyệt chi: chỉ các Access Request đang chờ chính mình duyệt (chờ thiết kế)           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-9  | Vai khác không có tính năng (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-10 | Chỉ trên web (chờ thiết kế)                                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-11 | Chỉ dữ liệu giả lập tới khi chốt `OQ-26` (chờ thiết kế)                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-12 | Dòng lỗi thời không hiển thị (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-13 | Người duyệt chi: không gồm gia hạn, hợp thức hóa hay toàn bộ hộp quyết định (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-14 | Người giữ cả hai vai: chỉ bước đang thực sự giao (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-05 AC-15 | Người duyệt chi: không dữ liệu tài chính toàn công ty (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-1  | Happy path (chờ thiết kế)                                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-2  | Mỗi con số truy về số liệu đã dùng (chờ thiết kế)                                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-3  | Con số không khớp số liệu backend (chờ thiết kế)                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-4  | AI không tính tiền, không kết luận vi phạm (chờ thiết kế)                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-5  | Finance xem và sửa; bản nháp không tự phát hành (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-6  | AI tắt hoặc lỗi: phát hành như cũ (chờ thiết kế)                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-7  | Chỉ Finance; chỉ dữ liệu Finance được thấy (chờ thiết kế)                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-8  | Số liệu đổi sau khi soạn (chờ thiết kế)                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-9  | Chỉ trên web (chờ thiết kế)                                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-10 | Chỉ dữ liệu giả lập tới khi chốt `OQ-26` (chờ thiết kế)                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-11 | Báo cáo đã phát hành không đổi (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-15-06 AC-12 | Lời diễn giải đã phát hành chỉ trong bản của Finance và Người duyệt chi (chờ thiết kế)     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G10 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
