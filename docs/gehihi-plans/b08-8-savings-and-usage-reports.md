# B08-8 — Báo cáo tiết kiệm và hiệu suất sử dụng

| Gói  | Hạng mục                                          | AC                                    | Loại    | Cổng vào                                                |
| ---- | ------------------------------------------------- | ------------------------------------- | ------- | ------------------------------------------------------- |
| B-08 | `g8-savings-report`, `g8-usage-efficiency-report` | `US-12-04` AC-1→8; `US-12-05` AC-1→14 | `GATED` | B08-2 xong; contract G7 của Owner; kết quả gia hạn A-06 |

**Chưa bắt đầu.** Hai báo cáo tiêu thụ bằng chứng của người khác. B chỉ tính tiền, không làm engine phát hiện không dùng, không thu
thập usage.

## Điều kiện mở

- Owner bàn giao public contract: khuyến nghị đã thực hiện, usage, coverage.
- A-06 bàn giao sự kiện kết quả gia hạn.

Thiếu contract thì không dựng dữ liệu giả, không mock rồi claim xong.

## Ràng buộc khi mở cổng

- **Không suy 0 usage từ ngày thiếu dữ liệu.** Vendor handoff chỉ có bằng chứng dương.
- Tiết kiệm thực hiện ngay và tại kỳ gia hạn **tách riêng**, không có số tổng ở bất kỳ đâu (`US-12-04` AC-1).
- Không suy tiết kiệm từ quyết định chưa thi hành.
- Thu hồi seat không tự thêm tiền nếu hóa đơn chưa giảm (AC-6).
- Ghi số thực tế, không số ước tính của khuyến nghị (AC-3).
- Không có khuyến nghị thì hiện 0 kèm giải thích (AC-7).
- Quyền: trưởng phòng, Super Admin bị từ chối; Finance, IT Admin, Người duyệt chi xem được.
- `OQ-F-05`: IT Admin xem mọi phòng hay phòng mình; `OQ-F-17`: bản tóm tắt.

## Việc làm được sớm

Thiết kế read model, không code, nếu người phụ trách muốn sẵn sàng trước. Ghi rõ phụ thuộc, không đổi trạng thái `blocked`.
