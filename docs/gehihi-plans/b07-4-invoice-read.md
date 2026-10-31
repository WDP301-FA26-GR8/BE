# B07-4 — Đọc hóa đơn

| Gói  | Hạng mục               | AC                                | Loại   | Cổng vào   |
| ---- | ---------------------- | --------------------------------- | ------ | ---------- |
| B-07 | `g8-invoice-recording` | `US-12-10` AC-11 (vế đọc), Task 5 | `CODE` | B07-2 xong |

## Đọc trước

- `docs/rules/api-contract.md`, phần collection và detail
- `test/gates/api-collection-contract.gate-spec.ts`
- `CommitmentRepo.page`, `CommitmentService.page` làm mẫu đọc phân trang

## Operation

| Operation                      | Vai                   | Trả về                                                                        |
| ------------------------------ | --------------------- | ----------------------------------------------------------------------------- |
| `GET /invoices`                | `FINANCE`             | Tóm tắt, không kèm dòng; lọc `vendorId`, `from`, `to`, `reconciliationStatus` |
| `GET /invoices/{id}`           | `FINANCE`, `IT_ADMIN` | Đầu hóa đơn, `effectiveCost`, `deductibleVat`, bộ tiền đã chốt                |
| `GET /invoices/{id}/lines`     | `FINANCE`, `IT_ADMIN` | Dòng hóa đơn, phân trang                                                      |
| `GET /invoices/{id}/tax-lines` | `FINANCE`, `IT_ADMIN` | Dòng thuế, phân trang                                                         |

## Các bước

1. `invoice-query.service.ts`, `invoice.mapper.ts`, thêm hàm đọc vào `invoice.repo.ts`.
2. List sắp `invoice_date DESC, id DESC`. Trang và tổng đọc trong một transaction `RepeatableRead`, giống phần đọc đang có.
3. Chi phí thực chịu tính bằng `invoice-cost.policy.ts` từ số đã lưu. Không quy đổi lại, không đọc tỷ giá khi xem.
4. Nếu list cần `effectiveCost` thì lấy dòng thuế theo lô bằng một câu cho cả trang, không N+1.
5. Không có trường nào mang nghĩa _đã thanh toán_.
6. Cập nhật `test/support/api-coverage-manifest.ts`.

## Test

| Tình huống                         | Tầng        | Đáp án                       |
| ---------------------------------- | ----------- | ---------------------------- |
| `IT_ADMIN` gọi `GET /invoices`     | HTTP        | 403                          |
| `IT_ADMIN` đọc dòng thuế           | HTTP        | 200                          |
| `MANAGER`, `EMPLOYEE` đọc chi tiết | HTTP        | 403                          |
| Hai hóa đơn cùng ngày, phân trang  | integration | Thứ tự ổn định qua các trang |
| Số câu lệnh khi cỡ trang 10 và 50  | integration | Không tăng theo cỡ trang     |
| Đổi tỷ giá sau khi ghi, đọc lại    | integration | Số quy đổi không đổi         |

Dùng harness đếm query có sẵn của `API-LIST-DETAIL.1`; tìm trong `test/support/`.

## Verify

```powershell
pnpm test:http -- test/http/budgets
pnpm test:integration -- test/integration/budgets
pnpm test:gates
pnpm check
pnpm openapi:export
pnpm arch:routes
```

## Xong khi

Gate collection xanh, `US-12-10` AC-11 đủ cả vế đọc và ghi.
