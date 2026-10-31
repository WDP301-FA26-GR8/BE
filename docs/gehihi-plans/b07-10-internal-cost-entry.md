# B07-10 — Chi phí phần mềm nội bộ

| Gói  | Hạng mục                 | AC                    | Loại     | Cổng vào   |
| ---- | ------------------------ | --------------------- | -------- | ---------- |
| B-07 | `g8-internal-cost-entry` | `US-12-11` AC-1→AC-11 | `DESIGN` | B07-7 xong |

Lượt đầu: viết thiết kế vào spec và plan của hạng mục, **không code**, dừng. Lượt sau mới code theo thiết kế đã được đọc.

## Nguồn

- `US-12-11` trong `../docs/BE-UserStory/src/EP-12.md`
- `../docs/ERD/logical/LOGICAL-ERD-INVENTORY.md` mục 7.106; `LOGICAL-ERD.md` thực thể `InternalCostEntry`
- Mẫu: `g8-invoice-recording/spec.md`, capability `budgets/invoice/`

## Thiết kế phải trả lời

| Chủ đề                | Câu hỏi cần chốt trong spec                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vị trí                | `budgets/internal-cost/`; repo tổng hợp cho `spent` đặt trong lõi `budget/`, tránh vòng capability                                                                              |
| Phần mềm nội bộ       | AC-5: Figma bị từ chối. Đọc loại ứng dụng qua `CatalogApi`; thiếu hàm thì thêm mới, báo A                                                                                       |
| Cost Center           | AC-6 không tồn tại thì từ chối; chỉ `Unit`; đọc qua `OrganizationApi.costCentersByIds`, `lockCostCentersShared` nếu cần giữ khi ghi                                             |
| Tiền                  | AC-7: `FinanceApi.snapshotMoney`, thiếu tỷ giá từ chối                                                                                                                          |
| Sửa sai               | `OQ-F-10` theo `LD-11`: hủy có lý do rồi ghi lại, lịch sử ở audit, cột `cancelled_at`, `cancel_reason`                                                                          |
| Vào `spent`           | Cộng vào đúng hàm của B07-7, đọc qua lõi `budget/`. Khoản đã hủy không tính                                                                                                     |
| Khoản dài             | AC-11: kỳ dài hơn kỳ báo cáo chia đều theo thời gian ở cơ sở _theo kỳ_. Với `spent` theo năm tài chính, khoản vắt hai năm tính thế nào; đề xuất chia theo ngày, ghi rõ để audit |
| Quyền                 | AC-8: chỉ `FINANCE`; không sinh bước duyệt                                                                                                                                      |
| Không có              | AC-3: không có trường tỷ lệ, không có API phân bổ. Mỗi khoản đúng một Cost Center                                                                                               |
| Không hóa đơn         | AC-1: không tạo hóa đơn, thuê bao, nhà cung cấp, cam kết                                                                                                                        |
| Kỳ đã phát hành       | AC-10: không khóa. Phần _điều chỉnh kỳ trước_ thuộc `g8-period-close-report`                                                                                                    |
| Đọc phía trưởng phòng | AC-9: thấy trong thực chi của phòng, không thấy _còn lại_. Phần hiển thị thuộc `g8-spend-summary`, ở đây chỉ bảo đảm dữ liệu                                                    |

## Đầu ra

1. `spec.md`: thay các mục `Ownership`, `Behavior and design`, `Test matrix`. Mỗi AC ít nhất một dòng test có đáp án cụ thể. Trạng
   thái thiết kế giữ `draft`.
2. `plan.md`: task theo mẫu, migration là task riêng đứng trước. Mỗi task có Files, Depends on, Acceptance, Verify.
3. Danh sách câu hỏi còn thiếu, không tự chốt.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```

## Xong khi

Người phụ trách có thể đọc spec và biết chính xác route, bảng, lỗi, test. Chưa có file source nào đổi.
