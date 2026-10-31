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
- Operation mới: `POST /invoices/{id}/commitment-matches` (`FINANCE`), `GET /invoices/{id}/commitment-matches` (`FINANCE`). Mở rộng
  `GET /budget-commitments`: thêm `realized`, giữ các trường cũ (tương thích thêm trường).

## Behavior and design

**Công thức mới.** `heldMinor = amount − released − realized`. Trạng thái: còn `heldMinor > 0` là `HELD`; về 0 mà `realized > 0` là
`EXPENSED`; về 0 mà `realized = 0` là `RELEASED`. `planRelease`, `planRemainder` và `CommitmentRepo.release` dùng công thức này;
điều kiện lạc quan của `updateMany` thêm `realizedMinor`.

**Thực chi có một nguồn.** Hiện `CommitmentRepo.totals` lấy `spent` từ khoản cam kết `EXPENSED` và `BudgetFactsRepo` trả nó thành `spentMinor`,
nên `remaining = total − held − spent` (`requests/spend/budget-check.policy.ts`). Khi có hóa đơn, thực chi gồm cả hóa đơn không khớp cam kết,
nên `spentMinor` đổi nguồn sang tổng chi phí thực chịu đọc từ repo hóa đơn của `budgets`, **không** cộng thêm `EXPENSED`. Chưa có hóa đơn thì trả 0,
giữ đúng hành vi hiện tại. Đây là thay đổi rủi ro nhất của lát: khớp 21tr thì `held` giảm 21tr và `spent` tăng 21tr, _còn
lại_ không đổi (`US-06-06` AC-1).

**Luồng khớp.** Finance chọn khoản cam kết và số tiền theo chi phí thực chịu. Transaction, theo thứ tự khóa: hàng hóa đơn → khóa năm ngân sách
của Cost Center và năm → hàng khoản cam kết. Kiểm: khoản cam kết `HELD`; năm của chứng từ bằng năm khoản cam kết (`CERD5-16`); số tiền dương,
không vượt `heldMinor`. Ghi `commitment_realizations`, tăng `realized_minor`, chuyển `EXPENSED` nếu hết, cập nhật `reconciliation_status`, audit
`BUDGET_COMMITMENT.REALIZED`. Phần hóa đơn vượt khoản cam kết vẫn là thực chi và không tự mở khoản cam kết mới.

**Thất bại sau khi đã chi một phần (`US-06-06` AC-9).** `releaseForRequest` với công thức mới tự nhả đúng phần chưa chi: 13tr giữ là chi phí, 8tr
nhả. Không đổi `reportOutcome`; quy tắc giữ lại khi có chứng từ mua thuộc `g8-spend-basis-on-failure`.

**Credit note (`US-06-06` AC-11).** Theo `LD-06`: hóa đơn `kind = CREDIT_NOTE`, `credited_invoice_id`. Là sự kiện điều chỉnh riêng, giảm thực
chi kỳ ghi nhận; không mở lại khoản cam kết, không đổi kết cục Request. Hủy khớp nhầm là gap của nguồn (xem D6).

**Lỗi ổn định.** `INVOICE_MATCH.COMMITMENT_NOT_HELD`, `INVOICE_MATCH.YEAR_MISMATCH`, `INVOICE_MATCH.EXCEEDS_HELD`,
`INVOICE_MATCH.INVOICE_NOT_MATCHABLE` (409); `VALIDATION_ERROR` (422).

**Đồng thời.** Cùng khóa năm với mọi người ghi ngân sách, nên khớp và kiểm tra ngân sách không đọc lệch. Khớp đua với nhả khi Request kết thúc:
thứ tự toàn hệ thống là hàng Request trước, rồi năm; lát này không khóa hàng Request, nên `release` phải đọc lại hàng khoản cam kết sau khi giữ
khóa và điều kiện lạc quan phải từ chối giá trị cũ. Test khóa tất định, không phải test đua một lần.

