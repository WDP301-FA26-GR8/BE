# Spec: khung — Quyết định và thực hiện gia hạn, giảm, hủy thuê bao

- Phụ trách: Dev A (A-06); khung do Dev B lập cho scope map.
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: A-06 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Thuê bao đến kỳ có cảnh báo, đề xuất, quyết định của Người duyệt chi và kết quả thực hiện; kỳ mới nối chuỗi.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `grouped-stories`.
- Outcome and owner: Thuê bao đến kỳ có cảnh báo, đề xuất, quyết định của Người duyệt chi và kết quả thực hiện; kỳ mới nối chuỗi.
- Boundaries: Hạng mục khung: A tách theo Story khi nhận; B chỉ tiêu thụ kết quả qua contract.
- Not larger: Giữ chỗ cho AC đã ánh xạ, không thêm AC.
- Not smaller: A chốt ranh giới khi thiết kế.
- Siblings: `g8-savings-report`, `g8-forecast`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Size exception

- Cohesion: Khung giữ chỗ cho một vòng đời kỳ gia hạn thuê bao do một người phụ trách nhận trọn.
- Why not split: Tách năm khung lúc này chỉ lặp cùng một đầu việc chưa thiết kế; người nhận tách theo Story khi thiết kế.
- Checkpoints: Không có phase; khung tách thành hạng mục theo Story trước khi code.
- Maximum scope: Chỉ AC ở bảng Primary; không thêm AC, không code trên khung này.
- Accepted by: AI theo giao việc của Dev B, 31/10/2026 — chờ Owner xác nhận, chưa phải Owner duyệt.

## Primary Story/AC

| Story    | AC                      | Coverage | Phần còn lại thuộc |
| -------- | ----------------------- | -------- | ------------------ |
| US-11-01 | AC-1→AC-14              | full     | —                  |
| US-11-02 | AC-1→AC-7, AC-9→AC-22   | full     | —                  |
| US-11-03 | AC-1→AC-10, AC-12→AC-21 | full     | —                  |
| US-11-04 | AC-1→AC-13              | full     | —                  |
| US-11-05 | AC-1→AC-18              | full     | —                  |

## Supporting references

DEV-A A-06; DEV-B mục phối hợp.

## Explicit out of scope

Gia hạn quyền cá nhân (đã có ở G5/G6).

## Dependencies and blockers

A tiếp quản. B cần event/contract kết quả gia hạn trước `g8-savings-report` và AC-5, AC-7 của `g8-forecast`.

## Ownership: module, data, API

