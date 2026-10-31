# B08-2 — Bảng tổng chi bốn con số

| Gói  | Hạng mục           | AC                 | Loại     | Cổng vào           |
| ---- | ------------------ | ------------------ | -------- | ------------------ |
| B-08 | `g8-spend-summary` | `US-12-01` AC-1→13 | `DESIGN` | B08-1, B07-10 xong |

Read model, không ghi dữ liệu. Lượt đầu chỉ thiết kế.

## Quy tắc nghiệp vụ

- Bốn số: ngân sách, thực chi, cam kết đang giữ, còn lại. GTGT được khấu trừ ở cột riêng, **không** vào thực chi.
- `còn lại = ngân sách − thực chi − cam kết đang giữ`. Có thể âm, hiện âm kèm nhãn.
- Chưa có ngân sách hiện _Chưa có ngân sách_, không hiện 0 (`FR-5.8a`).
- Thực chi gồm hóa đơn, chi phí nội bộ, phần sao kê chưa được hóa đơn giải thích.
- Cấp công ty = tổng các phòng + dòng _Chưa phân bổ Cost Center_; không có Cost Center `Company`.
- Không có chiều dự án, không doanh thu, không ROI.
- Chữ _thời gian thực_ không được dùng; ghi thời điểm cập nhật (AC-13).

## Quyền

| Vai                      | Thấy                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Finance, Người duyệt chi | Toàn công ty, mọi chiều gom                                                            |
| Trưởng phòng             | Thực chi + cam kết của phòng mình, theo ứng dụng/nhà cung cấp, dòng phiên bản đã duyệt |
| IT Admin, Super Admin    | Từ chối                                                                                |

Trưởng phòng **không** thấy _còn lại_, kết quả kiểm tra ngân sách, tổng công ty, phòng khác. Hết giai đoạn trưởng phòng thì mất quyền.

## Thiết kế phải trả lời

- Route và tham số: kỳ (tháng, quý, năm), `basis` (`CASH`, `ACCRUAL`), `groupBy` (`COST_CENTER`, `DEPARTMENT`, `APPLICATION`, `VENDOR`).
- Hai biến thể DTO theo vai, để trường cấm không có mặt, thay vì để null.
- Phép tính có biên: số câu lệnh không tăng theo số dòng; nêu cách phân trang khi gom.
- Theo kỳ của hóa đơn năm: AC-2, 12.000 USD chia mỗi tháng 1.000 USD; dùng `service_period_*`, hóa đơn thiếu kỳ dịch vụ thì sao.
- Nối chi phí seat từ B08-1.
- AC-5 truy căn cứ: endpoint con liệt kê hóa đơn, khoản nội bộ, phần phân bổ tạo nên con số.
- AC-8 cần `g8-unallocated-cost-line`. Trước khi có, trả dòng này bằng 0 hay ẩn; không được làm số tổng sai về sau.
- Credit note của B07-9 đã làm `spent` giảm ở kỳ ghi; bảng này phải hiện đúng số đó.
- Đặt ở `budgets/spend-summary/`. `budgets` không đọc được `requests`; nếu cần dữ liệu Request thì xin qua public API của tầng dưới
  hoặc đặt phần đó ở `requests`.

## Test phải có trong matrix

| AC        | Đáp án                                                                                |
| --------- | ------------------------------------------------------------------------------------- |
| AC-1      | 100tr · 40tr · 20tr · còn lại 40tr; GTGT 3tr tách riêng                               |
| AC-2      | Tháng 1 ghi 12.000 khi theo dòng tiền; mỗi tháng 1.000 khi theo kỳ                    |
| AC-7      | `H1` không có trường `remaining`, không dữ liệu `P-ENG`; hết giai đoạn thì bị từ chối |
| AC-9      | Dòng thẻ 10tr được hóa đơn 10tr giải thích: thực chi tăng 10tr, không phải 20tr       |
| AC-10     | `K1` 21tr đã thành chi phí: không còn ở cam kết, tổng không gấp đôi                   |
| AC-11     | 105tr = 100tr + 5tr chưa phân bổ, gom theo phòng thì 5tr không thuộc phòng nào        |
| Đối chiếu | Tổng các dòng bằng số công ty; đọc hai lần cùng kết quả                               |

## Đầu ra

Cập nhật spec, plan. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
