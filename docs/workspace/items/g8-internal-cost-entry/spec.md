# Spec: Finance ghi chi phí phần mềm nội bộ vào đúng một Cost Center

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026); audit và sửa thiết kế B07-10 ngày 03/11/2026.
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — `US-12-11` AC-1→AC-11; `FR-5.2`, `FR-5.3`, `INV-03`, `QĐ-49a`, `QĐ-49b`, `QĐ-49g`,
  `QĐ-50a`, `QĐ-62m`, `QĐ-62o`, `QĐ-86b`, `QĐ-89a`; Logical ERD 7.106, `LD-11`, `HO-75`, `HO-132`), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/DEV-B.md)).
- [Kế hoạch](plan.md).
- [Audit thiết kế (Bước 02)](review-02.md).

## Business outcome

Finance ghi khoản chi phí xây dựng hoặc vận hành cho phần mềm nội bộ gán vào đúng một Cost Center `Unit`; số tiền quy đổi theo
tỷ giá chốt tại thời điểm ghi nhận và cộng vào thực chi của Cost Center đó; không sinh hóa đơn, thuê bao, nhà cung cấp, cam kết
hay bước duyệt chi; hủy được khoản sai kèm lý do; trưởng phòng xem được trong thực chi của phòng mình; khoản dài hơn kỳ báo cáo
được chia đều theo thời gian ở cơ sở theo kỳ.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance ghi chi phí phần mềm nội bộ vào đúng một Cost Center; capability `budgets/internal-cost`.
- Boundaries: một transaction ghi `internal_cost_entries` + audit `INTERNAL_COST.RECORDED`; hủy ghi audit
  `INTERNAL_COST.CANCELLED`; chỉ `FINANCE` thao tác ghi và hủy; đọc Cost Center qua `OrganizationApi`, đọc loại ứng dụng
  qua `CatalogApi`, tỷ giá chốt đọc qua `FinanceApi`.
- Not larger: không gồm chiều tổng hợp báo cáo tổng chi (`g8-spend-summary`), khép kỳ và điều chỉnh kỳ trước
  (`g8-period-close-report`), đối soát sao kê (`g9-charge-reconciliation`), hay đăng ký phần mềm nội bộ (`US-05-20`).
- Not smaller: bảng `internal_cost_entries`, API ghi/hủy/đọc, và tích hợp vào công thức `spent` của lõi `budgets/budget`
  phải đi liền nhau để số liệu Budget vs Actual phản ánh đúng ngay khi ghi nhận.
- Siblings: `g8-invoice-recording`, `g8-commitment-realization`, `g8-spend-summary`, `g8-period-close-report`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-12-11 | AC-1→AC-11 | full     | —                  |

## Supporting references

- `FR-5.2`: chi phí phần mềm nội bộ ghi vào thực chi của đúng Cost Center.
- `FR-5.3`: cơ sở theo kỳ chia đều chi phí theo thời gian cho các kỳ nó bao phủ.
- `INV-03`: viết lại theo `QĐ-89a` — không có phân bổ theo tỷ lệ ở bất kỳ đâu trong hệ thống.
- `QĐ-49a`, `QĐ-49b`, `QĐ-49g`: chi phí phần mềm nội bộ không có hóa đơn; mỗi khoản gán đúng một Cost Center.
- `QĐ-50a`: Finance ghi không sinh bước phê duyệt của Người duyệt chi, không sinh cam kết.
- `QĐ-62m`: kỳ đã phát hành báo cáo thì không khóa ghi nhận; báo cáo cũ bất biến, khoản ghi muộn thành điều chỉnh kỳ trước.
- `QĐ-62o`: phần mềm nội bộ ngoài MVP cho tính năng đo usage và tiết kiệm.
- `QĐ-86b`: `Company` là gốc tổ chức, không phải Cost Center.
- `QĐ-89a`: cấm phân bổ chi phí theo tỷ lệ.
- `Logical ERD 7.106`: cấu trúc thực thể `internal_cost_entries`.
- `LD-11` (Q-06 trong `02-owner-decisions.md`): sửa sai bằng cách hủy có lý do (`cancel_reason`, `cancelled_at`) rồi ghi lại; lịch sử ghi ở Audit Trail.
- `OI-08b`: trưởng phòng chỉ thấy thực chi + cam kết đang giữ của phòng mình, không thấy còn lại hay toàn công ty.

