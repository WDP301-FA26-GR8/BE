# Spec: Finance ghi hóa đơn, dòng hóa đơn và dòng thuế đúng chứng từ

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — `US-12-10`, `US-12-02`, `US-04-04`; `FR-5.4`, `FR-5.13`, `QĐ-19`, `QĐ-34b`, `QĐ-42b`,
  `QĐ-55a`, `QĐ-60a`; Logical ERD 7.103–7.105), BE `d6c2112`.
- Nhóm roadmap: G8 và G3 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/DEV-B.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance ghi một hóa đơn kèm dòng hóa đơn và dòng thuế đúng chứng từ; hệ thống tính chi phí thực chịu, tách GTGT được khấu trừ và
giữ tỷ giá đã chốt; người đúng quyền đọc được hóa đơn, kiểm được qua API và Audit Trail.

## Sizing decision

- Container: G8 và G3 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Finance ghi nhận một khoản chi đã nhận chứng từ; capability `budgets/invoice`.
- Boundaries: mỗi lần ghi một transaction trên `invoices`, `invoice_lines`, `invoice_tax_lines` kèm audit; chỉ `FINANCE` ghi;
  không sự kiện ra ngoài; tỷ giá đọc qua `FinanceApi`.
- Not larger: ghép về thuê bao, phân loại chênh lệch và chuyển cam kết thành chi phí là quyết định riêng trên hóa đơn đã ghi
  (`g8-invoice-subscription-match`, `g8-commitment-realization`), có test matrix riêng.
