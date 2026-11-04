# Spec: Quy chi phí seat và thuê bao về phòng sở hữu; điều chuyển không chuyển chi phí

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026); thiết kế chi tiết B08-1 ngày 04/11/2026.
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — `US-12-13` AC-1→AC-10; `US-03-01` AC-12, `US-03-07` AC-10 / `US-03-08` AC-10; `FR-5.2`, `FR-5.3`, `FR-5.10`, `QĐ-52a`, `QĐ-55b`, `QĐ-66e`, `QĐ-86c`, `QĐ-87a`, `QĐ-87d`(3), `QĐ-89a`, `QĐ-89b`, `QĐ-89c`, `INV-03`, `INV-14b`, `INV-20`), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance xem được chi phí seat và thuê bao quy trọn vẹn 100% về Cost Center hiện hành của phòng sở hữu thuê bao trên cả hai cơ sở (theo dòng tiền và theo kỳ); điều chuyển người giữ seat không chuyển chi phí sang phòng nhận; ngày phòng sở hữu chưa có Cost Center hiện hành được đưa vào dòng Chưa phân bổ kèm lý do cấu hình tài chính chưa hoàn tất; tính lại cho cùng kết quả và bảo toàn chi phí gốc.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance xem được chi phí seat và thuê bao quy trọn vẹn 100% về Cost Center hiện hành của phòng sở hữu thuê bao trên cả hai cơ sở (theo dòng tiền và theo kỳ); điều chuyển người giữ seat không chuyển chi phí sang phòng nhận; ngày phòng sở hữu chưa có Cost Center hiện hành được đưa vào dòng Chưa phân bổ kèm lý do cấu hình tài chính chưa hoàn tất; tính lại cho cùng kết quả và bảo toàn chi phí gốc.
- Boundaries: Hàm thuần quy phòng/Cost Center theo ngày và phân bổ theo kỳ (`budgets/cost-attribution`); đọc lịch sử phòng sở hữu và Cost Center theo ngày qua public API `organization` và `catalog`; không ghi đè Assignment, không cập nhật bảng của `licensing` hay `catalog`.
- Not larger: Không dựng bảng tổng chi (`g8-spend-summary`) và không xử lý khoản chưa căn cứ (`g8-unallocated-cost-line`).
- Not smaller: Một quy tắc quy chi phí, một đường kiểm chứng theo ngày.
- Siblings: `g8-spend-summary`, `g8-unallocated-cost-line`, `g3-downstream-finance-integration`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-12-13 | AC-1→AC-10 | full     | —                  |

## Supporting references

`QĐ-89a`, `QĐ-89b`, `QĐ-87d`, `FR-5.2`; vế chi phí của G6: `US-03-01` AC-12, `US-03-07` AC-10, `US-07-09` AC-24 (còn ở `g3-downstream-finance-integration`, chuyển chủ khi `ready`).

## Explicit out of scope

Chia chi phí theo tỷ lệ phần trăm giữa các phòng ban (`US-04-08` đã `RETIRED`); chia chi phí seat theo số ngày giữa phòng cũ và phòng mới khi điều chuyển nhân sự (đã bị `QĐ-89b` thay thế); bảng tổng hợp chi phí toàn công ty (`g8-spend-summary`); quy trình xử lý ngoại lệ và bù trừ cho dòng Chưa phân bổ (`g8-unallocated-cost-line`); rà soát quyền nhân sự của trưởng phòng mới (`US-03-07`).

## Dependencies and blockers

Cổng vào B07-7 đã hoàn tất (HEAD hiện hành đã tích hợp nguồn thực chi từ hóa đơn). Tra cứu Cost Center theo ngày của phòng ban qua `OrganizationHistoryApi.getCostCenterOfDepartmentOn(departmentId, onDate)` đã có sẵn tại `src/modules/organization/public/organization-history.api.ts`. Tra cứu phòng sở hữu của thuê bao qua `CatalogApi.getSubscriptionSummaries(ids)` đã có sẵn trên `CatalogApi`.

## Ownership: module, data, API

Module `budgets` (T5), capability mới `cost-attribution/`.

- Logic nghiệp vụ: Pure policy `seat-cost-attribution.policy.ts` và domain service `seat-cost-attribution.service.ts`.
- Không tạo bảng mới; đọc bảng `invoices`, `invoice_lines` của `budgets`; đọc thông tin thuê bao qua `CatalogApi`, đọc Cost Center theo ngày qua `OrganizationHistoryApi`. Không truy vấn trực tiếp bảng của `catalog`, `licensing` hay `organization`.

