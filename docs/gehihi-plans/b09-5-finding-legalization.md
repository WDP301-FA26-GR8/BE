# B09-5 — Quyết định hợp thức hóa

| Gói  | Hạng mục                  | AC                 | Loại     | Cổng vào          |
| ---- | ------------------------- | ------------------ | -------- | ----------------- |
| B-09 | `g9-finding-legalization` | `US-13-06` AC-1→21 | `DESIGN` | B09-3, B09-4 xong |

Làm cho mọi ca thường. Q-07 chỉ liên quan một ca `OOS-24`: Người duyệt chi là người dùng hoặc người trả của hồ sơ. `QĐ-66ag` ghi không đặt
người thay thế, và "không đặt ≠ cho phép tự duyệt". Không dẫn `US-06-08` cho ca này.

Q-07 tạm theo khuyến nghị, Owner ủy quyền 01/11/2026: API từ chối bằng mã riêng, hồ sơ giữ mở, ghi là giới hạn. Lượt đầu chỉ thiết kế.

## Quy tắc

- Ba kết cục duy nhất: _Báo nhầm_, _Không duyệt_, _Duyệt hợp thức hóa_. _Thay bằng công cụ đã có_ là _Không duyệt_ (AC-20).
- Chỉ Người duyệt chi quyết (AC-9). `IT1` thấy hồ sơ, không quyết; Audit Trail không ghi `IT1` là người quyết (AC-16).
- Đúng một bản ghi phê duyệt điện tử, có snapshot nếu có chi (AC-1). Không duyệt chi lần hai (AC-6).
- Thứ tự: chưa có quyết định thì không thêm danh mục, không ghi quyền (AC-5).
- Danh mục phải có gói, kiểu cấp, mô hình giá, mức kiểm soát, lưu ý trước khi thu hồi, Business Owner đang làm việc (AC-2, AC-7).
- Người dùng bằng email công ty có Assignment nguồn _hợp thức hóa_, không xin lại (AC-3). Tài khoản cá nhân không thành Assignment (AC-4),
  được cấp lại trên tài khoản công ty (AC-19).
- Số seat do Người duyệt chi nêu; ít hơn số người dùng thì chọn người được giữ (AC-18).
- Không duyệt: không tự thu hồi; `IT1` có việc, IT xác nhận bàn giao (AC-10, AC-11). Thực hiện thu hồi thuộc `US-07-05`, đã có.
- Quyết định ghi vào **từng khoản chi** (AC-14).
- Không tự hợp thức hóa sau 90 ngày (AC-17).
- Hỏi Finance không dừng SLA, không chặn (AC-15).
- Mức kiểm soát không chặn (AC-13); `US-05-18` không áp.
- Phòng chưa có Cost Center: AC-21, đọc nguyên văn.

## Thiết kế phải trả lời

- Một giao dịch gồm ghi quyết định, `CatalogApi`, `LicensingApi`: facade nhận cùng `tx`. Thiếu hàm ghi thì thêm, thống nhất với A.
- Snapshot ngân sách dùng lại cơ chế `US-06-01`; `finding_decisions`, `finding_kept_users`, Inventory 7.118, 7.119.
- Thứ tự khóa so với cấp seat.

## Đầu ra

Cập nhật spec, plan, test matrix đủ 21 AC, ghi ca `OOS-24` theo Q-07 là giới hạn. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
