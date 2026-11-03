# B09-0 — Quyết định đặt G9 ở đâu

| Gói  | Hạng mục                                | Loại     | Cổng vào                                |
| ---- | --------------------------------------- | -------- | --------------------------------------- |
| B-09 | khung G9, chưa thuộc riêng hạng mục nào | `DESIGN` | B07-7 xong; Q-08 tạm theo khuyến nghị A |

Mọi plan G9 phụ thuộc quyết định này. Q-08 tạm theo phương án A, Owner ủy quyền 01/11/2026. Agent chỉ soạn hồ sơ, **không tạo module**.

## Vì sao phải quyết trước

Bảng G9: `statement_imports`, `statement_lines`, `statement_review_items`, `statement_invoice_allocations`, `spend_exceptions`,
`discovery_findings`, `discovery_dossiers`, `finding_context_requests`, `finding_decisions`, `finding_kept_users`.

Hai chiều phụ thuộc đối nhau:

- G9 cần **gọi xuống**: `CatalogApi` (thêm ứng dụng), `LicensingApi` (tạo Assignment), `BudgetsApi` (căn cứ cam kết, hóa đơn),
  snapshot ngân sách của `requests`.
- `budgets` cần **đọc lên**: phần sao kê chưa được hóa đơn giải thích vào `spent` và bảng tổng chi (`US-12-01`, `US-06-06` AC-8).

## Phương án

| Phương án                                                                   | Ưu                                                              | Nhược                                                                                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Module mới T6, ví dụ `reconciliation`                                    | Đúng vùng C6, tách vai và luồng; gọi được `requests`, `budgets` | `budgets` phải mở extension point `Contributions` cho nguồn thực chi; thêm module, sửa ADR                                                                           |
| B. Capability trong `budgets`                                               | Không đổi tầng, `spent` đọc trực tiếp                           | `budgets` phình; không gọi được `requests` (không lấy được snapshot ngân sách theo cách cũ); `budgets` phải gánh luồng phát hiện, hợp thức hóa không thuộc ngân sách |
| C. Tách đôi: sao kê và đối soát ở `budgets`, phát hiện và hợp thức hóa ở T6 | Số liệu tiền gần nguồn, luồng discovery tách                    | Hai nơi, ranh giới phải vẽ cẩn thận                                                                                                                                  |

Khuyến nghị: A, tên `reconciliation`, tầng T6. G9 phải đọc `requests`, `budgets` và ghi `catalog`, `licensing`; chỉ T6 làm được mà không
tạo cạnh ngược. Việc này đổi bảng tầng, nên ADR giữ `Proposed` tới khi Owner xem.

Contract đề xuất, theo mẫu `DepartmentUseContributions` ở `organization/public/organization.extension-points.ts`:

```ts
/** What the statements add to a Cost Center and fiscal year (`FR-5.4`, `QĐ-83a`(4)). */
interface SpendEvidenceReader {
  evidenceOf(
    pairs: readonly { costCenterId: string; year: number }[],
    tx?: DbTx,
  ): Promise<Map<string, { unexplainedSpendMinor: bigint; heldCoveredMinor: bigint }>>;
}
```

`budgets` cộng `unexplainedSpendMinor` vào `spent`, trừ `heldCoveredMinor` khỏi `held` trong phép tính _còn lại_. Module cũng đăng ký vào
`organization.cost-center-use-readers` vì `QĐ-87d`(2) không cho ngừng Cost Center khi còn sao kê chưa đối soát xong.

## Đầu ra

1. So sánh ba phương án trên bằng bằng chứng code: liệt kê chính xác hàm cần gọi cho từng Story, hàm nào đã có, hàm nào phải thêm.
2. Nháp ADR ở `docs/decisions/`, trạng thái `Proposed`, theo mẫu ADR gần nhất.
3. Danh sách sửa nếu chọn A: `scripts/arch/tiers.cjs`, bảng tầng ở `docs/rules/module-structure.md`, ADR-0019.
4. Điền mục `Ownership` của năm spec G9 theo phương án A, ghi rõ Q-08 đang tạm theo khuyến nghị.

## Không làm

Không sửa `tiers.cjs`, không tạo thư mục module, không tạo bảng.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