## Behavior and design

### 1. Nguyên tắc nghiệp vụ cốt lõi

1. **Thuê bao thuộc đúng một phòng sở hữu duy nhất (`QĐ-89a`, `INV-03`):**
   - Mỗi thuê bao phần mềm thương mại có trường `ownerDepartmentId` bất biến, xác định phòng ban chịu trách nhiệm ngân sách và sở hữu hợp đồng.
   - 100% chi phí của thuê bao quy về Cost Center loại `Unit` hiện hành của phòng sở hữu đó, bao gồm:
     - Mọi seat do nhân viên trong phòng sở hữu nắm giữ.
     - Mọi seat do nhân viên phòng khác nắm giữ (kể cả nhân viên đã điều chuyển từ phòng sở hữu sang phòng khác).
     - Mọi seat trống (`G1`), seat đã mua nhưng chưa gán, cấp phát thất bại, hoặc đã thu hồi mà chưa giảm gói với nhà cung cấp (AC-8, `FR-5.10`).
     - Gói tính tiền chung cấp tenant / workspace (flat-rate / package fee).
   - Tuyệt đối không phân bổ tỷ lệ phần trăm (`US-04-08` `RETIRED`), không có Cost Center giữ chỗ `Company`.

2. **Seat không đi theo người khi điều chuyển (`QĐ-89b`, AC-1, AC-4):**
   - Khi nhân viên `E1` giữ seat trên thuê bao của phòng `P-A` điều chuyển công tác sang phòng `P-B`: Toàn bộ chi phí của seat đó trong tháng điều chuyển vẫn thuộc Cost Center của phòng `P-A`. Không chia theo ngày giữa `P-A` và `P-B`, không có phần nào chuyển sang `P-B`.
   - Nếu phòng nhận `P-B` sau điều chuyển vẫn cần công cụ đó: Trưởng phòng `P-B` thực hiện rà soát và gửi Request mới (`US-03-07`, `US-05-21`). Khi được duyệt và cấp phát, seat mới trên thuê bao của `P-B` sẽ tính chi phí cho `P-B` từ ngày cấp mới. Seat cũ trên thuê bao của `P-A` được thu hồi và trở thành `G1` của `P-A` (phòng `P-A` tiếp tục chịu chi phí tới kỳ giảm thuê bao với nhà cung cấp).

3. **Tài khoản dịch vụ không đi theo người (`QĐ-86c`, `QĐ-89c`, AC-6):**
   - Tài khoản dịch vụ (`ci-bot`, service account) đi theo Cost Center `Unit` của phòng sở hữu tài khoản dịch vụ ghi trên Assignment.
   - Khi người chịu trách nhiệm điều chuyển hoặc nghỉ việc, IT Admin chỉ định người chịu trách nhiệm mới thuộc phòng sở hữu (`US-03-08`). Chi phí không bao giờ đổi phòng theo người chịu trách nhiệm sang phòng khác.

4. **Phòng sở hữu chưa có Cost Center hiện hành (`QĐ-87d`(3), `INV-14b`, AC-10):**
   - Tại bất kỳ ngày nào trong kỳ mà phòng sở hữu thuê bao **không có Cost Center hiện hành** (do phòng mới chưa cấu hình Cost Center, hoặc Finance vừa ngừng Cost Center cũ mà chưa liên kết Cost Center mới):
     - Chi phí tương ứng với các ngày đó được đưa vào dòng báo cáo _Chưa phân bổ Cost Center_ (Unallocated Cost Line, `US-12-12`) kèm mã lý do `DEPARTMENT_FINANCIAL_CONFIG_INCOMPLETE` (_phòng chưa hoàn tất cấu hình tài chính_).
     - Hệ thống phát tín hiệu / thông báo cho Finance.
     - Khi Finance liên kết Cost Center mới sau đó: Việc liên kết **không hồi tố**! Khoản chi phí đã rơi vào dòng Chưa phân bổ vẫn giữ nguyên ở dòng Chưa phân bổ.
   - Chiều ngược lại: Nếu nhân viên điều chuyển sang một phòng `P-NEW` chưa có Cost Center hiện hành: Vì seat nằm trên thuê bao của phòng cũ `P-A` (đang có Cost Center), nên toàn bộ chi phí vẫn thuộc `P-A`, không bị rơi vào dòng Chưa phân bổ và điều chuyển không bị chặn.

