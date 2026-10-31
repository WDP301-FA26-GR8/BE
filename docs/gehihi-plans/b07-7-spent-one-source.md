# B07-7 — Thực chi tính từ hóa đơn

| Gói  | Hạng mục                    | AC                                               | Loại   | Cổng vào   |
| ---- | --------------------------- | ------------------------------------------------ | ------ | ---------- |
| B-07 | `g8-commitment-realization` | `US-06-09` AC-12; hỗ trợ `US-06-06` AC-1, Task 3 | `CODE` | B07-6 xong |

## Thiết kế (F-03, F-04, F-05, F-06)

```text
spent(Cost Center, năm)        = tổng invoice_lines.cost_reporting_minor
deductibleVat(Cost Center, năm) = tổng invoice_lines.deductible_vat_reporting_minor
held(Cost Center, năm)         = như B07-6
còn lại                        = ngân sách − spent − held
```

Căn cứ: `FR-5.4` thực chi tính từ hóa đơn; `FR-5.3` hóa đơn vào Cost Center tại ngày hóa đơn; `QĐ-82l`(1) còn lại dùng dòng tiền cộng cam kết.

Dòng có `cost_center_id` null là _Chưa phân bổ_, không vào `spent` của Cost Center nào.

## Đọc trước

- `CommitmentRepo.totals`, `heldKey`
- `src/modules/budgets/budget/budget-facts.repo.ts`
- `src/modules/budgets/budget-view/budget-view.service.ts`, dòng tính `remaining`; `budget.dto.ts`, trường `spent`
- `src/modules/requests/spend/budget-check.policy.ts`
- `test/support/spend-harness.ts`

## Các bước

1. Viết test đỏ trước ở `test/integration/budgets/commitment-totals.integration-spec.ts`.

2. Tạo `src/modules/budgets/budget/invoice-spend.repo.ts` trong **lõi** `budget/`, không ở `invoice/`: hàm nhóm `invoice_lines` theo
   `costCenterId`, `fiscalYear` cho danh sách cặp, nhận `tx` tùy chọn. Bảng thuộc `budgets` nên lõi đọc trực tiếp.

3. `CommitmentRepo.totals()` đọc `held` như B07-6, rồi gọi repo trên, tuần tự, không `Promise.all` trên `tx`. Bỏ nhánh tính `spent`
   từ `EXPENSED`. `CommitmentTotals` thêm `deductibleVat`.

4. Không thêm hàm thứ hai tính `spent`. `BudgetFactsRepo`, `BudgetViewService` đều đọc `totals()`.

5. `BudgetViewService`: thêm `deductibleVat` vào bảng, là trường mới, cạnh `spent`, không trừ vào _còn lại_ (`US-06-09` AC-12).
   Cập nhật comment của `totals()`: câu "A commitment is one or the other, never both" không còn đúng.

6. Cập nhật `test/support/spend-harness.ts` (F-05): `spec.spent` và `commit(..., 'EXPENSED')` ghi thêm một hóa đơn với một dòng có
   `cost_center_id`, `fiscal_year`, `cost_reporting_minor = amount`. Không đổi kỳ vọng của test dùng harness. Phải đổi kỳ vọng thì dừng.

7. Đối chiếu mọi nơi đọc `spentMinor`: `requests/spend/budget-check.policy.ts`, `requests/finance-review/spend-years-view.service.ts`.
   Các nơi này đọc qua `yearFacts` hoặc từ snapshot đã lưu. Không sửa nếu kết quả đúng.

## Test

| Tình huống                                                            | Đáp án                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| Hóa đơn chưa khớp 10tr, `CC-A`, năm 2026                              | `spent` 10tr, _còn lại_ giảm 10tr                    |
| Hai dòng hai Cost Center trong một hóa đơn                            | Mỗi Cost Center nhận đúng phần của mình              |
| Dòng `cost_center_id` null                                            | Không vào `spent` của Cost Center nào                |
| Năm tài chính khác nhau                                               | Chỉ tính đúng năm                                    |
| `US-06-09` AC-12: giá 20, GTGT 2 khấu trừ, nộp thay 1                 | `spent` 21, `deductibleVat` 2, _còn lại_ chỉ giảm 21 |
| F-06: khoản thành chi phí trước khi có ngân sách, rồi ngân sách duyệt | `spent` đủ, `held` 0, không lỗi trigger              |
| `K` 21tr, realized 13, hóa đơn 13                                     | `held` 8, `spent` 13                                 |
| Khoản `RELEASED`                                                      | Không ảnh hưởng `spent`                              |
| Hồi quy `US-06-01`, `US-06-12`: snapshot kiểm tra ngân sách           | Kết quả như mốc P00                                  |

## Verify

```powershell
pnpm test:integration -- test/integration/budgets
pnpm test:integration -- test/integration/requests --maxWorkers=4
pnpm check
pnpm openapi:export
pnpm arch:capabilities --module budgets
```

## Xong khi

`git diff` cho thấy một nguồn `spent` duy nhất. `arch:capabilities` không có vòng và lõi `budget/` không import capability nào.
`US-06-09` AC-12 có bằng chứng; ghi vào spec `g3-downstream-finance-integration`, không đổi trạng thái khung đó.
