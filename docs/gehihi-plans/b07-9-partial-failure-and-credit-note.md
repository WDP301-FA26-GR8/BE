# B07-9 — Thất bại sau khi chi một phần, và credit note

| Gói  | Hạng mục                    | AC                               | Loại   | Cổng vào   |
| ---- | --------------------------- | -------------------------------- | ------ | ---------- |
| B-07 | `g8-commitment-realization` | `US-06-06` AC-9, AC-11, Task 5+6 | `CODE` | B07-8 xong |

## Đọc trước

- `US-06-06` AC-9, AC-11 trong `../docs/BE-UserStory/src/EP-06.md`
- `src/modules/requests/grant/access-request-grant.listener.ts`, `reportOutcome`
- Luồng thông báo Request: `src/modules/requests/status/`, `RequestStatusProjectorApi`
- `test/support/provisioning-harness.ts`, `spend-harness.ts`

## Phần 1: AC-9

Công thức mới làm `releaseForRequest` tự nhả đúng phần chưa chi. Không đổi `reportOutcome`.

Viết `test/integration/requests/grant-failure-after-partial-spend.integration-spec.ts`:

| Setup                                       | Thao tác                        | Đáp án                                                                         |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `K1` 21tr, hóa đơn 13tr đã khớp, tác vụ lỗi | IT Admin đóng thất bại có lý do | 13tr là chi phí; 8tr có dòng `budget_commitment_releases` lý do `GRANT_FAILED` |
| Như trên                                    | Xem Request                     | Request và Assignment `FAILED`                                                 |
| Như trên                                    | Xem thông báo                   | Finance được báo                                                               |
| Như trên                                    | Xem tiết kiệm                   | Không có dòng tiết kiệm nào, nếu đã có bảng; chưa có thì ghi là chưa áp dụng   |

Trạng thái cuối của `K1` là `EXPENSED`: giữ về 0 và `realized > 0`.

**Vế _Finance được báo_:** kiểm xem sự kiện `ACCESS_REQUEST.GRANT_FAILED` có tạo thông báo cho Finance không. Nếu không có, đây là
thiếu hành vi thật: viết test đỏ, thêm vào đúng chỗ của `requests/status`, chỉ cho ca có khoản đã chi, tránh báo oan ca không
liên quan đến Finance. Nếu phải đổi nhiều hơn một luật thông báo thì dừng hỏi.

Áp nhiều đường nhả khác: `group-grant.service.ts`, `group-withdrawal-aftermath.service.ts`, `request-end.service.ts`,
`renewal-apply.service.ts`, `service-account-boundary.service.ts`. Nhóm có truyền `amounts`: kiểm không còn `EXCEEDS_HELD` sai khi đã
khớp một phần. Thêm một test nhóm nếu chưa có.

## Phần 2: AC-11 credit note

`POST /invoices` nhận `kind: 'CREDIT_NOTE'` và `creditedInvoiceId`:

- Bắt buộc `creditedInvoiceId`, hóa đơn gốc phải tồn tại và là `INVOICE`, cùng nhà cung cấp; sai thì 422 hoặc `INVOICE.NOT_FOUND`.
- Lưu số dương, `invoice-cost.policy` trả số âm, nên `cost_reporting_minor` của dòng âm và `spent` tự giảm.
- Năm và Cost Center theo ngày của credit note. Dòng không có thuê bao: nếu mọi dòng của hóa đơn gốc cùng một Cost Center thì dùng
  Cost Center đó, không thì để null. Đây là đề xuất thiết kế, ghi vào spec để audit.
- Không đụng `budget_commitments`, không đụng Request.
- Không khớp cam kết được (`INVOICE_NOT_MATCHABLE`).
- Audit `INVOICE.RECORDED` có `kind`.

Test:

| Setup                                         | Thao tác         | Đáp án                                        |
| --------------------------------------------- | ---------------- | --------------------------------------------- |
| `R1` `FAILED`, `K1` `EXPENSED` 21tr           | Ghi credit note  | `K1` không đổi; kết cục, lý do `R1` không đổi |
| Như trên                                      | Khớp credit note | `INVOICE_MATCH.INVOICE_NOT_MATCHABLE`         |
| Credit note trỏ tới hóa đơn nhà cung cấp khác | Ghi              | Từ chối                                       |

Thêm ca: `K1` `EXPENSED` 21tr, credit note 5tr cùng Cost Center và năm → `spent` giảm 5tr, `held` không đổi, `K1` không mở lại.

## Verify

```powershell
pnpm test:integration -- test/integration/requests --maxWorkers=4
pnpm test:integration -- test/integration/budgets
pnpm test:http -- test/http/budgets
pnpm check
pnpm openapi:export
```

Kết thúc hạng mục, chạy regression và ghi vào plan:

```powershell
pnpm test:http
pnpm test:integration
pnpm test:integration:serial
pnpm test:e2e
```

## Xong khi

AC-9 có bằng chứng đủ bốn vế hoặc ghi rõ vế chưa áp dụng. AC-11 đủ cả vế thực chi lẫn vế không đổi kết cục. Rà lại toàn bộ nơi đọc `spentMinor`.
