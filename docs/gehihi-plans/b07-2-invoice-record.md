# B07-2 — Ghi hóa đơn, chia chi phí và quy Cost Center

| Gói  | Hạng mục               | AC                                                                   | Loại   | Cổng vào                            |
| ---- | ---------------------- | -------------------------------------------------------------------- | ------ | ----------------------------------- |
| B-07 | `g8-invoice-recording` | `US-12-10` AC-1, 4, 6, 7, 10, 11 (vế ghi); `US-12-02` AC-9, Task 2+3 | `CODE` | B07-1 xong; **D2 có trả lời**; Q-13 |

## Đọc trước

- Spec và plan của hạng mục; `01-design-corrections.md` F-19, F-23
- `src/modules/finance/public/finance.api.ts`: `parseMoney`, `snapshotMoney`
- `src/modules/budgets/commitment/` làm mẫu service, controller, dto, audit
- `src/modules/budgets/budget/budget-support.service.ts`: `budgetAuditEvent`, `fiscalYearStartMonth`
- `src/modules/budgets/budgets.module.ts`
- `src/modules/catalog/public/catalog.api.ts`
- `src/modules/organization/public/organization-history.api.ts`
- Test mẫu: `test/http/finance/`, `test/integration/budgets/`
- AC: `../docs/BE-UserStory/src/EP-12.md`

## Không làm

Sửa dòng thuế (B07-3), đọc danh sách (B07-4), gắn tệp (B07-5), khớp cam kết (B07-8), import file (`OQ-F-03`), trạng thái
_đã thanh toán_. Chưa đổi `spent`; B07-7 mới đọc các cột này.

## Các bước

### 1. Policy, test trước

`src/modules/budgets/invoice/invoice-cost.policy.ts`, không dùng Nest hay Prisma.

Hàm `invoiceCostOf`, tính cho cả hóa đơn:

```ts
export interface InvoiceCostInput {
  kind: 'INVOICE' | 'CREDIT_NOTE';
  amountReportingMinor: bigint;
  taxLines: readonly { amountReportingMinor: bigint; deductible: boolean }[];
  /** Card fees and FX marked at reconciliation (`US-12-10` AC-12); zero until the statement slices exist. */
  markedFeeReportingMinor: bigint;
}
export interface InvoiceCost {
  effectiveCostMinor: bigint;
  deductibleVatMinor: bigint;
}
```

`effectiveCostMinor` = giá + thuế không khấu trừ + phí đã đánh dấu; `deductibleVatMinor` = tổng thuế khấu trừ. `CREDIT_NOTE` trả số âm.

Hàm `splitAcrossLines`, chia một tổng xuống các dòng theo tỷ lệ `amountMinor` của dòng (F-23):

- Lấy phần nguyên từng dòng, phần dư cộng lần lượt cho dòng có phần lẻ lớn nhất, hòa thì theo `position` tăng dần.
- Tổng kết quả **luôn bằng** tổng đầu vào, kể cả có dòng âm (giảm giá). Tổng `amountMinor` bằng 0 thì đặt hết vào dòng đầu.
- Dùng cho ba cột: `amountReportingMinor`, `costReportingMinor`, `deductibleVatReportingMinor` của dòng.

Việc chia theo số tiền dòng chỉ xảy ra trong một hóa đơn. Nó không phải chia chi phí thuê bao theo tỷ lệ giữa các phòng, thứ mà
`QĐ-89a` đã cấm.

Test: AC-4 (20tr, GTGT 2tr khấu trừ, nộp thay 1tr → 21tr và 2tr); AC-6 (không dòng thuế → bằng giá, GTGT 0); credit note âm;
chia 100 cho ba dòng bằng nhau → 34, 33, 33; có dòng âm; tổng dòng 0.

### 2. Lỗi

`invoice.errors.ts`, `invoice.http-errors.ts`:

| Mã                             | HTTP |
| ------------------------------ | ---- |
| `INVOICE.DUPLICATE`            | 409  |
| `INVOICE.NOT_FOUND`            | 404  |
| `INVOICE.RATE_MISSING`         | 409  |
| `INVOICE.VENDOR_UNUSABLE`      | 409  |
| `INVOICE.LINE_VENDOR_MISMATCH` | 409  |
| `INVOICE.LINES_DO_NOT_ADD_UP`  | 422  |

### 3. Hàm đọc mới từ module khác

Chỉ thêm, không sửa hàm cũ. Báo A phần `catalog` (Q-10).

- `CatalogApi`: tóm tắt thuê bao theo lô `{ id, vendorId, ownerDepartmentId }`, và kiểm nhà cung cấp còn dùng được. Tìm hàm có sẵn trước.
- `OrganizationHistoryApi`: Cost Center hiện hành của một phòng tại một ngày. Dùng `CostCenter.departmentId`, `linkedAt`,
  `deactivatedAt`; so theo ngày của tổ chức, xem `src/core/business-date`. Có unit test cho ngày liên kết, ngày ngừng, trước khi liên
  kết. Đây là việc ở `organization`, nên giữ hàm nhỏ và chỉ đọc.

