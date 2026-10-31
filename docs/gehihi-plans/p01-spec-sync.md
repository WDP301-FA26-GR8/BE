# P01 — Áp các sửa thiết kế vào spec

| Loại   | Phụ thuộc | Cổng vào                                                     |
| ------ | --------- | ------------------------------------------------------------ |
| `DOCS` | P00       | Người phụ trách đã đọc và đồng ý `01-design-corrections.md`. |

Spec là nguồn chính, nên các mã `F-*` phải nằm trong spec trước khi code. Plan này chỉ sửa tài liệu.

## File được sửa

- `docs/workspace/items/g8-invoice-recording/spec.md`, `plan.md`
- `docs/workspace/items/g8-commitment-realization/spec.md`, `plan.md`
- `docs/workspace/items/g4-request-and-transfer-integration/spec.md`
- `docs/workspace/items/g9-charge-reconciliation/spec.md`
- `docs/workspace/items/g8-seat-cost-attribution/spec.md`

## Các bước

1. `g8-commitment-realization/spec.md`: áp F-01→F-03, F-05→F-11, F-21, F-22, F-24 và mục _Thiết kế chốt cho thực chi_ vào `Behavior and
design`, `Test matrix`.
   - Thay đoạn _Thực chi có một nguồn_: `spentMinor` = tổng `cost_reporting_minor` của dòng hóa đơn; `realized` chỉ làm giảm `held`.
   - Đổi thao tác khớp sang theo dòng, không có trường số tiền. Bỏ `INVOICE_MATCH.EXCEEDS_HELD`.
   - Thêm `INVOICE_MATCH.VENDOR_MISMATCH`, `INVOICE_MATCH.LINE_ALREADY_MATCHED`.
   - Sửa ca test theo bảng test của B07-7, B07-8.
   - Bỏ câu cập nhật `reconciliation_status` (F-08); bỏ trigger năm, ghi kiểm bằng policy (F-10).
2. `g8-commitment-realization/plan.md`: Task 1 thêm thay CHECK và thay hàm guard; Task 2 thêm `totals()`; Task 3 đổi `Files` sang lõi
   `budget/invoice-spend.repo.ts`, `spend-harness.ts`; Task 4 thêm hook và `requests/spend/commitment-vendor.listener.ts`.
3. `g8-invoice-recording/spec.md`: áp F-04, F-07, F-12→F-15, F-17, F-19, F-23. Ghi rõ nguồn cột là Inventory lịch sử, đối chiếu qua
   `LOGICAL-ERD-MAPPING.md`; bổ sung `organization` vào danh sách phụ thuộc đọc.
4. `g8-invoice-recording/plan.md`: Task 1 thêm bốn cột của `invoice_lines`; Task 2 thêm `splitAcrossLines`; Task 3 thêm quy Cost Center;
   Task 6 ghi rõ thay hai CHECK của `document_attachments`, hướng gọi `budgets → catalog`, luật mục đích + đích gắn.
5. `g4-request-and-transfer-integration/spec.md`: mục _Thiết kế sửa `US-01-12` AC-4_ áp F-16, bỏ câu "thêm mức đọc `HEAD` ở
   `readAccessOf`"; ghi căn cứ dòng `BM-04` của BRD cho D7.
6. `g9-charge-reconciliation/spec.md`: thêm F-20 vào `Dependencies and blockers`. `g8-seat-cost-attribution/spec.md`: ghi cơ sở _theo dòng
   tiền_ đã ở hạng mục hóa đơn.
7. Thêm một dòng ở `Changes and acceptance` của mỗi spec đã sửa: ngày, mã `F-*`, nguồn là
   `docs/gehihi-plans/01-design-corrections.md`, chưa Owner review.

## Không làm

- Không đổi trạng thái thiết kế sang `ready`.
- Không trả lời thay các câu ở nhóm 2 của `02-owner-decisions.md`; ghi phần phụ thuộc là chờ Owner.
- Không sửa code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
git diff --stat -- docs/workspace
```

Nếu `rules:format` đỏ, chạy `pnpm exec prettier --write <đúng các file đã sửa>`.