## Explicit out of scope

- Phân bổ theo tỷ lệ: không tồn tại thao tác hay trường tỷ lệ (AC-3, `QĐ-89a`).
- Cost Center `Company`: từ chối mọi yêu cầu gán vào `Company` (AC-4, `QĐ-86b`).
- Phần mềm thương mại / SaaS: từ chối, chi phí thương mại phải đi qua hóa đơn (AC-5, `US-12-02`).
- Tạo hóa đơn, thuê bao, nhà cung cấp, hợp đồng, khoản cam kết: tuyệt đối không tạo (AC-1).
- Bước phê duyệt: Người duyệt chi không duyệt khoản chi nội bộ (AC-8).
- Trình bày báo cáo đã phát hành và dòng điều chỉnh kỳ trước: thuộc `g8-period-close-report` (`US-12-14`, AC-10).
- Trình bày màn hình tổng chi toàn công ty / chi tiết phòng: thuộc `g8-spend-summary` (`US-12-01`, AC-9).

## Dependencies and blockers

- **Cổng vào:** `g8-commitment-realization` (B07-7 xong) — đã thỏa.
- **Blocker:** Không còn blocker chặn thiết kế. `OQ-F-10` đã chốt theo `LD-11` và `Q-06` (`02-owner-decisions.md`).
- **Dependencies kỹ thuật:**
  - `CatalogApi`: cần hàm kiểm tra `kind === 'INTERNAL'`. `CatalogApi` mở `lockApplicationShared(tx, applicationId)` và `src/modules/catalog/public/catalog.types.ts` re-export `ApplicationKind` (F-02), ghi note báo Dev A.
  - `OrganizationApi`: dùng `lockCostCentersShared` để kiểm tra Cost Center tồn tại, là `UNIT` và đang `ACTIVE`.
  - `FinanceApi`: dùng `parseMoney` và `snapshotMoney` tại ngày phát sinh (`period_start`) để chốt tỷ giá sang tiền tệ báo cáo; thiếu tỷ giá đúng ngày thì từ chối (`QĐ-42b`).
  - Lõi `budgets/budget`: đặt repo đọc tổng chi phí nội bộ (`InternalCostSpendRepo`) và policy phân bổ ngày (`internal-cost-spend.policy.ts`) trong lõi để `CommitmentRepo.totals` đọc trực tiếp, tránh vòng phụ thuộc capability (F-01).

## Owner dispositions

