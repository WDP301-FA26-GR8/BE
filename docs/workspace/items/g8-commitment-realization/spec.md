# Spec: Hóa đơn khớp chuyển khoản cam kết thành chi phí, một phần hoặc toàn bộ

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — `US-06-06`, `US-12-02`; `FR-5.8`, `FR-5.13`, `OI-11a`, `QĐ-50c`, `QĐ-83a`, `QĐ-84g`; Logical ERD
  7.102, `LD-06`, `CERD5-12`, `CERD5-16`), BE `d6c2112`.
- Nhóm roadmap: G8 và G5 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/DEV-B.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance khớp hóa đơn đã ghi với một khoản cam kết; phần chi phí thực chịu rời _đang giữ_ sang _thực chi_ đúng một lần, khớp được nhiều
đợt, và _còn lại_ của ngân sách không đổi; kiểm được qua số dư khoản cam kết và kiểm tra ngân sách.

## Sizing decision

- Container: G8 và G5 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: khoản cam kết được thực hiện bằng hóa đơn và công thức thực chi có một nguồn; capability `budgets/commitment` và
  `budgets/invoice`.
- Boundaries: một transaction khớp trong `budgets`; bảng mới `commitment_realizations`; đổi nghĩa `spentMinor` của
  `BudgetsApi.yearFacts`; chỉ `FINANCE`.
- Not larger: căn cứ đã chi khi Request thất bại ngoài hóa đơn cần bảng `purchase_documents` và có đường kiểm chứng riêng
  (`g8-spend-basis-on-failure`); sao kê khớp cam kết thuộc `g9-charge-reconciliation`.