A chốt khi thiết kế.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                                            | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ---------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-11-01 AC-1  | Tính từ hạn chót báo hủy (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-2  | Không tính từ ngày gia hạn (chờ thiết kế)                                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-3  | Kèm khuyến nghị (chờ thiết kế)                                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-4  | Hạn chót suy ra (chờ thiết kế)                                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-5  | Không hạn chót, không báo trước, không tự gia hạn ⟹ theo ngày kết thúc (chờ thiết kế)          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-6  | Thiếu dữ liệu, tự gia hạn ⟹ không đoán (chờ thiết kế)                                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-7  | Cấu hình mốc (chờ thiết kế)                                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-8  | Bỏ mốc 7 ngày khi đã quyết và đã thực hiện (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-9  | Chỉ thuê bao có thời hạn (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-10 | Business Owner đã nghỉ không nhận (chờ thiết kế)                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-11 | Người không thuộc danh sách không nhận (chờ thiết kế)                                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-12 | Kênh (chờ thiết kế)                                                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-13 | Không gửi trùng (chờ thiết kế)                                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-01 AC-14 | Kỳ thiếu cả bốn dữ liệu mốc (chờ thiết kế)                                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-1  | Giảm số lượng (chờ thiết kế)                                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-2  | Hủy kiểm tra quyền (chờ thiết kế)                                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-3  | Gia hạn nguyên trạng (chờ thiết kế)                                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-4  | Snapshot theo chi phí thực chịu (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-5  | Chưa có ngân sách (chờ thiết kế)                                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-6  | Không phải Người duyệt chi thì không quyết (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-7  | Hỏi Finance không dừng SLA và không chặn (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-9  | Không tạo khoản cam kết (chờ thiết kế)                                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-10 | Quyết sau hạn chót không bị hủy (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-11 | Quá SLA chỉ nhắc, không phải sự cố (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-12 | Chỉ trên web (chờ thiết kế)                                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-13 | Giảm dưới số Assignment: nêu phần vượt trước khi lưu (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-14 | Bản ghi phê duyệt điện tử và Audit Trail (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-15 | Chỉ thuê bao có thời hạn (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-16 | Chỉ tệp của hồ sơ đang quyết (chờ thiết kế)                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-17 | Người duyệt chi không thực hiện (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-18 | Chưa có đề xuất của IT Admin (BRD 4.6 dòng Gia hạn) (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-19 | Hủy hoặc gia hạn nguyên ghi sau hạn chót (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-20 | Người duyệt chi chọn seat phải thu hồi khi giảm (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-21 | Phương án gia hạn nhiều kỳ: lịch và dự báo theo năm, không cam kết (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-02 AC-22 | Thuê bao của phòng chưa có Cost Center: theo tác động tài chính (chờ thiết kế)                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-1  | Không sửa đè (chờ thiết kế)                                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-2  | Chuyển Assignment nối chuỗi (chờ thiết kế)                                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-3  | Tiết kiệm thật (chờ thiết kế)                                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-4  | Chuỗi đơn (chờ thiết kế)                                                                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-5  | Phần vượt thu hồi trước, kỳ mới chưa ghi (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-6  | Phần vượt là các seat Người duyệt chi đã chọn (chờ thiết kế)                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-7  | Ca chồng lấn khi giảm: trưởng phòng xác nhận, một tác vụ (chờ thiết kế)                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-8  | Seat khác của đợt giảm vẫn IT Admin (chờ thiết kế)                                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-9  | Hủy toàn bộ: không tạo kỳ mới (chờ thiết kế)                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-10 | Hủy toàn bộ: IT Admin xác nhận bàn giao cho seat không có quyết định ghost seat (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-12 | Thu hồi thất bại thì kỳ mới chưa ghi (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-13 | Thực hiện trễ (chờ thiết kế)                                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-14 | Đã ghi kết quả thì không cờ (chờ thiết kế)                                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-15 | Kết quả thực tế khác quyết định (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-16 | Tiết kiệm chỉ khi chi phí thật sự giảm (chờ thiết kế)                                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-17 | Không tạo khoản cam kết (chờ thiết kế)                                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-18 | Nhà cung cấp gia hạn khác quyết định: ghi kỳ theo thực tế (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-19 | Ghost seat chồng lấn với hủy toàn bộ: một tác vụ, trưởng phòng xác nhận (chờ thiết kế)         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-20 | Phần vượt chưa thu hồi xong khi tới hạn chót (chờ thiết kế)                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-03 AC-21 | Tiết kiệm so theo tổng chi phí kỳ (chờ thiết kế)                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-1  | Sự cố tự gia hạn, không quyết định (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-2  | Có quyết định thì không sự cố (chờ thiết kế)                                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-3  | Quá SLA không phải sự cố (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-4  | Không tự gia hạn ⟹ hết hạn, không phải sự cố (chờ thiết kế)                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-5  | Thiếu dữ liệu không đoán (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-6  | Một sự cố mỗi kỳ (chờ thiết kế)                                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-7  | Quyết định đến sau sự cố (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-8  | Chỉ thuê bao có thời hạn (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-9  | Hệ thống không tự gia hạn hay hủy (chờ thiết kế)                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-10 | Kỳ mới sau sự cố tự gia hạn (chờ thiết kế)                                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-11 | Hết hạn không gia hạn xử lý như hủy toàn bộ (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-12 | Gia hạn được thực hiện khi tác vụ thu hồi chưa xong: chỉ bỏ lý do hết hạn (chờ thiết kế)       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-04 AC-13 | Còn lý do khác hoặc đã thu hồi xong (chờ thiết kế)                                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-1  | Thiếu dữ liệu hạn chót ⟹ chờ bổ sung (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-2  | Rà checklist điều khoản (chờ thiết kế)                                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-3  | Ý kiến Business Owner không chặn (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-4  | Dữ liệu sử dụng không đủ (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-5  | Lập đề xuất giảm số lượng (chờ thiết kế)                                                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-6  | Lập đề xuất hủy (chờ thiết kế)                                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-7  | IT Admin không quyết (chờ thiết kế)                                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-8  | Chỉ IT Admin lập đề xuất và ghi ý kiến (chờ thiết kế)                                          | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-9  | Thu hồi phần vượt trước, kết quả bị chặn khi còn vượt (chờ thiết kế)                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-10 | Thực hiện ngoài hệ thống (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-11 | Ghi kết quả đúng quyết định (chờ thiết kế)                                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-12 | Kết quả khác quyết định (chờ thiết kế)                                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-13 | Quyết định ghi sau hạn chót: điểm thực hiện (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-14 | Ghi kết quả sau hạn chót vẫn được (chờ thiết kế)                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-15 | Không có việc gia hạn cho mục không có thời hạn (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-16 | Chứng từ `BM-05` của hồ sơ (chờ thiết kế)                                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-17 | Chưa lập đề xuất thì không có mục để quyết (BRD 4.6 dòng Gia hạn) (chờ thiết kế)               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-11-05 AC-18 | Ghi kỳ mới sau sự cố tự gia hạn (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