| Mã        | Trạng thái kèm ngày                     | Câu hỏi                                                 | Phương án                                                                                                                                                                      |
| --------- | --------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OQ-F-09` | Đã đóng (theo nguồn)                    | Khoản có kỳ dài hơn kỳ báo cáo tính vào các kỳ thế nào? | Căn cứ `FR-5.3`: cơ sở _theo kỳ_ chia đều theo thời gian cho các kỳ nó bao phủ (AC-11).                                                                                        |
| `OQ-F-10` | Tạm theo khuyến nghị (01/11/2026, Q-06) | Cách sửa sai khoản chi phí nội bộ đã ghi?               | Theo `LD-11`: hủy có lý do (`cancelled_at`, `cancel_reason`) rồi ghi lại khoản mới; toàn bộ lịch sử ghi nhận và hủy lưu ở Audit Trail. Khoản đã hủy tự động loại khỏi `spent`. |

## Ownership: module, data, API

- Capability mới: `budgets/internal-cost/`, thuộc module `budgets` (T5).
  - Controller: `internal-costs.controller.ts`
  - Services: `internal-cost.service.ts` (ghi và hủy), `internal-cost-query.service.ts` (đọc danh sách, chi tiết có lọc quyền Trưởng phòng - F-04)
  - Repo: `internal-cost.repo.ts` (thao tác bảng `internal_cost_entries`, dùng `toDateColumn`/`fromDateColumn` chuẩn hóa ngày - F-05)
  - DTO: `internal-cost.dto.ts`
  - Errors: `internal-cost.errors.ts`, `internal-cost.http-errors.ts`
- Lõi `budgets/budget/`:
  - Repo: `internal-cost-spend.repo.ts` (tổng hợp chi phí nội bộ chưa hủy theo Cost Center và năm tài chính, phục vụ `CommitmentRepo.totals`)
  - Policy: `internal-cost-spend.policy.ts` (hàm thuần tính tỷ lệ giao cắt ngày theo năm tài chính - F-01)
  - Policy: `internal-cost-split.policy.ts` (hàm thuần tính chia đều theo thời gian cho các kỳ báo cáo - AC-11)
- Bảng mới trong `prisma/models/budgets.prisma` (Logical ERD 7.106):
  `internal_cost_entries`

```prisma
model InternalCostEntry {
  id                     String          @id @default(uuid(7)) @db.Uuid
  organizationId         String          @map("organization_id") @db.Uuid
  applicationId          String          @map("application_id") @db.Uuid
  costCenterId           String          @map("cost_center_id") @db.Uuid
  amountCurrency         String          @map("amount_currency") @db.Char(3)
  periodStart            DateTime        @map("period_start") @db.Date
  periodEnd              DateTime        @map("period_end") @db.Date
  amountMinor            BigInt          @map("amount_minor")
  amountRate             Decimal         @map("amount_rate") @db.Decimal(20, 10)
  amountRateDate         DateTime        @map("amount_rate_date") @db.Date
  amountRateSource       PriceRateSource @map("amount_rate_source")
  amountReportingMinor   BigInt          @map("amount_reporting_minor")
  note                   String?         @db.Text
  cancelReason           String?         @map("cancel_reason") @db.Text
  recordedAt             DateTime        @default(now()) @map("recorded_at") @db.Timestamptz(3)
  cancelledAt            DateTime?       @map("cancelled_at") @db.Timestamptz(3)
  recordedByEmployeeId   String          @map("recorded_by_employee_id") @db.Uuid

  organization Organization @relation(fields: [organizationId], references: [id])
  application  Application  @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  costCenter   CostCenter   @relation(fields: [costCenterId], references: [id], onDelete: Restrict)
  currency     Currency     @relation(fields: [amountCurrency], references: [code], onDelete: Restrict)

  @@index([applicationId, periodStart])
  @@index([costCenterId, periodStart])
  @@map("internal_cost_entries")
}
```

Ràng buộc SQL (CHECK) trong migration:

- `internal_cost_entries_period_order`: `period_end >= period_start`
- `internal_cost_entries_cancel_whole`: `(cancelled_at IS NULL AND cancel_reason IS NULL) OR (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL)`
- `internal_cost_entries_amount_positive`: `amount_minor > 0`
- `internal_cost_entries_amount_reporting_positive`: `amount_reporting_minor > 0` (F-03)

- API Operations:

| Operation                          | Vai                          | Mục đích                                                                                         |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /internal-costs`             | `FINANCE`                    | Ghi khoản chi phí phần mềm nội bộ (AC-1→AC-8)                                                    |
| `GET /internal-costs`              | `FINANCE`, `DEPARTMENT_HEAD` | Danh sách tóm tắt, phân trang, lọc theo `costCenterId`, `applicationId`, khoảng ngày, trạng thái |
| `GET /internal-costs/{id}`         | `FINANCE`, `DEPARTMENT_HEAD` | Chi tiết một khoản chi phí nội bộ (AC-9: trưởng phòng chỉ xem của phòng mình)                    |
| `POST /internal-costs/{id}/cancel` | `FINANCE`                    | Hủy một khoản chi phí nội bộ có lý do (`cancelReason`) theo LD-11                                |

## Behavior and design

### 1. Luồng ghi nhận chi phí nội bộ (`POST /internal-costs`)

- **Bước 1 — Phân quyền:** Guard kiểm tra vai trò. Chỉ `FINANCE` được thực hiện. Các vai khác (`IT_ADMIN`, `DEPARTMENT_HEAD`, `SPENDING_APPROVER`, `SUPER_ADMIN`) trả về `403 Forbidden` (AC-8). Không sinh bất kỳ bước duyệt hay task nào cho Người duyệt chi.
- **Bước 2 — Validate DTO:** Body gồm:
  - `applicationId` (UUID)
  - `costCenterId` (UUID)
  - `amount` (string định dạng tiền tệ, dương)
  - `currency` (mã 3 chữ cái in hoa)
  - `periodStart` (BusinessDate `YYYY-MM-DD`)
  - `periodEnd` (BusinessDate `YYYY-MM-DD`, buộc `>= periodStart`)
  - `note` (optional string)
  - _Không có trường tỷ lệ hay phân bổ:_ schema từ chối nếu truyền thêm trường lạ (`strip` hoặc `strict`), không có API phân bổ theo tỷ lệ (AC-3, `QĐ-89a`).
