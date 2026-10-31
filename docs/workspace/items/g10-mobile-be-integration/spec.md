# Spec: khung — Kiểm tích hợp bốn tác vụ Mobile với BE

- Phụ trách: Dev A (A-07, A-08, A-09); khung do Dev B lập cho scope map.
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G10 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: A-07→A-09 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Bốn tác vụ Mobile có operation mapping và test BE đúng người giữ bước, cùng kết quả như web.

## Sizing decision

- Container: G10 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Bốn tác vụ Mobile có operation mapping và test BE đúng người giữ bước, cùng kết quả như web.
- Boundaries: Hạng mục khung: A tách khi nhận; không viết app native.
- Not larger: Giữ chỗ cho AC đã ánh xạ.
- Not smaller: A chốt ranh giới khi thiết kế.
- Siblings: `g10-approval-api-gaps`.
- Scope map: [G10](../../../roadmap.md#work-item-decomposition-g10).

## Size exception

- Cohesion: Khung giữ chỗ cho một đầu việc kiểm tích hợp Mobile do một người phụ trách nhận trọn.
- Why not split: Bốn khung riêng chỉ lặp cùng một đầu việc chưa thiết kế; người nhận tách theo Story khi thiết kế.
- Checkpoints: Không có phase; khung tách thành hạng mục theo Story trước khi code.
- Maximum scope: Chỉ AC ở bảng Primary; không thêm AC, không code trên khung này.
- Accepted by: AI theo giao việc của Dev B, 31/10/2026 — chờ Owner xác nhận, chưa phải Owner duyệt.

## Primary Story/AC

| Story    | AC        | Coverage | Phần còn lại thuộc                                 |
| -------- | --------- | -------- | -------------------------------------------------- |
| US-16-01 | AC-1→AC-8 | full     | —                                                  |
| US-16-04 | AC-1→AC-7 | full     | —                                                  |
| US-16-02 | AC-1→AC-9 | partial  | AC-9 (vế API): `g10-approval-api-gaps`             |
| US-16-03 | AC-1→AC-9 | partial  | AC-1, AC-2, AC-4 (vế API): `g10-approval-api-gaps` |

## Supporting references

DEV-A A-07→A-09; `QĐ-61a`→`QĐ-61h`, `QĐ-66o`.

## Explicit out of scope

UI native, push, offline, biometrics.

## Dependencies and blockers

A tiếp quản; cần `g10-approval-api-gaps`.

## Ownership: module, data, API

A chốt khi thiết kế.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)                                                | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | ---------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-16-01 AC-1 | Xem phần mềm của mình (chờ thiết kế)                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-01 AC-2 | Xem yêu cầu và trạng thái (chờ thiết kế)                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-01 AC-3 | Chỉ dữ liệu của mình (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-01 AC-4 | Lý do nghiệp vụ bắt buộc như web (chờ thiết kế)                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-01 AC-5 | Gửi giống hệt web (chờ thiết kế)                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-01 AC-6 | Rút trên mobile theo cùng điều kiện (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-01 AC-7 | Không có trên mobile (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-01 AC-8 | Phạm vi yêu cầu đơn giản (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-04 AC-1 | Đăng nhập cùng quy tắc với web (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-04 AC-2 | Hộp thông báo đúng người, đúng nội dung (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-04 AC-3 | Không push (chờ thiết kế)                                                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-04 AC-4 | Mất mạng: không thao tác, không lưu tạm (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-04 AC-5 | Vai quản trị: không chức năng quản trị, không tự có tác vụ Employee (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-04 AC-6 | Không vai mới, không bỏ SoD (chờ thiết kế)                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-04 AC-7 | Không biometrics, không tải tệp (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-1 | Duyệt trên mobile (chờ thiết kế)                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-2 | Từ chối cần lý do (chờ thiết kế)                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-3 | Hàng đợi chỉ phòng mình (chờ thiết kế)                                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-4 | Lý do nghiệp vụ và quy tắc thời hạn như web (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-5 | Không tự duyệt (chờ thiết kế)                                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-6 | Bước đã được quyết ở nơi khác hoặc không còn thuộc tôi (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-7 | Đúng một tác vụ trên mobile (chờ thiết kế)                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-8 | Cùng bản ghi phê duyệt điện tử (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-02 AC-9 | Dòng kế hoạch trên mobile (chờ thiết kế)                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-1 | Snapshot chỉ đọc trên mobile (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-2 | Duyệt hoặc từ chối cùng quy tắc (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-3 | Chỉ Người duyệt chi quyết (chờ thiết kế)                                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-4 | Bước nhu cầu của yêu cầu trưởng phòng tự gửi (chờ thiết kế)                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-5 | Hàng đợi chỉ có hai loại việc này (chờ thiết kế)                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-6 | Không tự duyệt (chờ thiết kế)                                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-7 | Bước đã được quyết ở nơi khác thì bị từ chối (chờ thiết kế)                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-8 | Không hỏi Finance và không quyết chỉ-web (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-16-03 AC-9 | Cùng bản ghi phê duyệt điện tử (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G10 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
