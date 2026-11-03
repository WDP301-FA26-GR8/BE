# B07-8 — Finance khớp dòng hóa đơn với khoản cam kết

| Gói  | Hạng mục                    | AC                                                   | Loại   | Cổng vào                                     |
| ---- | --------------------------- | ---------------------------------------------------- | ------ | -------------------------------------------- |
| B-07 | `g8-commitment-realization` | `US-06-06` AC-1, AC-5; `US-12-02` AC-4, AC-8, Task 4 | `CODE` | B07-7 xong; D5, D5a, D6 tạm theo khuyến nghị |

Plan viết theo khuyến nghị ở `02-owner-decisions.md`, Owner ủy quyền dùng tạm ngày 01/11/2026: Finance chọn theo dòng, số tiền tự tính, từ
chối khác nhà cung cấp và khác năm, không có hủy khớp. Owner đổi khi review thì **dừng**, sửa spec và plan này trước.

## Đọc trước

- Spec hạng mục sau P01; F-07→F-11, F-21, F-22, F-24
- `budget-year-lock.repo.ts`, `public/budget-year-lock-key.policy.ts`
- `public/budgets.extension-points.ts`: `CommitmentReleaseGuardHook` làm mẫu hook
- `src/modules/requests/spend/commitment-release.listener.ts` làm mẫu bind
- `CommitmentService.releaseRemainder`, mẫu giữ khóa rồi kiểm
- `test/gates/extension-wiring.gate-spec.ts`, `test/support/concurrency-harness.ts`

## Operation

| Operation                                               | Vai       | Mục đích                            |
| ------------------------------------------------------- | --------- | ----------------------------------- |
| `POST /invoices/{id}/lines/{position}/commitment-match` | `FINANCE` | Khớp một dòng vào một khoản         |
| `GET /invoices/{id}/commitment-matches`                 | `FINANCE` | Các lần khớp của hóa đơn            |
| `POST /invoices`, thêm `commitmentId?` ở dòng           | `FINANCE` | Khớp ngay khi ghi, cùng transaction |

Body route đầu: `{ commitmentId }`. **Không có trường số tiền.**

## Lỗi (409)

`INVOICE_MATCH.INVOICE_NOT_MATCHABLE`, `INVOICE_MATCH.COMMITMENT_NOT_HELD`, `INVOICE_MATCH.YEAR_MISMATCH`,
`INVOICE_MATCH.VENDOR_MISMATCH`, `INVOICE_MATCH.LINE_ALREADY_MATCHED`.

## Các bước

### 1. Policy, test trước

`src/modules/budgets/invoice/invoice-match.policy.ts`, hàm thuần:

| Điều kiện, xét theo thứ tự                                  | Kết quả                 |
| ----------------------------------------------------------- | ----------------------- |
| Hóa đơn là `CREDIT_NOTE` hoặc `costReportingMinor` ≤ 0      | `INVOICE_NOT_MATCHABLE` |
| Dòng đã khớp                                                | `LINE_ALREADY_MATCHED`  |
| Khoản không `HELD`                                          | `COMMITMENT_NOT_HELD`   |
| `line.fiscalYear !== commitment.year`                       | `YEAR_MISMATCH`         |
| Nhà cung cấp của khoản đã biết và khác nhà cung cấp hóa đơn | `VENDOR_MISMATCH`       |

Số khớp = `min(line.costReportingMinor, heldOf(commitment))`. Phần vượt vẫn là thực chi và không mở khoản mới.

### 2. Hook nhà cung cấp (F-22)

`public/budgets.extension-points.ts`: thêm `CommitmentVendorHook` trả nhà cung cấp theo `requestId`. Chưa bind thì ném lỗi, theo mẫu guard.

`src/modules/requests/spend/commitment-vendor.listener.ts`: đọc `planId` của Request, gọi `CatalogApi.getPlanVendorId`. Request không có
gói trả null, tức không kiểm được; ghi audit, không chặn. Khai `static binds`. Không thêm cạnh module mới.

### 3. Repo

Trong lõi `budget/commitment.repo.ts`:

- `realize(tx, row, { takeMinor, invoiceLineId, employeeId, now })`: ghi `commitment_realizations`, tăng `realized_minor` bằng
  `updateMany` có điều kiện lạc quan như `release`; hết giữ thì `state = 'EXPENSED'`.
- `lockOfRequest(tx, requestId)`: `SELECT ... WHERE request_id = $1 ORDER BY year FOR UPDATE`, trả như `ofRequest`.

Trong `invoice/invoice.repo.ts`: khóa hàng hóa đơn, đọc dòng, đặt `cost_center_id` cho dòng còn null.

### 4. Sửa đường nhả (F-11)

`CommitmentService.release`: đổi `ofRequest` thành `lockOfRequest`, để `release` đợi `realize` và tính trên số mới, không ném lỗi 500. `releaseRemainder` đã khóa hàng, không đổi.

### 5. Service