- **Bước 3 — Khóa và kiểm tra Cost Center:** Trong transaction, gọi `OrganizationApi.lockCostCentersShared(tx, [costCenterId])`:
  - Nếu Cost Center không tồn tại: trả về lỗi `INTERNAL_COST.COST_CENTER_NOT_FOUND` (404, AC-6).
  - Nếu mã là `Company` hoặc loại không phải `UNIT`: trả về lỗi `INTERNAL_COST.COST_CENTER_INVALID` (422, AC-4, `QĐ-86b`).
  - Nếu Cost Center ở trạng thái `INACTIVE`: trả về lỗi `INTERNAL_COST.COST_CENTER_INACTIVE` (409).
- **Bước 4 — Khóa và kiểm tra Phần mềm nội bộ:** Trong transaction, gọi `CatalogApi.lockApplicationShared(tx, applicationId)`:
  - Nếu phần mềm không tồn tại: trả về lỗi `INTERNAL_COST.APPLICATION_NOT_FOUND` (404).
  - Nếu `application.kind !== 'INTERNAL'` (ví dụ SaaS thương mại Figma): từ chối với lỗi `INTERNAL_COST.APPLICATION_NOT_INTERNAL` (422, AC-5). Chi phí phần mềm thương mại chỉ ghi qua hóa đơn (`US-12-02`).
- **Bước 5 — Quy đổi tiền tệ và snapshot tỷ giá:**
  - Parse số tiền qua `FinanceApi.parseMoney({ amount, currency }, tx)`.
  - Snapshot tỷ giá qua `FinanceApi.snapshotMoney(tx, money, periodStart)`. Ngày tỷ giá là ngày bắt đầu kỳ phát sinh chi phí (`periodStart`).
  - Nếu kết quả là `MISSING_RATE`: từ chối với lỗi `INTERNAL_COST.RATE_MISSING` (409, AC-7, `QĐ-42b`: thiếu tỷ giá đúng ngày thì từ chối, không lấy tỷ giá gần nhất).
  - Nhận về: `amountReportingMinor`, `amountRate`, `amountRateDate`, `amountRateSource`. Số tiền quy đổi được đóng băng vĩnh viễn, không quy đổi lại khi xem.
- **Bước 6 — Lưu dữ liệu:**
  - Thêm bản ghi mới vào `internal_cost_entries` sử dụng `toDateColumn` cho các cột `DATE` để đảm bảo độc lập múi giờ (F-05).
  - Ghi Audit Trail sự kiện `INTERNAL_COST.RECORDED` trong cùng transaction với thay đổi dữ liệu.
  - Tuyệt đối không tạo dòng hóa đơn, thuê bao, hợp đồng, nhà cung cấp hay khoản cam kết nào (AC-1).

### 2. Luồng hủy khoản chi phí sai (`POST /internal-costs/{id}/cancel`)

- **Bước 1 — Phân quyền:** Chỉ `FINANCE` được gọi.
- **Bước 2 — Validate DTO:** Body yêu cầu `{ reason: string }` (không được để trống).
- **Bước 3 — Khóa bản ghi:** `tx.internalCostEntry.findUniqueOrThrow` kèm khóa cập nhật (`FOR UPDATE`).
  - Nếu không tìm thấy: `404 Not Found`.
  - Nếu bản ghi đã có `cancelled_at IS NOT NULL`: từ chối `INTERNAL_COST.ALREADY_CANCELLED` (409).
- **Bước 4 — Cập nhật hủy:**
  - Ghi `cancelled_at = now()`, `cancel_reason = reason`.
  - Ghi Audit Trail sự kiện `INTERNAL_COST.CANCELLED` chứa lý do hủy và thông tin người hủy trong cùng transaction.
  - Sau khi hủy, khoản này tự động bị loại khỏi mọi phép tính thực chi (`spent`) của Cost Center.

### 3. Tích hợp thực chi (`spent`) trong lõi `budget/`

Căn cứ thiết kế một nguồn thực chi của B07-7, công thức thực chi tổng quát của một Cost Center trong năm tài chính:

