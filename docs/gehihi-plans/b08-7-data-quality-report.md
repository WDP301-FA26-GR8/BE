# B08-7 — Báo cáo chất lượng dữ liệu

| Gói  | Hạng mục                 | AC                | Loại     | Cổng vào                    |
| ---- | ------------------------ | ----------------- | -------- | --------------------------- |
| B-08 | `g8-data-quality-report` | `US-12-07` AC-1→8 | `DESIGN` | B08-2 xong; vế usage chờ G7 |

Lượt đầu chỉ thiết kế.

## Tách phần

| Làm được                                                      | Chờ G7, phải hiện lý do thiếu dữ liệu |
| ------------------------------------------------------------- | ------------------------------------- |
| AC-3 `KPI-1`: 420 ÷ 500 = 84%, cần chi tiêu quan sát từ G8/G9 | AC-1, AC-6 `KPI-5` từ khuyến nghị     |
| AC-5 không con số mục tiêu                                    | AC-4 độ mới nguồn usage               |
| AC-7 tỷ lệ thuê bao thiếu hạn chót báo hủy, 3 ÷ 40            | AC-8 trạng thái bộ thu thập, thiết bị |

**Không suy 0 khi thiếu dữ liệu.** AC-6: chưa có khuyến nghị thì hiện _chưa đánh giá được_. AC-8: chưa có thiết bị thì đúng câu trong AC.

## Quyền

Super Admin thấy `KPI-5`; IT Admin xem báo cáo nhưng không thấy `KPI-5`; trưởng phòng, Finance, Người duyệt chi bị từ chối (AC-2).

## Thiết kế phải trả lời

- Module đặt ở đâu: `KPI-1` cần số liệu tài chính nên gần `budgets`; quyền là của Super Admin, IT Admin.
- Contract chờ G7: trả trạng thái `NOT_AVAILABLE` kèm lý do, giống cách `onboarding` đang làm ở bước 5. Không tạo bảng giả.
- `KPI-1` phụ thuộc G9: trước khi có sao kê, mẫu số lấy từ đâu; hiện lý do nếu chưa đủ.

## Đầu ra

Cập nhật spec, plan, test matrix có cả ca thiếu dữ liệu. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
