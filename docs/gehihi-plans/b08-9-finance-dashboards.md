# B08-9 — Trang tổng quan Finance và Người duyệt chi

| Gói  | Hạng mục                | AC                    | Loại     | Cổng vào                                  |
| ---- | ----------------------- | --------------------- | -------- | ----------------------------------------- |
| B-08 | `g8-finance-dashboards` | `US-12-15` AC-5, AC-6 | `DESIGN` | B08-2 xong; chốt ranh giới với A-10, A-06 |

Lượt đầu chỉ thiết kế. Dashboard vận hành Employee, Manager, IT, Super Admin thuộc A-10. B cấp phép tính tiền qua contract.

## AC-5, trang Finance

Hiện ngân sách · thực chi · cam kết · còn lại theo Cost Center và phòng; hóa đơn chờ đối soát; chênh lệch do thuế/tỷ giá; khoản cam
kết chưa gắn ngân sách; đề xuất ngân sách chờ rà soát; Request chờ Finance rà soát; yêu cầu thông tin ngân sách chờ trả lời.

**Không có** mục _cam kết chờ ghi nhận_ (`QĐ-82m` B). Không có thao tác duyệt hay từ chối Request.

## AC-6, trang Người duyệt chi

Lô và yêu cầu chờ duyệt chi; phiên bản ngân sách chờ duyệt; đề xuất gia hạn/giảm/hủy; tổng quan ngân sách · cam kết · thực chi; tổng
chi và tiết kiệm.

## Bẫy phụ thuộc

- Trang cần cả dữ liệu `budgets` lẫn `requests`. `budgets` **không** import được `requests`, nên read model tổng hợp phải đặt ở
  `requests` (`requests → budgets` được phép), hoặc là hai endpoint riêng. Chốt trong spec.
- Queue đã có, chỉ đọc số đếm: `finance-review`, `spend-submission`, `spend-approval`. Không viết lại.
- _Hóa đơn chờ đối soát_ theo `reconciliation_status`, cần G9 mới có nghĩa (F-08). Trước đó hiện lý do.
- _Đề xuất gia hạn_ chờ A-06. _Tiết kiệm_ chờ B08-8. Hiện thiếu dữ liệu, không hiện 0.

## Thiết kế phải trả lời

- Contract tiền cho phần Manager của A-10: hàm nào, trường nào; trưởng phòng không có _còn lại_.
- Số câu lệnh có biên.
- Finance chỉ một người nhưng vai đọc từ PostgreSQL mỗi request.

## Đầu ra

Cập nhật spec, plan, bảng từng mục → nguồn dữ liệu → trạng thái sẵn có. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
