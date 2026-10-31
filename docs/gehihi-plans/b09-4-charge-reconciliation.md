# B09-4 — Đối soát từng khoản chi

| Gói  | Hạng mục                   | AC                                                                     | Loại     | Cổng vào          |
| ---- | -------------------------- | ---------------------------------------------------------------------- | -------- | ----------------- |
| B-09 | `g9-charge-reconciliation` | `US-13-07` AC-1→20; `US-12-10` AC-12; `US-06-06` AC-8; `US-05-09` AC-7 | `DESIGN` | B09-1, B07-8 xong |

Khó nhất của G9, chạm trực tiếp công thức tiền. Lượt đầu chỉ thiết kế, nên dùng model mạnh hơn hoặc người review kỹ.

## Quy tắc tiền, không được sai

- **Trừ một lần (F-20).** `US-06-06` AC-8: ngân sách 100tr, thực chi 30tr, `K1` giữ 21tr, còn lại 49tr. Sao kê 21tr khớp `K1`, chưa hóa
  đơn: thực chi **51tr**, `K1` vẫn `HELD`, còn lại vẫn **49tr**, không phải 28tr. Công thức `total − held − spent` hiện tại sẽ ra 28tr.
  Theo `QĐ-83a`(4): tính là thực chi và phần cam kết đang giữ đưa vào phép tính giảm tương ứng. Dùng hai số của contract ở B09-0, không sửa
  `released` hay `realized`.
- **Không đếm hai lần với hóa đơn.** Sao kê 1.200 tham chiếu hóa đơn đã nhập: thực chi 1.200 một lần (AC-9).
- **Phần chưa giải thích vẫn là thực chi** (AC-12): dòng 300, hóa đơn giải thích 200, 100 còn lại đi theo căn cứ.
- Có căn cứ thuê bao: vào Cost Center phòng sở hữu; không căn cứ: dòng _Chưa phân bổ_, ngoại lệ mở (AC-13, AC-14).
- Chỉ **hóa đơn** chuyển `K1` thành chi phí; sao kê không đổi trạng thái (AC-2).
- Phí thẻ/chênh lệch tỷ giá Finance đánh dấu thì vào chi phí thực chịu của hóa đơn (`US-12-10` AC-12): dùng `markedFeeReportingMinor` đã
  để sẵn ở `invoice-cost.policy` (F-19). Không đánh dấu thì 50 USD đi `US-12-12`. IT Admin đánh dấu bị từ chối.
- Khác tiền tệ, ngoài thời hạn, nhiều căn cứ: ngoại lệ, không quy đổi, không đoán (AC-3, AC-4).

## Quyền và luồng

- Chỉ Người duyệt chi quyết ngoại lệ; người giữ thẻ là `C1` thì giao `C2`, ghi _xung đột lợi ích_ (AC-5, AC-19).
- Một khoản không kéo theo khoản khác (AC-6).
- Import lại không thêm dòng, không mở ngoại lệ mới (AC-7).
- Lỗi tính tiền không sinh `Discrepancy` (AC-8, AC-18); hóa đơn có `Discrepancy` mở thì chỉ hiển thị (AC-16).
- Phân bổ tay đủ số; thiếu, vượt, sai vai bị từ chối; sửa bằng hủy có lý do (AC-10).
- `reconciliation_status` của hóa đơn cập nhật **ở đây** theo phân bổ sao kê (F-08).
- SLA bước quyết không dừng khi hỏi Finance (AC-11); nhắc theo `US-05-09` AC-7, tính vào tỷ lệ quá SLA loại bước khoản chi, không vào
  `KPI-2`, `KPI-4`.
- Hóa đơn đến sau báo cáo đã phát hành: đối soát lại **chỉ khoản đó** (AC-17).

## Thiết kế phải trả lời

- Kết quả B09-0: nguồn thực chi của sao kê đi vào `budgets` bằng cách nào.
- Danh sách trạng thái của một dòng sao kê, chứng minh mỗi dòng đúng một đường.
- Công thức `còn lại` mới, viết thành hàm thuần, test bằng bảng ví dụ AC-8.
- `statement_invoice_allocations`, `spend_exceptions`, Inventory 7.113, 7.114.
- Thứ tự khóa so với B07-8.
- `Discrepancy` phụ thuộc Q-05: đọc trạng thái mở thế nào.

## Đầu ra

Cập nhật spec, plan, test matrix đủ 20 AC. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