- Not smaller: công thức _đang giữ_ và nguồn _thực chi_ phải đổi cùng lúc với thao tác khớp, nếu không báo cáo đếm hai lần.
- Siblings: `g8-invoice-recording`, `g8-invoice-subscription-match`, `g8-spend-basis-on-failure`, `g9-charge-reconciliation`,
  `g5-commitment-lifecycle`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8), [G5](../../../roadmap.md#work-item-decomposition-g5).

## Primary Story/AC

| Story    | AC                      | Coverage | Phần còn lại thuộc                                                                                                            |
| -------- | ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| US-12-02 | AC-4, AC-8              | partial  | AC-1→AC-3, AC-5→AC-7: `g8-invoice-subscription-match`; AC-9: `g8-invoice-recording`                                           |
| US-06-06 | AC-1, AC-5, AC-9, AC-11 | partial  | AC-10, AC-12: `g8-spend-basis-on-failure`; AC-8: `g9-charge-reconciliation`; AC-2→AC-4, AC-6, AC-7: `g5-commitment-lifecycle` |

## Supporting references

`US-06-06` AC-4 (không quay ngược, hồi quy); `US-12-01` AC-9, AC-10, `US-06-09` AC-12 (đọc ở `g8-spend-summary`);
[ADR-0016](../../../decisions/0016-budgets-context.md).

## Explicit out of scope

- Khoản sao kê khớp cam kết và quy tắc trừ một lần của nó (`US-06-06` AC-8): `g9-charge-reconciliation`.
- Không giải phóng khi có chứng từ mua hoặc khi rút (`US-06-06` AC-10, AC-12; `US-07-04` AC-15; `US-05-08` AC-10):
  `g8-spend-basis-on-failure`.
- Giải phóng phần dư lúc khép kỳ (`US-12-14` AC-2): `g8-period-close-report`.

## Dependencies and blockers

- **Dependency:** `g8-invoice-recording` phải có trước.
- `budget_commitments` đã có trạng thái `EXPENSED` nhưng **chưa có đường ghi nào tới nó** (`CommitmentState`, không có câu lệnh ghi).
- Khoản cam kết năm tương lai và kỳ hủy được: F35 chưa chốt, không chặn lát này nhưng test không được giả định kỳ hủy được đã là dự báo.

## Ownership: module, data, API

- `budgets` sở hữu cả hóa đơn lẫn khoản cam kết, nên thao tác khớp là một service nội bộ, không cần extension point hay facade mới; thêm bảng
  `commitment_realizations` và cột `budget_commitments.realized_minor`.
- `requests` không đổi ở lát này: nó vẫn gọi `BudgetsApi.releaseForRequest`.
- Operation mới: `POST /invoices/{id}/lines/{position}/commitment-match` (`FINANCE`, khớp một dòng vào một khoản, body `{ commitmentId }`, không có trường số tiền, F-09), `GET /invoices/{id}/commitment-matches` (`FINANCE`). Hỗ trợ `POST /invoices` nhận `commitmentId?` ở dòng để khớp cùng transaction (F-24). Mở rộng `GET /budget-commitments`: thêm `realized`, giữ các trường cũ (tương thích thêm trường).
- Hook mới: `CommitmentVendorHook` trong `public/budgets.extension-points.ts`, `requests` bind qua `commitment-vendor.listener.ts` để tra nhà cung cấp từ `planId` qua `CatalogApi.getPlanVendorId` (F-22).

## Behavior and design

**Thiết kế chốt cho thực chi và công thức mới.**

```text
spent(Cost Center, năm)        = tổng invoice_lines.cost_reporting_minor
deductibleVat(Cost Center, năm) = tổng invoice_lines.deductible_vat_reporting_minor
held(Cost Center, năm)         = tổng (amount − released − realized) của khoản HELD đã gắn ngân sách
còn lại                        = ngân sách − spent − held
```

Trạng thái khoản: còn `heldMinor > 0` là `HELD`; về 0 mà `realizedMinor > 0` là `EXPENSED`; về 0 mà `realizedMinor = 0` là `RELEASED` (F-02). `planRelease`, `planRemainder` và `CommitmentRepo.release` dùng công thức này; điều kiện lạc quan của `updateMany` thêm `realizedMinor`.

**Thực chi có một nguồn (F-03, F-04, F-05, F-06).**
Hiện `CommitmentRepo.totals` lấy `spent` từ khoản cam kết `EXPENSED`, nay chuyển hẳn sang đọc từ `invoice_lines` qua repo `budget/invoice-spend.repo.ts` trong lõi `budget/` (F-04). `totals()` tính `held` = `amount - released - realized` (F-03) và gọi sang `invoice-spend.repo.ts` tuần tự. Cả `BudgetFactsRepo` và `BudgetViewService` đều đọc qua `totals()`. Hết rủi ro `totals` lọc `attachedVersionId` vì `spent` lấy từ dòng hóa đơn, không qua khoản cam kết (F-06). Dòng có `cost_center_id` null là _Chưa phân bổ_, không vào `spent` của Cost Center nào. Test fixture `spend-harness.ts` (`spec.spent`, `commit(..., 'EXPENSED')`) ghi kèm hóa đơn (F-05) để duy trì tính nhất quán mà không làm đỏ test cũ.

**Luồng khớp (F-07, F-08, F-09, F-10, F-21, F-22, F-24).**
Khớp thực hiện theo dòng hóa đơn (`invoice_line_id`, F-21), không khớp ở cấp hóa đơn và không có trường số tiền (F-09). Số khớp tự tính: `min(line.costReportingMinor, heldOf(commitment))`. Bỏ `INVOICE_MATCH.EXCEEDS_HELD`. Phần chi phí vượt khoản cam kết vẫn là thực chi và không mở khoản mới (`US-12-09` AC-9).
Transaction thực hiện theo thứ tự khóa: (1) hàng hóa đơn; (2) đọc không khóa Cost Center và năm của khoản, lấy khóa năm ngân sách (`BudgetYearLockRepo`); (3) hàng khoản cam kết bằng `lockById`.
Kiểm tra:

- Hóa đơn không phải `CREDIT_NOTE` và chi phí dòng > 0 (`INVOICE_NOT_MATCHABLE`).
- Dòng chưa từng khớp (`LINE_ALREADY_MATCHED`).
- Khoản cam kết đang `HELD` (`COMMITMENT_NOT_HELD`).
- So `line.fiscalYear` với `commitment.year` trong policy (`YEAR_MISMATCH`), không dùng trigger năm (F-10, lệch so với Inventory).
- Kiểm tra nhà cung cấp của khoản qua hook `CommitmentVendorHook` (`requests` trả vendor qua `CatalogApi.getPlanVendorId`, F-22); nếu khác vendor hóa đơn ném `VENDOR_MISMATCH`.
  Ghi `commitment_realizations` (unique `invoice_line_id`, F-21), tăng `realized_minor`, chuyển `EXPENSED` nếu `heldMinor = 0`. Dòng `cost_center_id` null nhận Cost Center của khoản (F-21). Không cập nhật `reconciliation_status` vì trường này dành cho phân bổ sao kê ↔ hóa đơn (F-08). Sửa thuế sau khi khớp tính lại chi phí dòng, `spent` tự đúng, `realized` không đổi (F-07). Cho phép `POST /invoices` nhận `commitmentId` theo dòng để khớp ngay khi ghi trong cùng transaction (F-24). Hóa đơn đã ghi nhưng chưa khớp làm _còn lại_ tạm thấp hơn tới khi khớp. Đây là phía an toàn; dùng `commitmentId` lúc ghi thì không có khoảng này.

**Thất bại sau khi đã chi một phần (`US-06-06` AC-9, F-02, F-11).**
`CommitmentRepo.release` tính lại phần còn giữ: về 0 thì chuyển `EXPENSED` nếu `realized > 0`, `RELEASED` nếu không; `releasedAt` chỉ đặt khi `RELEASED` (F-02). `CommitmentService.release` gọi `lockOfRequest` (`ORDER BY year FOR UPDATE`) để khóa hàng và đọc số dư mới nhất (F-11), tránh đua lệnh ném lỗi 500 khi Request đóng. 13tr giữ là chi phí, 8tr nhả về ngân sách.

**Credit note (`US-06-06` AC-11).** Theo `LD-06`: hóa đơn `kind = CREDIT_NOTE`, `credited_invoice_id`. Giảm thực chi ở kỳ ghi nhận (chi phí dòng âm); không mở lại khoản cam kết, không đổi kết cục Request. Không có thao tác hủy khớp (D6).

**Lỗi ổn định.** `INVOICE_MATCH.INVOICE_NOT_MATCHABLE`, `INVOICE_MATCH.COMMITMENT_NOT_HELD`, `INVOICE_MATCH.YEAR_MISMATCH`, `INVOICE_MATCH.VENDOR_MISMATCH`, `INVOICE_MATCH.LINE_ALREADY_MATCHED` (409); `VALIDATION_ERROR` (422).

**Đồng thời.** Khớp giữ khóa năm ngân sách. Khớp đua với nhả: `release` dùng `lockOfRequest` có `ORDER BY year FOR UPDATE`, tuần tự hóa an toàn (F-11).

**Migration (F-01, F-10, F-21).**

1. Thêm `realized_minor BIGINT NOT NULL DEFAULT 0` vào `budget_commitments`.
2. Tạm disable trigger guard, backfill `realized_minor = amount_minor - released_minor` cho các hàng cũ `EXPENSED` (nếu có), enable trigger guard.
3. Thay CHECK `budget_commitments_release_check` theo ba trạng thái (F-01).
4. `CREATE OR REPLACE FUNCTION budget_commitments_guard()`: giữ nguyên thân cũ, thêm chặn `NEW.realized_minor < OLD.realized_minor` (F-01).
5. Tạo `commitment_realizations`: `id`, `commitment_id`, `invoice_line_id` NOT NULL UNIQUE (F-21), `amount_minor`, `recorded_at`, `recorded_by_employee_id`. Trigger cấm update/delete. Không tạo trigger năm (F-10).

**Audit.** `BUDGET_COMMITMENT.REALIZED` có `requestId`, `year`, `invoiceId`, `position`, `amountMinor`, `heldMinor`, người thao tác.

**Response tiền của B07-8.** Khớp trả `matched` và `held`; danh sách khớp trả `amount`; PUT dòng thuế trả `amount` và `amountReporting`. Mọi trường dùng `moneyView`, với số tiền thập phân theo đơn vị tiền tệ. Minor units chỉ còn ở persistence, policy và audit.

```json
{
  "matched": { "amount": "20000000", "currency": "VND" },
  "held": { "amount": "1000000", "currency": "VND" }
}
```

Ví dụ dòng danh sách có `amount: { amount: "20000000", currency: "VND" }`; PUT thuế có `amount: { amount: "100", currency: "USD" }` và `amountReporting: { amount: "2500000", currency: "VND" }` khi snapshot tương ứng là 25.000 VND/USD.

## Test matrix

| AC / rủi ro             | Tình huống (gồm từ chối, edge case)                                                                | Cấp test             | Kết quả mong đợi                                                                | Bằng chứng sau implement                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| US-06-06 AC-1           | `K1` 21tr; giá 20tr, GTGT 2tr khấu trừ, nộp thay 1tr; ghi kèm `commitmentId`                       | integration          | `K1` `EXPENSED`; held −21tr, spent +21tr, còn lại không đổi                     | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| F-24                    | Cùng ca trên, ghi trước rồi khớp sau                                                               | integration          | Trước khớp còn lại tạm thấp hơn 21tr; sau khớp như hàng trên                    | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| US-12-02 AC-4           | `K1` 20tr khớp dòng chi phí 20tr                                                                   | integration          | `K1` `EXPENSED` theo chi phí thực chịu                                          | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| US-06-06 AC-5           | Hai hóa đơn 13tr rồi 8tr                                                                           | integration          | Sau đợt một `HELD` 8tr; sau đợt hai `EXPENSED`, spent 21tr                      | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| US-12-02 AC-8           | 13tr rồi 7tr trên `K1` 20tr                                                                        | integration          | Không trừ hai lần                                                               | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| US-12-09 AC-9           | `K1` 21tr, chi phí thật 23tr                                                                       | integration          | realized 21tr, spent 23tr, `EXPENSED` (không có lỗi vượt held)                  | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| Chi phí thấp hơn        | `K1` 21tr, chi phí 18tr                                                                            | integration          | `HELD` 3tr; Finance nhả phần dư sau                                             | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| F-07                    | Khớp 21tr rồi đổi GTGT 2tr thành không khấu trừ                                                    | integration          | spent 23tr, realized 21tr, audit trước/sau                                      | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| F-21                    | Dòng ngoài danh mục khớp `K1` của `CC-A`                                                           | integration          | Dòng nhận `CC-A`, `spent` của `CC-A` tăng                                       | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| US-06-06 AC-9           | Đã khớp 13tr, IT Admin đóng tác vụ thất bại                                                        | integration          | 13tr giữ chi phí, 8tr `RELEASED` phần dư, Finance được báo                      | Chưa chạy; B07-9 Task 5, ngoài lượt B07-8                                                                              |
| US-06-06 AC-11          | `R1` thất bại, `K1` `EXPENSED`, ghi credit note                                                    | integration          | Thực chi giảm ở kỳ ghi; `K1` và kết cục Request không đổi                       | Chưa chạy; B07-9 Task 6, ngoài lượt B07-8                                                                              |
| Hồi quy `US-06-06` AC-4 | Đưa `EXPENSED` về `HELD` bằng SQL                                                                  | integration          | Trigger guard từ chối                                                           | Pass local 03/11/2026; invoice-commitment-match.integration-spec.ts, đọc spent và remaining từ BudgetViewService.table |
| B07-7 ca tổng hợp       | Hóa đơn chưa khớp 10tr, dòng `cost_center_id` null, khác năm; `US-06-09` AC-12 GTGT khấu trừ 2tr   | integration          | `spent` 21tr, `deductibleVat` 2tr, `held` 0, còn lại giảm 21tr, không đếm 2 lần | Pass 7/7 ca B07-7 riêng; chưa có ca tổng hợp duy nhất kiểm remaining                                                   |
| F-06                    | Khoản thành chi phí trước khi có ngân sách, rồi ngân sách duyệt                                    | integration          | `spent` đủ, `held` 0, không lỗi trigger                                         | Chưa chứng minh luồng thành chi phí trước khi duyệt ngân sách                                                          |
| Từ chối                 | Dòng đã khớp; khác vendor; khác năm; khoản đã `RELEASED`; credit note; IT Admin / Manager gọi khớp | HTTP + integration   | Đúng mã lỗi (409/403), số dư không đổi, không audit                             | Pass local 03/11/2026; 5 ca refusal integration, zero-cost, 403/422 HTTP; số dư/audit không đổi                        |
| Khóa                    | Khớp đang giữ khóa năm, `release` chạy song song (`lockOfRequest`)                                 | integration (serial) | Tuần tự theo thứ tự khóa; tổng `released + realized ≤ amount`, không lỗi 500    | Pass local 03/11/2026; pg_blocking_pids xác nhận release chờ match giữ khóa năm và hàng khoản                          |
| Ràng buộc DB            | Ghi trực tiếp `released + realized > amount`, giảm `realized_minor`, sửa/xóa realization           | integration          | CHECK / trigger từ chối                                                         | Pass local 03/11/2026; commitment-realization-constraints.integration-spec.ts 20/20                                    |

Bổ sung của lượt B07-8 ngày 03/11/2026: dòng chi phí bằng 0 bị từ chối, số dư và audit giữ nguyên; hai ca ghi nhiều dòng với khoản không tồn tại hoặc khác năm rollback header, dòng, thuế, realization và audit. Cả 3 ca pass trong bộ 19/19. Ca khóa chạy bằng runner integration trên database riêng của file; không dùng tài nguyên cluster chung.

## Definition of Done

- [ ] Mọi primary AC có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì `pnpm test:http` + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; `pnpm arch:check` xanh, không thêm cạnh module.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Owner dispositions

Owner nhắn Dev B ngày 01/11/2026, Dev B chuyển lại; nguyên văn và nghĩa của nhãn ở `docs/gehihi-plans/02-owner-decisions.md`. Owner ủy quyền dùng khuyến nghị và xem lại khi review, chưa xem từng điểm.

| Mã  | Trạng thái                                      | Câu hỏi                              | Phương án                                                                                                                                                 |
| --- | ----------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D5  | Tạm theo khuyến nghị, Owner ủy quyền 01/11/2026 | Ai chọn khoản cam kết để khớp        | Finance chọn cho từng dòng hóa đơn; số khớp tự tính = min(chi phí dòng, phần còn giữ); từ chối khác nhà cung cấp                                          |
| D5a | Tạm theo khuyến nghị, Owner ủy quyền 01/11/2026 | Hóa đơn khác năm tài chính với khoản | Từ chối khớp; Finance nhả khoản cũ có lý do, hóa đơn tính vào năm của nó                                                                                  |
| D6  | Tạm theo khuyến nghị, Owner ủy quyền 01/11/2026 | Khớp nhầm thì sửa thế nào            | Không có hủy khớp. Credit note không gỡ được khớp nhầm; khoản bị khớp nhầm chỉ nhả được phần dư sau khi Request kết thúc. Owner xem rủi ro này khi review |

## Changes and acceptance

01/11/2026: ghi D5, D5a, D6 vào `## Owner dispositions`. Danh sách 31/10 bên dưới đã đóng tạm; câu "sửa bằng credit note" của D6 không còn đúng, theo dòng D6 ở bảng. Chưa review, chưa nghiệm thu.

31/10/2026: áp F-01→F-03, F-05→F-11, F-21, F-22, F-24 từ `docs/gehihi-plans/01-design-corrections.md` (chốt công thức thực chi từ dòng hóa đơn, khớp theo dòng không truyền số tiền, thay CHECK và hàm guard, hook vendor, lockOfRequest, bỏ reconciliation_status và trigger năm); chưa Owner review.

31/10/2026: lập thiết kế ở bước 01, trạng thái `draft`, chưa code, chưa review, chưa nghiệm thu. Quyết định chờ Owner:

- **D5:** ai chọn khoản cam kết để khớp: Finance chọn tay (thiết kế hiện tại) hay hệ thống gợi ý theo Request. Nguồn chỉ nói _hóa đơn tương ứng
  khớp_.
- **D6:** khớp nhầm: nguồn không có thao tác hủy khớp; `US-06-06` AC-4 cấm quay ngược. Thiết kế hiện **không** có hủy khớp, sửa bằng credit note.