- Not smaller: đầu hóa đơn, dòng và dòng thuế là một chứng từ nguyên tử; tách theo bảng sẽ tạo hóa đơn thiếu chi phí thực chịu.
- Siblings: `g8-invoice-subscription-match`, `g8-commitment-realization`, `g8-period-close-report`, `g9-charge-reconciliation`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8), [G3](../../../roadmap.md#work-item-decomposition-g3).

## Primary Story/AC

| Story    | AC                      | Coverage | Phần còn lại thuộc                                                                                                                            |
| -------- | ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| US-12-10 | AC-1→AC-7, AC-10, AC-11 | partial  | AC-8: `g8-invoice-subscription-match`; AC-9: `g8-period-close-report`; AC-12: `g9-charge-reconciliation`                                      |
| US-12-02 | AC-9                    | partial  | AC-1→AC-3, AC-5→AC-7: `g8-invoice-subscription-match`; AC-4, AC-8: `g8-commitment-realization`                                                |
| US-04-04 | AC-4, AC-7              | partial  | AC-1→AC-3, AC-9, AC-10: `g3-contract-documents`; AC-5, AC-6, AC-11: `g3-downstream-finance-integration`; AC-8: `g4-device-dependent-features` |

## Supporting references

`US-12-09` AC-5 (đổi hồ sơ thuế không viết lại hóa đơn đã ghi — kiểm ở test matrix, chủ AC vẫn ở
`g3-downstream-finance-integration`); `US-01-12` AC-10 (ai nộp phần nào của `BM-05`); [ADR-0016](../../../decisions/0016-budgets-context.md);
[ADR-0013](../../../decisions/0013-catalog-finance-licensing-contexts.md); [ADR-0019](../../../decisions/0019-module-tiers-and-public-api.md).

## Explicit out of scope

- Import hóa đơn qua file: chờ `OQ-F-03` (tệp mang sẵn dòng thuế hay thêm sau); hạng mục này chỉ nhập tay qua API.
- Ghép dòng về thuê bao và so ba con số (`g8-invoice-subscription-match`); khớp khoản cam kết và credit note
  (`g8-commitment-realization`); cột GTGT/thực chi trên bảng tổng chi (`g8-spend-summary`).
- Thanh toán, sổ cái, kê khai thuế (`QĐ-34`, `QĐ-55a`): không có trạng thái _đã thanh toán_.

## Dependencies and blockers

- Không có blocker cho phần nhập tay.
- Dependency đã có: `FinanceApi.snapshotMoney`, `taxProfileOf`, `parseMoney`; luồng tải tệp `catalog/contract/document.service.ts` với
  mục đích `PURCHASE_DOCUMENT`, `TAX_PAYMENT_PROOF` (`prisma/models/catalog.prisma`).
- `OQ-F-03` không chặn phần nhập tay; chỉ chặn import.

## Ownership: module, data, API

- Capability mới `budgets/invoice`, không tạo module mới. Căn cứ: [hướng dẫn dev mới](../../../guides/huong-dan-dev-moi.md#3-thêm-x-thì-đặt-ở-đâu) đặt
  việc mới vào module sở hữu dữ liệu; Conceptual và Logical ERD xếp `Invoice` cùng `BudgetCommitment` ở C7; `budgets` đã import `finance`, `catalog` nên
  không cần cạnh tầng mới. `finance` (T3) không dùng được vì không gọi được `budgets`. BRD 5.12.1 ghi `Invoice` ở C1 nhưng dòng thuế hóa đơn ở C7: lệch
  nguồn, ghi ở D8.
- Bảng mới theo Logical ERD 7.103–7.105 trong `prisma/models/budgets.prisma`; không sửa bảng của module khác ngoài khóa ngoại chủ sở hữu trên tệp đính kèm.
- Operation mới (tên chốt ở OpenAPI khi implement):

| Operation                                 | Vai                   | Mục đích                                                                    |
| ----------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `POST /invoices`                          | `FINANCE`             | Ghi hóa đơn cùng dòng và dòng thuế                                          |
| `GET /invoices`                           | `FINANCE`             | Danh sách tóm tắt, lọc theo nhà cung cấp, ngày, trạng thái                  |
| `GET /invoices/{id}`                      | `FINANCE`, `IT_ADMIN` | Chi tiết và chi phí thực chịu                                               |
| `GET /invoices/{id}/lines`                | `FINANCE`, `IT_ADMIN` | Dòng hóa đơn, có phân trang                                                 |
| `GET /invoices/{id}/tax-lines`            | `FINANCE`, `IT_ADMIN` | Dòng thuế (`US-12-10` AC-11: IT Admin xem được)                             |
| `PUT /invoices/{id}/tax-lines/{position}` | `FINANCE`             | Sửa cờ khấu trừ/dòng thuế theo chứng từ (AC-3)                              |
| `GET /vendors/{id}/tax-defaults`          | `FINANCE`             | Cờ mặc định theo hồ sơ thuế để điền sẵn (AC-2); không tạo dòng              |
| Gắn tệp vào hóa đơn                       | `FINANCE`             | Dùng lại luồng tệp hiện có; route chốt sau khi đọc kỹ `document.service.ts` |

## Behavior and design

**Luồng ghi.** Finance gửi đầu hóa đơn, các dòng, các dòng thuế. Trong một transaction: kiểm nhà cung cấp còn dùng được, quy đổi bằng
`FinanceApi.snapshotMoney`, ghi ba bảng, ghi audit `INVOICE.RECORDED`. `reconciliation_status` khởi đầu `NONE` và không bao giờ mang
nghĩa đã thanh toán.

**Chi phí thực chịu** là hàm thuần `invoice-cost.policy.ts`: `giá trước thuế + tổng dòng thuế có deductible = false`; dòng
`deductible = true` đi vào cột GTGT riêng. Không có dòng thuế thì chi phí bằng giá (AC-6). Hệ thống không tự sinh dòng thuế từ tỷ lệ
ước tính (AC-10); cờ mặc định chỉ là gợi ý đọc từ hồ sơ thuế (AC-2).

**Tiền và tỷ giá.** Lưu theo đơn vị nhỏ nhất và tiền tệ giao dịch, kèm `amount_reporting_minor`, tỷ giá, ngày và nguồn tỷ giá; không quy
đổi lại khi đọc (AC-7). Dòng thuế khác tiền tệ quy đổi riêng khi ghi. Ngày tỷ giá là ngày ghi nhận theo chữ của AC-7 (xem D2). Thiếu tỷ
giá đúng ngày thì từ chối, không lấy tỷ giá gần nhất (`QĐ-42b`).

**Sửa dòng thuế (AC-3).** Khóa hàng hóa đơn, đổi dòng, audit `INVOICE.TAX_LINE_CHANGED` có trước/sau. Hồ sơ thuế đổi sau đó không chạm
hóa đơn đã ghi vì cờ và tỷ lệ được chép vào dòng.

**Lỗi ổn định.** `INVOICE.DUPLICATE` (409, trùng khóa `organization, vendor, kind, invoice_number`), `INVOICE.NOT_FOUND` (404),
`INVOICE.RATE_MISSING` (409), `INVOICE.VENDOR_UNUSABLE` (409), `VALIDATION_ERROR` (422). Sai vai: 403 theo guard.

**Transaction và đồng thời.** Không có khóa năm ngân sách ở lát này vì chưa đổi khoản cam kết. Hai lần gửi trùng do bấm hai lần: ràng buộc
duy nhất trả `INVOICE.DUPLICATE`, không tạo bản thứ hai. `snapshotMoney` giữ `organizations FOR SHARE` tới commit, nên tiền tệ báo cáo
không đổi giữa chừng. Thứ tự khóa ghi ở comment đầu service.

**Collection (`API-LIST-DETAIL.1`).** `GET /invoices` trả tóm tắt không kèm dòng, sắp xếp `invoice_date DESC, id DESC`, phân trang có biên;
dòng ở subresource riêng; số câu lệnh không tăng theo cỡ trang. Trang và tổng đọc trong một giao dịch `RepeatableRead`.

**Migration.** Một migration tạo enum và ba bảng, CHECK `invoices_credit_link`, `invoice_lines_subject`, chỉ mục theo Logical. Không backfill.
Bảng mới nên rollback được bằng migration đảo; không có tác động lên dữ liệu cũ. Cấp quyền cho role runtime theo H7.

**Audit và privacy.** Hồ sơ tài chính không thuộc bảng lưu giữ 7.5. Không log nội dung tệp. Jobs/worker: không áp dụng ở lát này.

**Lệch nhỏ so với Logical cần chốt khi implement:** BE hiện dùng `*_employee_id` cho người thao tác ở nhiều bảng, Logical ghi
`recorded_by_app_user_id`; theo convention của module gần nhất và ghi lại lựa chọn trong plan.

## Test matrix

| AC / rủi ro        | Tình huống (gồm từ chối, edge case)                                                      | Cấp test    | Kết quả mong đợi                                                                        | Bằng chứng sau implement |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- | ------------------------ |
| US-12-10 AC-1      | Hóa đơn 1.000 USD, hai dòng thuế GTGT 100, TNDN 50 nộp thay                              | integration | Mỗi dòng lưu loại, tỷ lệ, số tiền, bên nộp, cờ                                          | chưa chạy                |
| US-12-10 AC-2      | Nhà cung cấp hồ sơ `T2`, đọc cờ mặc định                                                 | HTTP + unit | GTGT `true`, TNDN `false`; không dòng nào được tạo                                      | chưa chạy                |
| US-12-10 AC-3      | Đổi cờ GTGT thành không                                                                  | integration | Chi phí thực chịu tăng 100; audit có trước/sau                                          | chưa chạy                |
| US-12-10 AC-4      | Giá 20tr, GTGT 2tr khấu trừ, thuế nộp thay 1tr không khấu trừ                            | unit        | Chi phí thực chịu 21tr, GTGT 2tr tách riêng                                             | chưa chạy                |
| US-12-10 AC-5      | Đính chứng từ nộp thay vào dòng thuế                                                     | integration | Liên kết được, mở theo quyền `FR-1.5`                                                   | chưa chạy                |
| US-12-10 AC-6      | Hóa đơn không dòng thuế                                                                  | unit        | Chi phí bằng giá, không có GTGT                                                         | chưa chạy                |
| US-12-10 AC-7      | Hóa đơn USD, dòng thuế VND; đổi tỷ giá sau khi ghi; thiếu tỷ giá đúng ngày               | integration | Số quy đổi không đổi khi đọc lại; thiếu tỷ giá trả `INVOICE.RATE_MISSING`, không ghi gì | chưa chạy                |
| US-12-10 AC-10     | Hóa đơn `T2` chưa ghi dòng thuế                                                          | integration | Không có dòng thuế tự sinh, không có thao tác kê khai                                   | chưa chạy                |
| US-12-10 AC-11     | IT Admin, trưởng phòng, Người duyệt chi, Super Admin gọi ghi/sửa; IT Admin đọc dòng thuế | HTTP        | Bốn vai 403, hóa đơn không đổi; IT Admin đọc được                                       | chưa chạy                |
| US-12-02 AC-9      | IT Admin, trưởng phòng, Người duyệt chi gọi `POST /invoices`                             | HTTP        | 403, không có bản ghi                                                                   | chưa chạy                |
| US-04-04 AC-4      | Hóa đơn chưa liên kết Contract, Finance đính tệp gốc                                     | integration | Lưu được, tệp thuộc hóa đơn                                                             | chưa chạy                |
| US-04-04 AC-7      | Finance gắn chứng từ thuế; trưởng phòng mở; IT Admin tải lên mục đích này                | integration | Finance, IT Admin mở được; trưởng phòng 403; IT Admin tải lên bị từ chối                | chưa chạy                |
| Trùng hóa đơn      | Hai request đồng thời cùng số hóa đơn                                                    | integration | Một thành công, một `INVOICE.DUPLICATE`, một audit                                      | chưa chạy                |
| Hoàn tác           | Lỗi ở dòng thuế giữa transaction                                                         | integration | Không còn đầu hóa đơn hay audit                                                         | chưa chạy                |
| Hồ sơ thuế đổi sau | Đổi tỷ lệ hồ sơ sau khi ghi (`US-12-09` AC-5)                                            | integration | Dòng thuế đã ghi không đổi                                                              | chưa chạy                |
| Danh sách          | Phân trang, thứ tự ổn định, số câu lệnh không tăng theo cỡ trang                         | integration | Thứ tự ổn định, gate list/detail xanh                                                   | chưa chạy                |

## Definition of Done

- [ ] Mọi primary AC có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì `pnpm test:http` + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; module card `budgets` cập nhật, `arch:check` xanh.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập thiết kế ở bước 01, trạng thái `draft`, chưa code, chưa review, chưa nghiệm thu. Quyết định chờ Owner:

- **D2:** ngày tỷ giá của hóa đơn là ngày ghi nhận (chữ của `US-12-10` AC-7, đang dùng trong thiết kế) hay ngày hóa đơn.
- **D3:** tổng các dòng có phải bằng giá trước thuế không. Thiết kế hiện **không** ép vì nguồn không nói; nếu cần ép thì thêm lỗi.
- **D4:** `OQ-F-03` khi tới phần import.
- **D8:** BRD 5.12.1 ghi `Invoice` ở C1, Conceptual và Logical ERD ghi C7. Thiết kế theo ERD; nên sửa BRD ở lượt Docs sau. Không chặn code.
