# Bộ plan B: đã xong và chưa xong

Cập nhật 03/11/2026, đối chiếu `plan.md` của từng hạng mục với git. Đây là ảnh chụp để Dev B theo dõi, không thay roadmap hay
`plan.md`. Chưa có plan nào được Owner review hay `accepted`.

**Tóm lại:** 32 plan. Xong local 13, đang làm 1 (B07-10), chưa làm 18.

Git: commit `1f91c5a` (P00 → B07-8 và sổ prompt) đã push lên `origin/hien-dev`. Code B07-10 chưa commit. Chưa merge
`origin/dev`.

## Đã xong local

| Plan                | Hạng mục                              | Tình trạng          | Cần lưu ý                                                                                                                                   |
| ------------------- | ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| P00                 | Dựng môi trường và chốt mốc           | Đã chạy 31/10       | Không có mục riêng như plan yêu cầu, kết quả gộp vào bảng B05. Bảng ghi Node 22, máy chạy Node 24.13                                        |
| P01                 | Áp sửa thiết kế vào spec              | Xong 31/10          | Spec đã áp F-04, F-07, F-12→F-15, F-17, F-19, F-23. Người phụ trách chưa duyệt                                                              |
| B05-1, B05-2        | `g4-request-and-transfer-integration` | Xong 31/10 (Gemini) | Dòng Triển khai vẫn ghi `not-started`. Test `provisioning-quota-after-spend` vẫn ghi chờ PostgreSQL, dù đã pass trong 1.132 test `requests` |
| B10-1               | `g10-approval-api-gaps`               | Xong 31/10          | Vế hàng đợi `US-16-03` AC-4 chặn ở Q-11. `dev` đã có B-01→B-04, merge xong thì mở lại                                                       |
| B07-1 → B07-5       | `g8-invoice-recording`                | Xong, có bằng chứng | B07-4 chưa đánh dấu ô tự review diff. Bằng chứng B07-5 chỉ ở note 02. `plan.md:139` vẫn ghi chưa báo Dev A (Q-10)                           |
| B07-6, B07-7, B07-8 | `g8-commitment-realization`           | Xong 02–03/11       | Thiếu test F-06 và ca tổng hợp B07-7. Nhãn model DeepSeek-V3 cần xác nhận                                                                   |

## Đang làm

| Plan   | Hạng mục                 | Tình trạng                                                                     | Còn thiếu                                                                                                                                                                          |
| ------ | ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B07-10 | `g8-internal-cost-entry` | Thiết kế và audit xong (`review-02.md`, F-01→F-06). Code có, **chưa verified** | 5 test HTTP `platform` đỏ (manifest, message, 422/429 của 4 route mới); 43 lỗi ESLint/Prettier; chưa chạy integration; thiếu ca khóa, rollback, AC-8b, AC-10. Chi tiết ở `plan.md` |

Kiểm lại 03/11/2026: typecheck, arch, unit 513, gates 317, HTTP `internal-costs` 27 đều xanh.

## Chưa làm

B07-9 (lỗi một phần và credit note): plan code, chưa bắt đầu. Đóng `US-06-06` AC-9, AC-11.

16 plan thiết kế còn là khung `plan.md` 39 dòng:

| Gói  | Plan                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| B-07 | B07-11 (cơ sở thực chi khi lỗi), B07-12 (khớp hóa đơn với thuê bao)            |
| B-08 | B08-1, B08-2, B08-3, B08-4, B08-5, B08-6, B08-7, B08-9                         |
| B-09 | B09-0 (chọn nơi đặt module G9, chưa có ADR), B09-1, B09-2, B09-3, B09-4, B09-5 |

B08-8 (tiết kiệm và hiệu quả sử dụng): `GATED`, chờ G7 và A-06.

Cổng còn chờ người khác:

| Plan          | Đang chờ                                                                               |
| ------------- | -------------------------------------------------------------------------------------- |
| B07-11, B09-1 | Dev A trả lời Q-10                                                                     |
| B08-5, B08-9  | A-06, A-10                                                                             |
| B08-7         | Vế usage chờ G7                                                                        |
| B08-6         | Owner xác nhận pin Docs mới có `QĐ-93`; bản đó bỏ chỉ số "số bước giao người thay thế" |
| B09-5         | Ca `OOS-24` phải hỏi Owner trước khi code                                              |

## Thứ tự tiếp theo

1. Sửa cho xanh B07-10 (prompt ở `promtingByHien.md` mục 5), bật Docker chạy integration, rồi commit.
2. Merge `origin/dev`: 9 file conflict, đổi import `budget-support.service` và các service `-lookup` theo tên mới, gồm cả
   `CatalogApi.lockApplicationShared` của B07-10.
3. B07-9.
4. B09-0, rồi B08-1 → B08-2.