5. **Không có điều chuyển lùi ngày (`QĐ-66e`, AC-9):**
   - Ngày hiệu lực điều chuyển không được trước ngày hôm nay (`US-03-01` AC-16), do đó không bao giờ làm thay đổi chi phí của các ngày đã qua.

6. **Báo cáo đã phát hành là bất biến (`US-12-14`, AC-2, AC-5):**
   - Sau khi kỳ chi phí được Finance khép kỳ và phát hành báo cáo, các con số chi phí không bị viết lại bởi bất kỳ sự kiện nhân sự hay thay đổi liên kết Cost Center nào diễn ra sau đó.

### 2. Hai cơ sở tính toán chi phí

1. **Cơ sở theo dòng tiền (Cash basis / Invoice date basis - AC-3):**
   - Đã được định hình ở cấp dòng hóa đơn trong `g8-invoice-recording` (`invoice_lines.cost_center_id`).
   - Chi phí dòng hóa đơn quy về Cost Center của phòng sở hữu thuê bao **tại chính ngày hóa đơn** (`invoice_date`), và ghi nhận vào năm tài chính chứa ngày hóa đơn.
   - Cơ sở này không chia nhỏ theo ngày. Dù nhân viên điều chuyển giữa tháng, mọi hóa đơn phát sinh trong tháng của thuê bao phòng `P-A` đều thuộc Cost Center của `P-A` tại ngày lập hóa đơn.

2. **Cơ sở theo kỳ (Accrual / Service period basis - AC-1, AC-7, AC-8, AC-10):**
   - Dành cho báo cáo chi phí theo kỳ (tháng, quý, năm) và theo dõi chi phí sử dụng seat thực tế theo thời gian.
   - Thuật toán phân bổ theo ngày:
     - Xác định kỳ dịch vụ: Dòng hóa đơn có `service_period_start` và `service_period_end`. Nếu dòng thiếu kỳ dịch vụ (null), mặc định kỳ dịch vụ là toàn bộ tháng chứa `invoice_date`.
     - Tổng số ngày của kỳ dịch vụ là $D_{total} = \text{days}(\text{service\_period\_start}, \text{service\_period\_end})$.
     - Duyệt từng ngày $d \in [\text{service\_period\_start}, \text{service\_period\_end}]$:
       - Tra cứu phòng sở hữu `ownerDepartmentId` của thuê bao từ `CatalogApi`.
       - Tra cứu Cost Center hiện hành của phòng tại ngày $d$ qua `OrganizationHistoryApi.getCostCenterOfDepartmentOn(ownerDepartmentId, d)`.
       - Gán ngày $d$ vào Cost Center tương ứng (hoặc đánh dấu `UNALLOCATED` nếu không có Cost Center).
     - Gom các ngày liên tiếp cùng đích thành các khoảng $I_k$ có độ dài $d_k$ ngày ($\sum d_k = D_{total}$).
     - Phân bổ số tiền $M$ minor unit cho các khoảng $I_k$ theo giải thuật phân phối phần dư tất định (Largest Remainder Method).

### 3. Thuật toán làm tròn tất định bảo toàn chi phí gốc (AC-7)

Để thỏa mãn AC-7 ("tính lại cho cùng kết quả và tổng các phần bằng chi phí gốc, không mất, không đếm hai lần"):

```ts
/**
 * Distributes minor units deterministically across intervals using Largest Remainder Method.
 * Guarantees sum(allocated) === totalMinor and 100% reproducible result.
 */
export function allocateMinorAcrossIntervals(
  totalMinor: bigint,
  intervals: readonly { id: string; days: number; startDate: BusinessDate }[],
): Map<string, bigint> {
  const totalDays = intervals.reduce((sum, item) => sum + item.days, 0);
  if (totalDays === 0) return new Map();

  const baseAllocations = new Map<string, bigint>();
  const remainders: { id: string; remainder: bigint; startDate: string }[] = [];

  let allocatedSum = 0n;
  for (const interval of intervals) {
    const numerator = totalMinor * BigInt(interval.days);
    const quotient = numerator / BigInt(totalDays);
    const rem = numerator % BigInt(totalDays);
    baseAllocations.set(interval.id, quotient);
    allocatedSum += quotient;
    remainders.push({ id: interval.id, remainder: rem, startDate: interval.startDate.toISOString() });
  }

  const surplus = totalMinor - allocatedSum;
  // Sort descending by remainder, tie-breaker: earlier start date, then target ID
  remainders.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder > a.remainder ? 1 : -1;
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return a.id.localeCompare(b.id);
  });

  for (let i = 0; i < Number(surplus); i++) {
    const targetId = remainders[i].id;
    baseAllocations.set(targetId, (baseAllocations.get(targetId) ?? 0n) + 1n);
  }

  return baseAllocations;
}
```

