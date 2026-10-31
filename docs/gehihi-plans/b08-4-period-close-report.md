# B08-4 — Khép kỳ và báo cáo bất biến

| Gói  | Hạng mục                 | AC                                                   | Loại     | Cổng vào   |
| ---- | ------------------------ | ---------------------------------------------------- | -------- | ---------- |
| B-08 | `g8-period-close-report` | `US-12-14` AC-1→17; `US-12-10` AC-9; `US-12-09` AC-9 | `DESIGN` | B08-2 xong |

Lượt đầu chỉ thiết kế. `US-12-09` AC-9 đang ở `g3-downstream-finance-integration`, chuyển chủ khi thiết kế.

## Quy tắc nghiệp vụ

- Finance phát hành một lần cho một kỳ; **không phát hành lại** (`QĐ-66ab`). Sửa sai hiện ở kỳ sau nhãn _điều chỉnh kỳ trước_ kèm kỳ gốc.
- **Không khóa kỳ** (AC-10): vẫn ghi hóa đơn, khoản nội bộ, sửa ngân sách năm chưa hết. Không có thao tác mở khóa.
- Bản chụp bất biến. Hóa đơn mới, sửa thuế, phiên bản ngân sách mới không đổi báo cáo đã phát hành (AC-8).
- Không bước duyệt: Finance bấm là phát hành, Người duyệt chi không có thao tác chặn (AC-11).
- Theo vai: Người duyệt chi thấy toàn công ty; trưởng phòng chỉ thực chi và cam kết của phòng (AC-7). Lời diễn giải chỉ trong bản của
  Finance và Người duyệt chi (AC-17).
- Giải phóng phần dư có lý do lúc khép kỳ, lý do vào bản chụp và audit (AC-2). Dùng lại `planRemainder` và đường `releaseRemainder`.
- Thêm khoản nội bộ ngay trong bước khép kỳ (AC-3): gọi service của B07-10.
- `CC-NEW` hiện _Chưa có ngân sách_, âm hiện kèm nhãn _đã cam kết vượt hạn mức_ (AC-13).
- Ngoại lệ đang mở được chụp ở trạng thái lúc phát hành (AC-14).
- AI ngoài phạm vi: chỉ làm vế AI tắt hoặc lỗi, Finance viết tay hoặc phát hành không diễn giải (AC-12).

## Thiết kế phải trả lời

- `budgets/cost-report/`; bảng `cost_reports`, `cost_report_lines` theo Inventory 7.107, 7.108, đối chiếu `LOGICAL-ERD-MAPPING.md`.
- Trigger `cost_reports_immutable`, chặn update, delete; lines cũng vậy.
- Khóa `(organization_id, period_start, period_end)` theo `LD-10`, không chọn trước tháng hay quý. Cấm phát hành kỳ chồng lấn với kỳ đã
  phát hành, để một khoản không xuất hiện ở hai báo cáo; ràng buộc phải có ở DB. Ghi vào spec để audit.
- Hai request phát hành đồng thời: một thắng, một lỗi rõ ràng.
- Cách nhận biết khoản đến muộn: ghi sau `published_at` nhưng thuộc kỳ đã phát hành, tính tất định.
- Một transaction lớn: giữ khóa gì, thời gian, không `Promise.all` trên `tx`.
- Bản đọc theo vai, không rò `accepted_narrative`.
- `requests` có dữ liệu cần chụp không; `budgets` không import được `requests`.

## Test phải có trong matrix

Đủ 17 AC; thêm phát hành đồng thời, ghi hóa đơn sau phát hành rồi đọc lại báo cáo cũ, phát hành kỳ sau thấy điều chỉnh.

## Đầu ra

Cập nhật spec, plan. Migration là task riêng. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
