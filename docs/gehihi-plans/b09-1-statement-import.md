# B09-1 — Import sao kê CSV

| Gói  | Hạng mục              | AC                                   | Loại     | Cổng vào                    |
| ---- | --------------------- | ------------------------------------ | -------- | --------------------------- |
| B-09 | `g9-statement-import` | `US-13-01` AC-1→13; `US-04-04` AC-11 | `DESIGN` | Q-08 chốt; B07-2 xong; Q-10 |

Lượt đầu chỉ thiết kế. Đọc nguyên văn 13 AC trong `../docs/BE-UserStory/src/EP-13.md`.

## Đọc trước

- `src/modules/data-import/README.md`, khung `employee-import/`: upload → preview → xác nhận
- `src/core/` phần CSV
- Inventory 7.110, 7.111, 7.112
- `contract.policy.ts`: `COST_STATEMENT` có trong `PURPOSE_ROLES` nhưng `assertPurposeAvailable` đang từ chối

## Quy tắc nghiệp vụ

- Hủy ở xem trước không ghi gì (AC-7): không dòng giao dịch, mục review, bản ghi phát hiện.
- Chỉ CSV và mã hóa hỗ trợ, không đoán mã hóa; XLSX và UTF-16 không BOM bị từ chối cả tệp (AC-8).
- Tin cậy xác định từ phương pháp khớp, không từ mô hình (AC-3): _khớp theo mẫu_ → Khá; khớp mờ → Trung bình và vào review.
- Tên nhà cung cấp phải ở vị trí bên nhận tiền: `UDEMY *FIGMA UI UX MASTERCLASS` không thành Figma (AC-5).
- Văn bản chỉ dẫn trong mô tả, có dấu hay không dấu, là đáng ngờ, vào review `SUSPICIOUS_TEXT` (AC-6). Đây là chống prompt injection
  ở dữ liệu nhập, phải có test.
- `MICROSOFT*` không tự chọn dòng dịch vụ (AC-12, `QĐ-38`).
- Hoàn tiền `-45.00` là bối cảnh, không tạo phát hiện (AC-11).
- Mục review không bao giờ bị xóa, mỗi dòng đúng một đường (AC-10).
- IT Admin xác nhận nhà cung cấp rồi đối soát lại đúng dòng đó (AC-9).
- Tệp mang mục đích `COST_STATEMENT`, giữ 24 tháng (AC-13).
- Quyền: Finance import; trưởng phòng bị từ chối (AC-4).

## Thiết kế phải trả lời

- `line_fingerprint` để import lại đúng tệp không thêm dòng (`US-13-07` AC-7).
- Một transaction cho xác nhận lô; lô lớn thì giới hạn cỡ và cách xử lý.
- Dùng lại khung `data-import` được tới đâu; `data-import` là T5.
- Mở `COST_STATEMENT` ở `contract.policy.ts`, cần thêm `statement_import_id` và đổi CHECK như B07-5. Vùng A, thống nhất Q-10.
- Không dùng AI để phân loại (`QĐ-69`).
- Không dùng mẫu CSV ngân hàng thật (`QĐ-32c`). Test dùng dữ liệu giả.

## Đầu ra

Cập nhật spec, plan, test matrix đủ 13 AC, có ca CSV lỗi, trùng, chạy lại. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