### 4. Thiết kế thành phần mã nguồn (budgets/cost-attribution)

- `src/modules/budgets/cost-attribution/seat-cost-attribution.policy.ts`: Pure policy xử lý gom ngày, phân bổ số tiền, phân loại khoảng hợp lệ và khoảng Chưa phân bổ. Không I/O, không gọi cơ sở dữ liệu.
- `src/modules/budgets/cost-attribution/seat-cost-attribution.types.ts`: Các cấu trúc dữ liệu cho kết quả phân bổ chi phí theo kỳ (`AttributedCostSlice`, `AttributionDailyBreakdown`, `CostAttributionQuery`).
- `src/modules/budgets/cost-attribution/seat-cost-attribution.service.ts`: Use case service phối hợp nạp dữ liệu từ `invoice_lines`, gọi `CatalogApi` lấy phòng sở hữu, gọi `OrganizationHistoryApi` lấy Cost Center theo ngày, gọi policy tính toán và trả kết quả.
- `src/modules/budgets/cost-attribution/cost-attributions.controller.ts`: Controller cung cấp API cho Finance tra cứu chi tiết phân bổ seat của hóa đơn hoặc thuê bao theo kỳ:
  - `GET /budgets/cost-attributions/invoice-lines/{lineId}`: Tra cứu chi tiết phân bổ của một dòng hóa đơn.
  - `GET /budgets/cost-attributions/subscriptions/{subscriptionId}`: Tra cứu chi tiết phân bổ seat của một thuê bao trong kỳ.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                                                                                                          | Cấp test           | Kết quả mong đợi                                                                                                                             | Bằng chứng sau implement |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| US-12-13 AC-1  | `E1` giữ seat Figma 15 USD/tháng trên thuê bao của `P-A`, chuyển sang `P-B` hiệu lực 16/10. Xem theo kỳ tháng 10. `P-B` gửi Request mới được cấp ngày 20/10. | unit + integration | Toàn bộ 15 USD tháng 10 thuộc Cost Center của `P-A`; 0 USD vào `P-B`. Seat mới của `P-B` tính cho `P-B` từ 20/10; seat cũ là `G1` của `P-A`. | chưa chạy                |
