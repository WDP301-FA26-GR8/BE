# B09-2 — Bản ghi cần xem xét theo nhà cung cấp

| Gói  | Hạng mục                | AC                 | Loại     | Cổng vào   |
| ---- | ----------------------- | ------------------ | -------- | ---------- |
| B-09 | `g9-discovery-findings` | `US-13-03` AC-1→10 | `DESIGN` | B09-1 xong |

Lượt đầu chỉ thiết kế.

## Quy tắc nghiệp vụ

| Tình huống                           | Kết quả                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| Nhà cung cấp ngoài danh mục, lần đầu | Tạo bản ghi _cần xem xét_, nhãn _không phải kết luận vi phạm_ |
| Đang mở, thêm khoản chi              | Không tạo mới; cập nhật lần thấy, số lần xuất hiện            |
| Đã đóng _báo nhầm_, xuất hiện lại    | Mở lại                                                        |
| Đã đóng _không duyệt_, xuất hiện lại | Chính bản đó mở lại, cờ _tái xuất hiện_, nâng rủi ro          |
| Đã đóng _đã duyệt_, xuất hiện lại    | Không mở, không tạo; khoản chi đi đường đối soát              |
| Đã trong danh mục                    | Không tạo; ngoại lệ thuộc khoản chi (AC-8)                    |
| Mở 90 ngày                           | Vẫn mở, không tự đóng                                         |

- Tầng rủi ro chỉ từ dữ liệu IT đã ghi, không suy từ tên; thiếu thì _chưa đủ thông tin_ (AC-9).
- Chỉ Người duyệt chi đóng (AC-10, `SoD-6`).
- `INV-13`: tối đa một bản ghi mở mỗi nhà cung cấp. Phải có unique index một phần ở DB, không chỉ check-then-insert.

## Thiết kế phải trả lời

- Chạy trong transaction xác nhận lô hay bước sau; đua hai lô cùng nhà cung cấp.
- Định danh nhà cung cấp chưa có trong danh mục: khóa nào.
- Hàng đợi đọc cho IT Admin; không có nhãn _vi phạm_ ở đâu.

## Đầu ra

Cập nhật spec, plan, test matrix đủ 10 AC. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