```text
spent(Cost Center, năm) = tổng invoice_lines.cost_reporting_minor
                         + tổng internal_cost_entries.amount_reporting_minor (phần thuộc năm, chưa hủy)
deductibleVat(Cost Center, năm) = tổng invoice_lines.deductible_vat_reporting_minor
held(Cost Center, năm)         = tổng (amount − released − realized) của cam kết HELD gắn ngân sách
còn lại                        = ngân sách − spent − held
```

- **Vị trí Repo & Policy:**
  - Tạo `InternalCostSpendRepo` trong lõi `src/modules/budgets/budget/` để `CommitmentRepo.totals` đọc trực tiếp mà không import capability `internal-cost/` (tránh vòng phụ thuộc capability).
  - Tách hàm thuần `internal-cost-spend.policy.ts` (F-01) để tính số tiền thuộc năm tài chính theo ngày giao cắt:
    - Tổng số ngày $D = \text{periodEnd} - \text{periodStart} + 1$.
    - Số ngày giao giữa kỳ và năm tài chính $Y$ là $D_Y$.
    - Nếu $D_Y = D$: 100% thuộc năm đó.
    - Nếu vắt qua hai năm tài chính: số tiền năm $Y = \lfloor \text{amountReportingMinor} \times \frac{D_Y}{D} \rfloor$. Phần dư làm tròn phân bổ tất định cho năm cuối cùng để tổng các năm luôn bằng đúng `amountReportingMinor`.
- **Khoản chưa hủy:** Chỉ tính các bản ghi có `cancelled_at IS NULL`.

### 4. Khoản có kỳ dài hơn kỳ báo cáo (AC-11)

- Policy thuần `internal-cost-split.policy.ts`:
  - Nhận vào: khoản chi phí nội bộ (`amountReportingMinor`, `periodStart`, `periodEnd`) và danh sách các kỳ báo cáo (ví dụ các quý trong năm).
  - Với cơ sở _theo kỳ_: chia đều theo tỷ lệ thời gian mà khoản đó bao phủ (AC-11: chi phí vận hành năm 2027 120tr cho cả năm từ 01/01 đến 31/12/2027 thì mỗi quý nhận đúng 30tr).
  - Tổng số tiền phân bổ qua 4 quý chính xác bằng 120tr; không dồn hết vào quý ghi nhận.
  - Phục vụ trực tiếp cho báo cáo chi tiêu `g8-spend-summary` và khép kỳ `g8-period-close-report`.

### 5. Kỳ đã phát hành báo cáo (AC-10)

- Khi Finance ghi thêm khoản chi phí nội bộ cho một kỳ đã phát hành báo cáo (ví dụ ngày 05/10 ghi cho Q3):
  - Bảng `internal_cost_entries` không bị khóa. Khoản được lưu bình thường.
  - Báo cáo Q3 đã phát hành là bản snapshot bất biến trong `cost_reports` (`g8-period-close-report`), giữ nguyên số liệu cũ không đổi.
  - Khoản ghi muộn này sẽ xuất hiện ở kỳ báo cáo tiếp theo với nhãn _điều chỉnh kỳ trước_ (`prior_period_adjustment`).

### 6. Quyền đọc của Trưởng phòng (AC-9, `OI-08b`, F-04)

- Endpoint `GET /internal-costs` và `GET /internal-costs/{id}`:
  - Nếu người gọi là `FINANCE`: xem được mọi khoản của mọi Cost Center.
  - Nếu người gọi là `DEPARTMENT_HEAD`:
    - Hệ thống tra cứu các phòng ban mà nhân viên này đang làm trưởng phòng có hiệu lực thông qua `OrganizationApi.getEmployeeHeadDepartments`.
    - Lấy danh sách Cost Center IDs tương ứng của các phòng ban đó.
    - Query `internal_cost_entries` buộc thêm điều kiện `costCenterId IN (ownedCostCenterIds)`.
    - Nếu cố tình truy cập chi tiết (`GET /internal-costs/{id}`) của Cost Center phòng khác: trả về lỗi `403 Forbidden` (hoặc `404 Not Found`).
    - Dữ liệu hiển thị giúp trưởng phòng thấy rõ cấu phần thực chi của phòng, nhưng không cung cấp số _còn lại_ hay số toàn công ty (`OI-08b`).

### 7. Đồng thời, khóa và transaction