| US-12-13 AC-2  | Báo cáo tháng 09 của `P-A` có Figma của `E1` 15 USD. `E1` điều chuyển hiệu lực 16/10.                                                                        | unit + integration | Chi phí tháng 09 của `P-A` giữ nguyên 15 USD, không viết lại sang `P-B`.                                                                     | chưa chạy                |
| US-12-13 AC-3  | Thuê bao Figma của `P-A`, hóa đơn ngày 05/10 (trước ngày chuyển) và hóa đơn ngày 20/10 (sau ngày chuyển). Xem theo dòng tiền.                                | unit + integration | Cả hai hóa đơn đều thuộc Cost Center của `P-A` tại ngày hóa đơn; cơ sở này không chia theo ngày.                                             | chưa chạy                |
| US-12-13 AC-4  | `E1` giữ seat trên thuê bao của `P-A`, chuyển `P-A` → `P-B` ngày 10/10 rồi `P-B` → `P-C` ngày 20/10. Tính theo kỳ tháng 10.                                  | unit               | Mọi ngày tháng 10 của seat đó thuộc `P-A`, không ngày nào thuộc `P-B` hay `P-C`.                                                             | chưa chạy                |
| US-12-13 AC-5  | Báo cáo tháng 09 của `P-A` đã phát hành. `E1` điều chuyển sang `P-B` hiệu lực 16/10.                                                                         | unit + integration | Báo cáo tháng 09 và mọi số liệu tháng 09 của `P-A` không đổi.                                                                                | chưa chạy                |
| US-12-13 AC-6  | Tài khoản dịch vụ `ci-bot` thuộc `P-DES` (`CC-DES`) do `E1` phụ trách. `E1` chuyển sang `P-FIN`, IT Admin chỉ định `E3` thay. `P-FIN` cần cấp `ci-bot` mới.  | unit + integration | Chi phí `ci-bot` cũ 100% thuộc `CC-DES`. Quyền mới của `P-FIN` cấp 16/11 tính vào `CC-FIN` từ 16/11; `ci-bot` cũ là `G1` của `CC-DES`.       | chưa chạy                |
| US-12-13 AC-7  | Tính lại hai lần với cùng dữ liệu thuê bao, phòng sở hữu, Cost Center và hóa đơn lẻ (100 USD chia 31 ngày).                                                  | unit               | Hai lần cho cùng kết quả; tổng các phần chính xác bằng 100 USD (10.000 cents), không mất, không lệch 1 minor unit nào.                       | chưa chạy                |
| US-12-13 AC-8  | Thuê bao Figma 10 seat × 15 USD = 150 USD của `P-DES`. Có 7 seat người `P-DES` giữ, 1 seat `E1` chuyển sang `P-FIN`, 2 seat trống (`G1`).                    | unit               | Toàn bộ 150 USD thuộc Cost Center của `P-DES`; 2 seat trống (30 USD) vẫn tính cho `P-DES` và hiện là `G1` ở báo cáo hiệu suất.               | chưa chạy                |
| US-12-13 AC-9  | Hôm nay 15/10, Super Admin ghi điều chuyển `E1` sang `P-B` lùi ngày hiệu lực về 01/10.                                                                       | HTTP + unit        | Thao tác bị từ chối với lỗi ngày hiệu lực không được trước hôm nay (`US-03-01` AC-16); chi phí 01–14/10 của `P-A` không đổi.                 | chưa chạy                |
| US-12-13 AC-10 | Thuê bao Figma 10 seat của `P-B`. Ngừng `CC-B` ngày 16/10; liên kết `CC-B2` ngày 05/11. `E1` chuyển vào `P-NEW` chưa có Cost Center.                         | unit + integration | Chi phí 1–15/10 ở `CC-B`; 16–31/10 vào Chưa phân bổ lý do chưa cấu hình tài chính; 16/10–04/11 không hồi tố; seat của `E1` vẫn ở `P-A`.      | chưa chạy                |

## Cần báo người khác

1. **Báo Dev A (Catalog & Licensing):**
   - Thay đổi chỉ-thêm trên `CatalogApi`: Đã sử dụng `CatalogApi.getSubscriptionSummaries(ids)` để lấy `ownerDepartmentId` bất biến của thuê bao. Không yêu cầu sửa đổi schema hay table của `catalog`.
   - Phối hợp với `LicensingApi`: Để tính toán chi phí theo kỳ khi chưa có hóa đơn (cho báo cáo dự phóng hoặc usage efficiency), `LicensingApi` cần cung cấp hàm chỉ-đọc tra cứu số seat thực tế và seat trống `G1` của thuê bao theo ngày. Dev B sẽ tạo note đề xuất hàm chỉ-đọc `getSeatsHeldInPlans(planIds)` khi triển khai code.
2. **Báo Owner:**
   - Xác nhận chuyển chủ đề xuất theo Q-12 (`US-03-05` AC-3, `US-07-04` AC-5 sang A-10 và `US-07-09` AC-24 sang A-06). Không sửa scope map trực tiếp trong lượt này, ghi nhận ranh giới.
   - Ghi nhận `Q-04`: Hóa đơn chốt Cost Center của phòng sở hữu tại ngày hóa đơn (`invoice_lines.cost_center_id`), đã áp dụng từ B07-2.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

04/11/2026: hoàn thiện tài liệu thiết kế chi tiết (Plan B08-1) bao gồm 2 cơ sở (theo dòng tiền và theo kỳ), thuật toán chia dư tất định (Largest Remainder Method), tích hợp dòng Chưa phân bổ khi phòng thiếu Cost Center, và ma trận kiểm thử chi tiết 10 AC; chưa Owner review.

31/10/2026: ghi rõ cơ sở theo dòng tiền đã được giải quyết ở hạng mục `g8-invoice-recording` theo `docs/gehihi-plans/01-design-corrections.md`; chưa Owner review.

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
