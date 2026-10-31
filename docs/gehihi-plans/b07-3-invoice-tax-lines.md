# B07-3 — Sửa dòng thuế và cờ mặc định

| Gói  | Hạng mục               | AC                                                    | Loại   | Cổng vào   |
| ---- | ---------------------- | ----------------------------------------------------- | ------ | ---------- |
| B-07 | `g8-invoice-recording` | `US-12-10` AC-2, AC-3, AC-11; `US-12-09` AC-5, Task 4 | `CODE` | B07-2 xong |

## Đọc trước

- `US-12-10` trong `../docs/BE-UserStory/src/EP-12.md`, kể cả phần _Alternative/error flows_
- `src/modules/catalog/vendor/`, route `/vendors/{id}/tax-profile`
- `FinanceApi.taxProfileOf`

## Các bước

### 1. Cờ mặc định, AC-2

Spec đề xuất `GET /vendors/{id}/tax-defaults`. **Kiểm trước:** nếu `GET /vendors/{id}/tax-profile` đã trả từng dòng kèm cờ
`deductible` và `FINANCE` đọc được, thì **không thêm route**, chỉ thêm test và sửa spec. Chỉ thêm route mới khi route cũ không
đáp ứng, và đặt cạnh route cũ.

Dù cách nào: chỉ đọc gợi ý, không tạo dòng nào, hồ sơ thiếu thì trả theo mặc định có nhãn như `US-12-09` AC-8.

### 2. Sửa dòng, AC-3

`src/modules/budgets/invoice/invoice-tax-line.service.ts`, route `PUT /invoices/{id}/tax-lines/{position}`,
`@RequireRoles('FINANCE')`. Tạo mới khi vị trí chưa có, thay khi đã có.

Transaction: khóa hàng hóa đơn → đọc dòng cũ → quy đổi lại nếu số tiền hoặc tiền tệ đổi → ghi → **tính lại `costReportingMinor`,
`deductibleVatReportingMinor` của mọi dòng hóa đơn** bằng `invoiceCostOf` và `splitAcrossLines` → audit `INVOICE.TAX_LINE_CHANGED` kèm
`before`, `after`.

- Tỷ giá dòng sửa theo quy tắc D2 đã chốt ở B07-2. Với gợi ý ngày hóa đơn thì ngày tỷ giá không đổi khi sửa.
- Hệ thống không tự đổi cờ.

### 3. Sửa sau khi đã khớp cam kết (F-07)

Không chặn thao tác này: nguồn cho phép và yêu cầu số thực chi theo dòng thuế mới. Audit đã giữ trước/sau.

Vì `spent` tính từ `cost_reporting_minor`, chỉ cần tính lại dòng là thực chi tự đúng. `realized_minor` không đổi. Ca đã khớp được test ở
B07-8.

## Test

| AC               | Tình huống                                                  | Tầng        | Đáp án                                              |
| ---------------- | ----------------------------------------------------------- | ----------- | --------------------------------------------------- |
| `US-12-10` AC-2  | Hồ sơ `T2`, đọc cờ                                          | HTTP + unit | GTGT `true`, TNDN `false`, không tạo dòng           |
| `US-12-10` AC-3  | Đổi cờ GTGT thành không, hóa đơn 1.000 + GTGT 100 + TNDN 50 | integration | Chi phí thực chịu tăng đúng 100; audit có trước/sau |
| `US-12-10` AC-11 | Bốn vai không phải Finance gọi PUT                          | HTTP        | 403, hóa đơn không đổi                              |
| `US-12-09` AC-5  | Đổi tỷ lệ hồ sơ sau khi đã ghi hóa đơn                      | integration | Dòng thuế đã ghi không đổi                          |
| Hóa đơn không có | PUT vào id không tồn tại                                    | integration | `INVOICE.NOT_FOUND`                                 |
| Vị trí sai       | `position` âm hoặc quá giới hạn                             | HTTP        | 422                                                 |
| Chi phí dòng     | Hóa đơn hai dòng, đổi cờ một dòng thuế                      | integration | Tổng chi phí các dòng bằng chi phí thực chịu mới    |

## Verify

```powershell
pnpm test:http -- test/http/budgets
pnpm test:integration -- test/integration/budgets
pnpm check
pnpm openapi:export
pnpm arch:routes
```

## Xong khi

Bảng test xanh. `US-12-09` AC-5 có bằng chứng; ghi vào spec của `g3-downstream-finance-integration` rằng vế này đã phủ, không
đổi trạng thái khung đó.