- Thứ tự khóa khi ghi nhận khoản chi nội bộ:
  1. Khóa chia sẻ Cost Center: `OrganizationApi.lockCostCentersShared(tx, [costCenterId])`
  2. Khóa chia sẻ ứng dụng: `CatalogApi.lockApplicationShared(tx, applicationId)`
  3. Khóa chia sẻ tổ chức bên trong `FinanceApi.snapshotMoney(tx, ...)`
     Không lấy khóa nào khác sau đó.
- Khi hủy khoản: Khóa dòng `internal_cost_entries` bằng `FOR UPDATE` theo id.
- Giao dịch tuân thủ tính nguyên tử: bất kỳ lỗi nào xảy ra trong transaction (lỗi snapshot, lỗi audit...) đều rollback toàn bộ.

### 8. Danh mục mã lỗi ổn định (Stable HTTP Errors)

| HTTP Status | Error Code                               | Lý do                                                                                              | AC         |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------- |
| 403         | `FORBIDDEN`                              | Vai trò không có quyền thực hiện (không phải Finance ghi/hủy, hoặc Trưởng phòng đọc ngoài phạm vi) | AC-8, AC-9 |
| 404         | `INTERNAL_COST.COST_CENTER_NOT_FOUND`    | Cost Center không tồn tại trong danh mục                                                           | AC-6       |
| 404         | `INTERNAL_COST.APPLICATION_NOT_FOUND`    | Ứng dụng không tồn tại trong danh mục                                                              | AC-1       |
| 404         | `INTERNAL_COST.NOT_FOUND`                | Khoản chi phí nội bộ không tồn tại                                                                 | —          |
| 409         | `INTERNAL_COST.RATE_MISSING`             | Không có tỷ giá chốt cho ngày phát sinh chi phí                                                    | AC-7       |
| 409         | `INTERNAL_COST.ALREADY_CANCELLED`        | Khoản chi phí nội bộ đã bị hủy trước đó                                                            | OQ-F-10    |
| 409         | `INTERNAL_COST.COST_CENTER_INACTIVE`     | Cost Center đã ngừng hoạt động                                                                     | AC-6       |
| 422         | `INTERNAL_COST.COST_CENTER_INVALID`      | Cost Center là mã Company hoặc không phải loại UNIT                                                | AC-4       |
| 422         | `INTERNAL_COST.APPLICATION_NOT_INTERNAL` | Ứng dụng là phần mềm thương mại/SaaS, không phải phần mềm nội bộ                                   | AC-5       |
| 422         | `INTERNAL_COST.PERIOD_INVALID`           | `periodEnd` nhỏ hơn `periodStart`                                                                  | —          |
| 422         | `INTERNAL_COST.AMOUNT_INVALID`           | Số tiền nhỏ hơn hoặc bằng 0                                                                        | —          |
| 422         | `VALIDATION_ERROR`                       | DTO không hợp lệ hoặc truyền trường tỷ lệ phân bổ                                                  | AC-3       |

## Test matrix