`src/modules/budgets/invoice/invoice-match.service.ts`, transaction, thứ tự khóa:

1. Hàng hóa đơn.
2. Đọc không khóa Cost Center và năm của khoản (hai giá trị này bất biến nhờ trigger guard), rồi lấy khóa năm ngân sách
   (`BudgetYearLockRepo`).
3. Hàng khoản cam kết bằng `lockById`, sau đó mới đọc số dư để quyết định.

Rồi hook → policy → `realize` → đặt Cost Center cho dòng → audit `BUDGET_COMMITMENT.REALIZED` với `requestId`, `year`, `invoiceId`,
`position`, `amountMinor`, `heldMinor`.

- Dòng `cost_center_id` null nhận Cost Center của khoản (F-21). Dòng đã có Cost Center khác khoản: giữ nguyên, audit ghi cả hai, không từ chối.
- Không đổi `reconciliation_status` (F-08).
- Sửa thuế sau khớp không đổi `realized` (F-07).
- `invoice/` import lõi `budget/`. Không để `commitment/` import `invoice/`.

Comment đầu service ghi thứ tự khóa. Cập nhật mục _Bất biến quan trọng_ của `src/modules/budgets/README.md`.

### 6. Khớp ngay khi ghi (F-24)

`invoice.service.ts`: dòng có `commitmentId` thì gọi cùng logic trong transaction ghi. Nhiều khoản thì lấy khóa năm theo Cost Center rồi
năm tăng dần. Có lỗi thì không ghi gì.

Ghi vào spec: hóa đơn đã ghi nhưng chưa khớp làm _còn lại_ tạm thấp hơn tới khi khớp. Đây là phía an toàn; dùng `commitmentId` lúc ghi
thì không có khoảng này.

## Test

Integration, `test/integration/budgets/invoice-commitment-match.integration-spec.ts`. So số **trước khi ghi hóa đơn** với **sau khi khớp**:

| AC                | Tình huống                                                           | Đáp án                                                 |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| `US-06-06` AC-1   | `K1` 21; giá 20, GTGT 2 khấu trừ, nộp thay 1; ghi kèm `commitmentId` | `EXPENSED`; held −21, spent +21, còn lại không đổi     |
| F-24              | Cùng ca, ghi trước rồi khớp sau                                      | Trước khớp còn lại thấp hơn 21; sau khớp như hàng trên |
| `US-12-02` AC-4   | `K1` 20 khớp dòng chi phí 20                                         | `EXPENSED`                                             |
| `US-06-06` AC-5   | Hai hóa đơn 13 rồi 8                                                 | Sau đợt 1 `HELD` 8; sau đợt 2 `EXPENSED`, spent 21     |
| `US-12-02` AC-8   | 13 rồi 7 trên `K1` 20                                                | Không trừ hai lần                                      |
| `US-12-09` AC-9   | `K1` 21, chi phí thật 23                                             | realized 21, spent 23, `EXPENSED`                      |
| Chi phí thấp hơn  | `K1` 21, chi phí 18                                                  | `HELD` 3; Finance nhả phần dư sau                      |
| F-07              | Khớp 21 rồi đổi GTGT 2 thành không khấu trừ                          | spent 23, realized 21, audit trước/sau                 |
| F-21              | Dòng ngoài danh mục khớp `K1` của `CC-A`                             | Dòng nhận `CC-A`, `spent` của `CC-A` tăng              |
| Khớp lại          | Cùng dòng khớp lần hai                                               | `LINE_ALREADY_MATCHED`, số dư không đổi                |
| Khác nhà cung cấp | Khoản của nhà cung cấp khác                                          | `VENDOR_MISMATCH`, không audit                         |
| Khác năm          | Khoản năm khác                                                       | `YEAR_MISMATCH`, số dư không đổi                       |
| Khoản đã nhả      | Khoản `RELEASED`                                                     | `COMMITMENT_NOT_HELD`                                  |
| Credit note       | Khớp dòng credit note                                                | `INVOICE_NOT_MATCHABLE`                                |
| `US-06-06` AC-4   | Đưa `EXPENSED` về `HELD` bằng SQL                                    | Trigger từ chối                                        |

HTTP, `test/http/budgets/`: `IT_ADMIN`, `MANAGER`, `SPENDING_APPROVER` gọi POST bị 403; body sai 422.

Khóa, dùng `concurrency-harness.ts`: `realize` giữ khóa, `release` chạy song song, kiểm tuần tự, `released + realized ≤ amount`, không 500.

## Verify

```powershell
pnpm test -- src/modules/budgets
pnpm test:gates
pnpm test:http -- test/http/budgets
pnpm test:integration -- test/integration/budgets
pnpm test:integration -- test/integration/requests --maxWorkers=4
pnpm test:integration:serial
pnpm check
pnpm openapi:export
pnpm arch:routes
```

## Xong khi

Bốn AC có bằng chứng. Toàn bộ test `requests` khớp mốc, vì đường `release` đã đổi.
