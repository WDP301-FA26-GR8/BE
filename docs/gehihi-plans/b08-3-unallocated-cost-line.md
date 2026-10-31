# B08-3 — Dòng Chưa phân bổ Cost Center

| Gói  | Hạng mục                   | AC                 | Loại     | Cổng vào          |
| ---- | -------------------------- | ------------------ | -------- | ----------------- |
| B-08 | `g8-unallocated-cost-line` | `US-12-12` AC-1→11 | `DESIGN` | B09-4, B08-2 xong |

Phụ thuộc `statement_lines`. Lượt đầu chỉ thiết kế.

## Quy tắc nghiệp vụ

- Dòng này nằm trong thực chi, **không** thuộc Cost Center nào, không có bản ghi trong danh mục Cost Center.
- Không chọn được làm đích của chi phí nội bộ hay phân bổ tay; không có ngân sách riêng.
- Ngoại lệ vẫn mở tới khi Người duyệt chi xử lý. Finance không đóng và không gán Cost Center (AC-7, AC-8).
- Khớp thuê bao: cả khoản vào Cost Center của phòng sở hữu. Khớp khoản cam kết: vào Cost Center của Request, khoản cam kết vẫn
  `HELD` (AC-3).
- Hóa đơn đến sau: rời dòng này, tính theo hóa đơn, không đếm hai lần; báo cáo đã phát hành giữ nguyên (AC-9).
- Trưởng phòng không thấy (AC-10).
- Sau quyết định của Người duyệt chi theo `QĐ-66z`, `QĐ-90f` (AC-11): đọc nguyên văn AC trước khi thiết kế.

## Thiết kế phải trả lời

- Module đặt theo kết quả B09-0.
- Một hàm duy nhất trả phần chưa phân bổ của kỳ, để `spend-summary` và `period-close` dùng chung.
- Hai nguồn vào dòng này: sao kê chưa căn cứ, và chi phí của phòng thiếu Cost Center từ B08-1. Có cùng lý do hiển thị không.

## Đầu ra

Cập nhật spec, plan, test matrix gồm đủ 11 AC. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
