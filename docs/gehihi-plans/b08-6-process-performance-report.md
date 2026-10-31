# B08-6 — Báo cáo hiệu quả quy trình

| Gói  | Hạng mục                        | AC                | Loại     | Cổng vào |
| ---- | ------------------------------- | ----------------- | -------- | -------- |
| B-08 | `g8-process-performance-report` | `US-12-06` AC-1→8 | `DESIGN` | P00 xong |

Chỉ đọc, không phụ thuộc hóa đơn, nên làm xen được khi B-07 đang chờ quyết định. Lượt đầu chỉ thiết kế.

## Đọc trước

- `US-12-06` trong `../docs/BE-UserStory/src/EP-12.md`
- `src/modules/requests/timing/`, `src/modules/requests/sla/`
- `src/modules/requests/README.md`
- `US-05-10` về đo thời gian từng bước

## Quy tắc nghiệp vụ

- `KPI-2` dùng **trung vị** toàn trình gửi → tác vụ cấp hoàn tất, kèm trung vị thời gian duyệt và thời gian cấp (`QĐ-82k`).
- Thời gian Finance phản hồi đo **riêng** (AC-2).
- Tỷ lệ bước quá SLA: 6 trên 40 là 15%.
- Nhánh (a) chỉ tính phần mềm nội bộ (AC-4).
- Bảng nghẽn: số lần xác định lại, số bước giao người thay thế (AC-5).
- `KPI-4`: đúng định nghĩa ở AC-6, đọc nguyên văn. Cần dữ liệu thuê bao và quyết định gia hạn; vế quyết định phụ thuộc A-06.
- Quyền: trưởng phòng chỉ Request nhân viên phòng mình, không bảng nghẽn; Finance bị từ chối (AC-7).
- Nháp khi phòng chưa có Cost Center không vào `KPI-2` (AC-8).

## Thiết kế phải trả lời

- Đặt trong `requests`, cạnh `timing`, `sla`, vì dữ liệu thuộc module này. Capability mới `process-report/`; không import ngược.
- Tính trung vị ở SQL (`percentile_cont`) hay trong code; có biên, không tải toàn bộ bảng vào bộ nhớ.
- Định nghĩa kỳ, múi giờ, ngày nghiệp vụ.
- `OQ-F-17`: bản tóm tắt của Người duyệt chi chưa có AC, không chặn; ghi là ngoài phạm vi.
- Vế `KPI-4` chờ A-06 hiển thị thế nào; không suy 0.

## Test phải có trong matrix

Dùng đúng số AC. Thêm trung vị với số phần tử chẵn, kỳ không có dữ liệu trả _chưa có dữ liệu_ thay vì 0.

## Đầu ra

Cập nhật spec, plan. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