### 4. Repo và service

`invoice.repo.ts`: toàn bộ SQL. Lỗi unique của Prisma đổi thành `INVOICE.DUPLICATE`.

`invoice.service.ts`, một transaction:

1. Kiểm nhà cung cấp; kiểm thuê bao của từng dòng tồn tại và **cùng nhà cung cấp** với hóa đơn.
2. Đọc tiền bằng `FinanceApi.parseMoney`. Tiền đầu hóa đơn âm từ chối bằng `VALIDATION_ERROR`; dòng được âm để ghi giảm giá.
3. Tổng `amountMinor` các dòng phải bằng đầu hóa đơn, sai thì `INVOICE.LINES_DO_NOT_ADD_UP`. Phải có ít nhất một dòng.
4. `snapshotMoney(tx, money, rateDate)` cho **đầu hóa đơn** và **từng dòng thuế**. Dòng thuế có thể khác tiền tệ.
   `MISSING_RATE` → `INVOICE.RATE_MISSING`, không ghi gì. `rateDate` theo D2.
5. Tính `invoiceCostOf`, rồi `splitAcrossLines` cho từng cột.
6. Với từng dòng: `fiscalYear = fiscalYearOf(invoiceDate, startMonth)`. Có thuê bao thì `costCenterId` = Cost Center của phòng sở hữu
   tại `invoiceDate`, không có thì null. Dòng `outOfCatalog` để null.
7. Ghi ba bảng, `reconciliationStatus = NONE`.
8. Audit `INVOICE.RECORDED` cùng transaction, loại tài nguyên `INVOICE`.

Không tự sinh dòng thuế từ hồ sơ thuế (AC-10). Không gọi `estimateTax` ở đường ghi.

Comment đầu service ghi thứ tự khóa: `organizations FOR SHARE` do `snapshotMoney` giữ tới commit.

### 5. HTTP

`invoice.dto.ts`, `invoices.controller.ts`: `POST /invoices`, `@RequireRoles('FINANCE')`. Body: `vendorId`, `contractId?`,
`invoiceNumber`, `invoiceDate`, `amount {amount, currency}`, `lines[]`, `taxLines[]`. Giới hạn số dòng trong schema.

Mỗi dòng bắt buộc chọn `subscriptionId` hoặc `outOfCatalog: true`.

Đăng ký vào `budgets.module.ts`. Thêm manifest API.

## Test

HTTP, `test/http/budgets/invoices.http-spec.ts` (thư mục mới):

| Ca                                                                 | Đáp án             |
| ------------------------------------------------------------------ | ------------------ |
| `IT_ADMIN`, `MANAGER`, `SPENDING_APPROVER`, `SUPER_ADMIN` gọi POST | 403, không bản ghi |
| Body thiếu trường, tiền đầu hóa đơn âm, dòng không chọn thuê bao   | 422                |

Kiểm tên vai thật trong code trước khi viết test.

Integration, `test/integration/budgets/invoice-recording.integration-spec.ts`:

| Ca                                                   | Đáp án                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| AC-1: 1.000 USD, GTGT 100, TNDN 50 nộp thay          | Mỗi dòng lưu loại, tỷ lệ, số tiền, bên nộp, cờ          |
| AC-7: hóa đơn USD, dòng thuế VND                     | Hai quy đổi riêng; đổi tỷ giá sau đó, đọc lại không đổi |
| Thiếu tỷ giá đúng ngày                               | `INVOICE.RATE_MISSING`, không hàng nào, không audit     |
| AC-10: hóa đơn `T2` không gửi dòng thuế              | 0 dòng thuế                                             |
| Tổng dòng lệch đầu hóa đơn                           | `INVOICE.LINES_DO_NOT_ADD_UP`                           |
| Dòng có thuê bao của nhà cung cấp khác               | `INVOICE.LINE_VENDOR_MISMATCH`                          |
| Hai dòng thuộc hai phòng, có thuế không khấu trừ     | Tổng `cost_reporting_minor` bằng chi phí thực chịu      |
| Dòng thuê bao, phòng có Cost Center tại ngày hóa đơn | `cost_center_id` đúng                                   |
| Hóa đơn ngày trước khi Cost Center được liên kết     | `cost_center_id` null                                   |
| Năm tài chính bắt đầu tháng 4, hóa đơn 15/02/2027    | `fiscal_year` 2026                                      |
| Lỗi giữa transaction ở dòng thuế                     | Không còn đầu hóa đơn, không audit                      |
| Hai request đồng thời cùng số hóa đơn                | Một thành công, một `INVOICE.DUPLICATE`, một audit      |

## Verify

```powershell
pnpm test -- src/modules/budgets/invoice
pnpm test -- src/modules/organization
pnpm test:http -- test/http/budgets
pnpm test:integration -- test/integration/budgets
pnpm check
pnpm openapi:export
pnpm arch:routes
```

## Xong khi

Bảng test xanh, `US-12-02` AC-9 và vế ghi của `US-12-10` AC-11 có bằng chứng, spec ghi D2 đã dùng giá trị nào.