**Migration.** Task riêng đi trước code: thêm `realized_minor BIGINT NOT NULL DEFAULT 0`, CHECK `released_minor + realized_minor <= amount_minor`,
bảng `commitment_realizations` kèm CHECK và trigger năm theo Logical (cột `purchase_document_id` để lại cho `g8-spend-basis-on-failure`).
Backfill không cần vì chưa có hàng `EXPENSED` nào. Tương thích ngược: API thêm trường, không bỏ trường.

**Audit.** `BUDGET_COMMITMENT.REALIZED` có `requestId`, `year`, `invoiceId`, `amountMinor`, `heldMinor`, người thao tác. Jobs: không áp dụng.

## Test matrix

| AC / rủi ro                  | Tình huống (gồm từ chối, edge case)                                   | Cấp test             | Kết quả mong đợi                                                    | Bằng chứng sau implement |
| ---------------------------- | --------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- | ------------------------ |
| US-06-06 AC-1                | `K1` 21tr; hóa đơn giá 20tr, GTGT 2tr khấu trừ, nộp thay 1tr; khớp đủ | integration          | `K1` `EXPENSED`; held −21tr, spent +21tr, còn lại không đổi         | chưa chạy                |
| US-12-02 AC-4                | Hóa đơn tương ứng khớp `K1` 20tr                                      | integration          | `K1` `EXPENSED` theo chi phí thực chịu                              | chưa chạy                |
| US-06-06 AC-5, US-12-02 AC-8 | Khớp 13tr rồi 8tr (và 13tr rồi 7tr)                                   | integration          | Sau đợt một còn giữ đúng; sau đợt hai `EXPENSED`; không trừ hai lần | chưa chạy                |
| US-06-06 AC-9                | Đã khớp 13tr, IT Admin đóng tác vụ thất bại                           | integration          | 13tr giữ chi phí, 8tr `RELEASED` phần dư, Finance được báo          | chưa chạy                |
| US-06-06 AC-11               | `R1` thất bại, `K1` `EXPENSED`, ghi credit note                       | integration          | Thực chi giảm ở kỳ ghi; `K1` và kết cục Request không đổi           | chưa chạy                |
| Hồi quy `US-06-06` AC-4      | Đưa `EXPENSED` về `HELD`                                              | unit                 | Không có đường; `planRelease` từ chối `NOT_HELD`                    | chưa chạy                |
| Hồi quy G5                   | Kiểm tra ngân sách khi chưa có hóa đơn nào                            | integration          | Mọi snapshot giống trước khi đổi nguồn `spentMinor`                 | chưa chạy                |
| Đếm hai lần                  | Có hóa đơn không khớp cam kết và hóa đơn khớp                         | integration          | `spentMinor` = tổng chi phí thực chịu, không cộng `EXPENSED`        | chưa chạy                |
| Từ chối                      | Vượt held; khác năm; khoản đã `RELEASED`; IT Admin gọi khớp           | HTTP + integration   | Đúng mã lỗi, số dư không đổi, không audit                           | chưa chạy                |
| Khóa                         | Khớp đang giữ khóa năm, `release` chạy song song                      | integration (serial) | Tuần tự theo thứ tự khóa; tổng `released + realized ≤ amount`       | chưa chạy                |
| Ràng buộc DB                 | Ghi trực tiếp `released + realized > amount`                          | integration          | CHECK từ chối                                                       | chưa chạy                |

## Definition of Done

- [ ] Mọi primary AC có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì `pnpm test:http` + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; `pnpm arch:check` xanh, không thêm cạnh module.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập thiết kế ở bước 01, trạng thái `draft`, chưa code, chưa review, chưa nghiệm thu. Quyết định chờ Owner:

- **D5:** ai chọn khoản cam kết để khớp: Finance chọn tay (thiết kế hiện tại) hay hệ thống gợi ý theo Request. Nguồn chỉ nói _hóa đơn tương ứng
  khớp_.
- **D6:** khớp nhầm: nguồn không có thao tác hủy khớp; `US-06-06` AC-4 cấm quay ngược. Thiết kế hiện **không** có hủy khớp, sửa bằng credit note.