| AC / rủi ro        | Tình huống (gồm từ chối, edge case)                                                                                    | Cấp test           | Kết quả mong đợi                                                                                                                                                            | Bằng chứng sau implement |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| US-12-11 AC-1      | Finance ghi khoản 40.000.000 VND cho tháng 10/2026 gán `CC-ENG` phần mềm nội bộ _Cổng báo cáo nội bộ_                  | HTTP + integration | HTTP 201 Created; thực chi tháng 10 của `CC-ENG` tăng 40tr; không có bản ghi hóa đơn, thuê bao, nhà cung cấp hay cam kết nào được tạo                                       | chưa chạy                |
| US-12-11 AC-2      | Muốn chia 40tr tỷ lệ 60/40 giữa `CC-ENG` và `CC-DES`: Finance ghi 2 khoản riêng (24tr cho `CC-ENG`, 16tr cho `CC-DES`) | HTTP + integration | Cả 2 khoản lưu thành công; mỗi khoản thuộc đúng một Cost Center; tổng thực chi 2 Cost Center tăng 40tr                                                                      | chưa chạy                |
| US-12-11 AC-3      | Finance gửi payload có trường tỷ lệ `allocationRatio: 0.6` hoặc gọi thao tác phân bổ tỷ lệ                             | HTTP               | Bị từ chối với lỗi `VALIDATION_ERROR` (422); hệ thống không có endpoint hay trường phân bổ tỷ lệ                                                                            | chưa chạy                |
| US-12-11 AC-4a     | Phần mềm nội bộ toàn công ty: Finance gán khoản 50tr vào `CC-ENG` (phòng vận hành)                                     | HTTP + integration | HTTP 201 Created; khoản lưu thành công gán vào `CC-ENG` loại `UNIT`                                                                                                         | chưa chạy                |
| US-12-11 AC-4b     | Finance chọn mã hoặc id của `Company` làm Cost Center                                                                  | HTTP               | Bị từ chối với lỗi `INTERNAL_COST.COST_CENTER_INVALID` (422), `Company` không phải Cost Center                                                                              | chưa chạy                |
| US-12-11 AC-5      | Finance chọn ứng dụng Figma (`kind === 'SAAS'`) để ghi chi phí nội bộ 15tr                                             | HTTP               | Bị từ chối với lỗi `INTERNAL_COST.APPLICATION_NOT_INTERNAL` (422); chi phí phần mềm thương mại chỉ qua hóa đơn                                                              | chưa chạy                |
| US-12-11 AC-6      | Finance gán khoản vào Cost Center không tồn tại `CC-Z`                                                                 | HTTP               | Bị từ chối với lỗi `INTERNAL_COST.COST_CENTER_NOT_FOUND` (404); không khoản nào được lưu                                                                                    | chưa chạy                |
| US-12-11 AC-7a     | Ghi khoản 1.000 USD ngày 15/10/2026, tỷ giá chốt ngày đó là 25.000 VND/USD                                             | HTTP + integration | Quy đổi thành 25.000.000 VND, `amount_reporting_minor = 25000000`, tỷ giá lưu bất biến cùng bản ghi; không quy đổi lại khi xem                                              | chưa chạy                |
| US-12-11 AC-7b     | Ghi khoản 1.000 USD vào ngày không có tỷ giá chốt trong hệ thống                                                       | HTTP               | Bị từ chối với lỗi `INTERNAL_COST.RATE_MISSING` (409); không tự động lấy tỷ giá ngày gần nhất                                                                               | chưa chạy                |
| US-12-11 AC-8a     | IT Admin, Trưởng phòng, Người duyệt chi hoặc Super Admin gọi `POST /internal-costs`                                    | HTTP               | Trả về `403 Forbidden`; không ghi nhận dữ liệu                                                                                                                              | chưa chạy                |
| US-12-11 AC-8b     | Finance ghi thành công khoản nội bộ 40tr                                                                               | integration        | Kiểm tra hàng đợi duyệt: không có Request hay Approval nào sinh ra cho Người duyệt chi                                                                                      | chưa chạy                |
| US-12-11 AC-9a     | Finance xem Budget vs Actual của `CC-ENG` năm 2026 sau khi ghi khoản 40tr                                              | integration        | Số thực chi (`spent`) chứa đủ 40tr                                                                                                                                          | chưa chạy                |
| US-12-11 AC-9b     | Trưởng phòng `H2` của `P-ENG` (`CC-ENG`) xem thực chi phòng mình                                                       | HTTP               | Thấy khoản 40tr trong thực chi phòng mình; không thấy số _còn lại_, không thấy kết quả kiểm tra ngân sách hay số của phòng khác                                             | chưa chạy                |
| US-12-11 AC-9c     | Trưởng phòng `H1` của `P-DES` cố truy cập khoản chi phí nội bộ của `CC-ENG`                                            | HTTP               | Bị từ chối `403 Forbidden` (F-04)                                                                                                                                           | chưa chạy                |
| US-12-11 AC-10     | Báo cáo Q3 đã phát hành; ngày 05/10 Finance ghi thêm khoản 10tr cho Q3 (kỳ 01/07–30/09)                                | HTTP + integration | Khoản ghi thành công (201); báo cáo Q3 đã lưu trong `cost_reports` giữ nguyên không đổi; khoản sẵn sàng cho nhãn điều chỉnh kỳ trước                                        | chưa chạy                |
| US-12-11 AC-11     | Ghi chi phí vận hành năm 2027 120tr gán `CC-ENG` (kỳ 01/01/2027–31/12/2027)                                            | unit + integration | Chính sách chia kỳ tính ra mỗi quý nhận đúng 30tr; tổng 4 quý bằng 120tr; spent năm 2027 nhận đủ 120tr không bị dồn cục                                                     | chưa chạy                |
| OQ-F-10 (LD-11)    | Hủy khoản 40tr với lý do "Ghi nhầm Cost Center"                                                                        | HTTP + integration | `cancelled_at` và `cancel_reason` được cập nhật; sinh audit `INTERNAL_COST.CANCELLED`; thực chi `spent` của Cost Center lập tức giảm 40tr                                   | chưa chạy                |
| Rủi ro CHECK DB    | Cố ý insert SQL trực tiếp với `period_end < period_start`, thiếu lý do hủy, hoặc `amount_reporting_minor <= 0`         | integration        | Bị chặn bởi CHECK constraint của PostgreSQL (`internal_cost_entries_period_order`, `internal_cost_entries_cancel_whole`, `internal_cost_entries_amount_reporting_positive`) | chưa chạy                |
| Concurrency (F-06) | Hai request ghi đồng thời cùng Cost Center và Application dùng `ConcurrencyHarness`                                    | integration        | Hoàn thành an toàn, không deadlock, cả hai khoản ghi nhận đúng vào DB                                                                                                       | chưa chạy                |
| Rollback (F-06)    | Lỗi ghi nhận Audit Trail sau khi lưu bảng `internal_cost_entries` trong transaction                                    | integration        | Giao dịch rollback hoàn toàn; không có dòng rác nào lưu lại trong bảng `internal_cost_entries`                                                                              | chưa chạy                |

