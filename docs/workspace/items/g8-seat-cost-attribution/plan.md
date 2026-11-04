# Plan: Quy chi phí seat và thuê bao về phòng sở hữu; điều chuyển không chuyển chi phí

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026); thiết kế chi tiết B08-1 ngày 04/11/2026.
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `not-started`. PR: chưa có.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Finance xem được chi phí seat và thuê bao quy trọn vẹn 100% về Cost Center hiện hành của phòng sở hữu thuê bao trên cả hai cơ sở (theo dòng tiền và theo kỳ); điều chuyển người giữ seat không chuyển chi phí sang phòng nhận; ngày phòng sở hữu chưa có Cost Center hiện hành được đưa vào dòng Chưa phân bổ kèm lý do cấu hình tài chính chưa hoàn tất; tính lại cho cùng kết quả và bảo toàn chi phí gốc.
- Boundaries: Hàm thuần quy phòng/Cost Center theo ngày và phân bổ theo kỳ (`budgets/cost-attribution`); đọc lịch sử phòng sở hữu và Cost Center theo ngày qua public API `organization` và `catalog`; không ghi đè Assignment, không cập nhật bảng của `licensing` hay `catalog`.
- Not larger: Không dựng bảng tổng chi (`g8-spend-summary`) và không xử lý khoản chưa căn cứ (`g8-unallocated-cost-line`).
- Not smaller: Một quy tắc quy chi phí, một đường kiểm chứng theo ngày.
- Siblings: `g8-spend-summary`, `g8-unallocated-cost-line`, `g3-downstream-finance-integration`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Before coding

Đọc `AGENTS.md`, `CONTRIBUTING.md`, [module structure](../../../rules/module-structure.md), [database rules](../../../rules/database-business.md), [API rules](../../../rules/api-contract.md), và module card `budgets`.
Cổng vào B07-7 đã hoàn tất (HEAD hiện hành đã tích hợp nguồn thực chi từ hóa đơn). Tra cứu Cost Center theo ngày của phòng ban qua `OrganizationHistoryApi.getCostCenterOfDepartmentOn(departmentId, onDate)` đã có sẵn tại `src/modules/organization/public/organization-history.api.ts`. Tra cứu phòng sở hữu của thuê bao qua `CatalogApi.getSubscriptionSummaries(ids)` đã có sẵn trên `CatalogApi`.

## Tasks

### Task 1: Pure policy phân bổ chi phí theo ngày và làm tròn tất định

- Files: `src/modules/budgets/cost-attribution/seat-cost-attribution.policy.ts`, `src/modules/budgets/cost-attribution/seat-cost-attribution.policy.spec.ts`.
- Depends on: none (Cổng vào B07-7 đã thỏa).
- Acceptance: Pure policy nhận vào kỳ dịch vụ, tổng chi phí minor, danh sách các khoảng ngày gắn với Cost Center (hoặc Chưa phân bổ); thực hiện phân bổ theo ngày bằng thuật toán Largest Remainder Method; đảm bảo tổng các phần bằng chính xác chi phí gốc (AC-7); xử lý đúng các ca 1–15/10 ở `CC-B`, 16–31/10 ở Chưa phân bổ (AC-10); không phụ thuộc cơ sở dữ liệu.
- Verify: `node node_modules/jest/bin/jest.js src/modules/budgets/cost-attribution/seat-cost-attribution.policy.spec.ts --runInBand` → pass.

### Task 2: Service và Repository phối hợp tra cứu lịch sử Cost Center và thông tin thuê bao

- Files: `src/modules/budgets/cost-attribution/seat-cost-attribution.service.ts`, `src/modules/budgets/cost-attribution/seat-cost-attribution.types.ts`, `src/modules/budgets/cost-attribution/seat-cost-attribution.service.spec.ts`, `src/modules/budgets/budgets.module.ts`.
- Depends on: Task 1.
- Acceptance: Service tra cứu `ownerDepartmentId` bất biến của thuê bao qua `CatalogApi`, tra cứu Cost Center của phòng tại từng ngày qua `OrganizationHistoryApi.getCostCenterOfDepartmentOn`; gom các khoảng ngày liên tục và gọi policy để tính toán chi phí theo kỳ; xử lý dòng hóa đơn thiếu kỳ dịch vụ (mặc định tháng chứa ngày hóa đơn); hỗ trợ tra cứu chi tiết phân bổ seat cho một dòng hóa đơn hoặc một thuê bao.
- Verify: `node node_modules/jest/bin/jest.js src/modules/budgets/cost-attribution/seat-cost-attribution.service.spec.ts --runInBand` → pass.

### Task 3: Controller HTTP và schema OpenAPI tra cứu phân bổ chi phí

- Files: `src/modules/budgets/cost-attribution/cost-attributions.controller.ts`, `src/modules/budgets/cost-attribution/cost-attribution.dto.ts`, `src/modules/budgets/cost-attribution/cost-attribution.http-errors.ts`, `test/http/budgets/cost-attributions.http-spec.ts`.
- Depends on: Task 2.
- Acceptance: Mở route `GET /budgets/cost-attributions/invoice-lines/:lineId` và `GET /budgets/cost-attributions/subscriptions/:subscriptionId`; phân quyền `FINANCE` xem toàn bộ, trưởng phòng chỉ xem phần rơi vào phòng mình; OpenAPI khai đầy đủ mã lỗi 401, 403, 404, 422; DTO validate Zod chuẩn; không ai sửa tay kết quả.
- Verify: `node node_modules/jest/bin/jest.js test/http/budgets/cost-attributions.http-spec.ts --runInBand` → pass.

### Task 4: Kiểm thử tích hợp và kiểm chứng toàn bộ 10 AC

- Files: `test/integration/budgets/seat-cost-attribution.integration-spec.ts`.
- Depends on: Task 3.
- Acceptance: Kiểm chứng 10 kịch bản AC trên cơ sở dữ liệu tích hợp: seat không đi theo người khi điều chuyển (AC-1), phòng cũ giữ nguyên tháng đã qua (AC-2), hóa đơn theo dòng tiền thuộc Cost Center tại ngày hóa đơn (AC-3), nhiều lần điều chuyển trong kỳ (AC-4), báo cáo đã phát hành không đổi (AC-5), tài khoản dịch vụ không đi theo người (AC-6), tính lại hai lần cùng kết quả và bảo toàn chi phí (AC-7), seat trống và G1 tính 100% cho phòng sở hữu (AC-8), chặn điều chuyển lùi ngày (AC-9), phòng sở hữu chưa có Cost Center thì chi phí vào dòng Chưa phân bổ và không hồi tố (AC-10).
- Verify: Hoãn tới đợt test cuối theo `00-agent-rules.md`.

## Verification and handoff

| Lệnh / kiểm tra AC             | Revision / môi trường | Kết quả thực chạy | Giới hạn / việc còn lại                        |
| ------------------------------ | --------------------- | ----------------- | ---------------------------------------------- |
| `node scripts/check-rules.mjs` | Node 24, Linux        | 0 errors          | Hoàn tất thiết kế chi tiết (Plan DESIGN B08-1) |
| `prettier --check`             | Node 24, Linux        | 0 errors          | Đã format chuẩn spec.md và plan.md             |

- [ ] AC trong scope có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan/test design phản ánh đúng implementation cuối.
- [ ] Diff cuối đã tự review; tài liệu vận hành bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau
      đúng sự kiện thật.