## Open questions

Danh sách câu hỏi kỹ thuật còn lại, chưa tự quyết:

1. **Q-B07-10-1 (Quy ước tên cột người ghi):**
   - _Bối cảnh:_ Logical ERD 7.106 định nghĩa cột là `recorded_by_app_user_id`. Tuy nhiên, toàn bộ codebase `budgets` hiện hành (như `invoices`, `budget_versions`) đều dùng quy ước `recorded_by_employee_id`.
   - _Đề xuất:_ Dùng `recorded_by_employee_id` để đồng nhất nội bộ module `budgets`, ghi mapping với Logical ERD trong tài liệu bàn giao. Cần Owner/Tech lead xác nhận.
2. **Q-B07-10-2 (Người hủy trên bảng dữ liệu):**
   - _Bối cảnh:_ `LD-11` bổ sung hai cột `cancelled_at` và `cancel_reason`. Logical ERD 7.106 không có cột `cancelled_by`. Người hủy hiện được lưu trong Audit Trail (`INTERNAL_COST.CANCELLED`).
   - _Đề xuất:_ Giữ đúng schema Logical ERD 7.106 (không thêm cột `cancelled_by_employee_id`), truy vết người hủy qua Audit Trail.
3. **Q-B07-10-3 (Mốc ngày lấy tỷ giá chốt cho khoản có khoảng kỳ):**
   - _Bối cảnh:_ Khoản nội bộ có `period_start` và `period_end`.
   - _Đề xuất:_ Lấy tỷ giá chốt tại ngày `period_start` (ngày bắt đầu phát sinh chi phí), phù hợp với quy tắc tỷ giá ngày phát sinh (`QĐ-89a`).

## Definition of Done

- [ ] Mọi primary AC `US-12-11` AC-1→AC-11 có test đỏ-trước/xanh-sau ở cấp phù hợp.
- [ ] Migration tạo bảng `internal_cost_entries` và CHECK constraints chạy chuẩn xác, `pnpm test:gates` xanh.
- [ ] Công thức `spent` trong lõi `budgets/budget` cộng dồn chính xác chi phí nội bộ chưa hủy, loại trừ khoản đã hủy.
- [ ] Contract OpenAPI được export đầy đủ ví dụ, mã lỗi và cập nhật manifest.
- [ ] Không vi phạm giới hạn kiến trúc tầng và ranh giới module (`pnpm arch:check` xanh).
- [ ] Spec, plan và test matrix phản ánh đúng implementation cuối cùng.

## Changes and acceptance

- 31/10/2026: Lập khung theo scope map G8 của roadmap ở bước 01.
- 03/11/2026: Hoàn thiện toàn bộ thiết kế chi tiết (spec) cho hạng mục B07-10 (`g8-internal-cost-entry`).
- 03/11/2026: Audit thiết kế theo prompt 02, đóng 6 findings (F-01→F-06), cập nhật `review-02.md`, spec sẵn sàng cho bước 03. Thiết kế giữ trạng thái `draft`.
