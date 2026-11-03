# Spec: khung — Bổ sung API Request và ngân sách cho hai Story duyệt trên Mobile

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G10 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-10 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Trưởng phòng và Người duyệt chi đọc đủ dữ liệu của bước (dòng kế hoạch, snapshot chỉ đọc, hai loại việc) qua contract dùng chung web/mobile; không thêm quyết định chỉ-web.

## Sizing decision

- Container: G10 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Trưởng phòng và Người duyệt chi đọc đủ dữ liệu của bước (dòng kế hoạch, snapshot chỉ đọc, hai loại việc) qua contract dùng chung web/mobile; không thêm quyết định chỉ-web.
- Boundaries: Chỉ query/action/DTO của `requests`, `budgets`; không thêm kênh, không endpoint riêng cho mobile.
- Not larger: Không gồm integration và E2E (`g10-mobile-be-integration`, A).
- Not smaller: Hai Story dùng chung một lần rà contract duyệt.
- Siblings: `g10-mobile-be-integration`.
- Scope map: [G10](../../../roadmap.md#work-item-decomposition-g10).

## Primary Story/AC

| Story    | AC               | Coverage | Phần còn lại thuộc                                     |
| -------- | ---------------- | -------- | ------------------------------------------------------ |
| US-16-02 | AC-9             | partial  | AC-1→AC-8: `g10-mobile-be-integration`                 |
| US-16-03 | AC-1, AC-2, AC-4 | partial  | AC còn lại và vế tích hợp: `g10-mobile-be-integration` |

## Supporting references

`QĐ-61b`, `QĐ-61h`, `US-05-04`, `US-06-01`, DEV-A A-08.

## Explicit out of scope

`US-15-05`, `US-15-06`; bulk action; ứng dụng native.

## Dependencies and blockers

Dev B xác nhận 31/10/2026: B-01→B-04 độc lập với các gói được giao, không tính vào phạm vi này. Đối chiếu source: `US-16-02` AC-9 và `US-16-03` AC-1, AC-2 đi trên route đã có (`GET /access-requests/{id}`, `plan-line-suggestions`, `GET /spend-approvals`, `GET /access-requests/{id}/spend-approval`), nên không chặn. Riêng vế _hiện cùng hàng đợi_ của `US-16-03` AC-4 cần danh sách bước nhu cầu: `pageOpenSpendOf` chỉ trả bước chi, nên vế này chỉ đóng được khi có danh sách đó. Chốt với A hai list hay một projection.

## Ownership: module, data, API

`requests` (`spend-approval-view`, `need-decision`), `budgets`.

## Behavior and design

Rà soát contract duyệt cho Mobile dùng chung API web theo B-10:

| AC              | Dữ liệu AC đòi                                                                          | Operation                                            | Trường trả về                                                                                                                                                                                           | Thiếu gì      | Test                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `US-16-02` AC-9 | Số tiền `R1`, dòng gợi ý: phần mềm/gói, số tiền, khoảng mua, trạng thái quá hạn         | `GET /access-requests/{id}`, `plan-line-suggestions` | `pricing.amount` (`amount`, `currency`); dòng gợi ý: `position`, `description`, `plan`, `amount`, `windowFrom`, `windowTo`, `overdue`, `suggested`                                                      | đủ            | `test/integration/requests/spend-need-decision.integration-spec.ts` (AC-12, line 80); `test/integration/requests/spend-finance-review.integration-spec.ts` (line 270)                                              |
| `US-16-02` AC-9 | **Không** có _còn lại_ hay kết quả kiểm tra ngân sách                                   | như trên, vai Manager                                | `GET /access-requests/{id}`: `spend` chỉ có `stage`, `blockedReason`, `financeReturnReason`, `refusalReason`; `plan-line-suggestions` chỉ chứa thông tin dòng kế hoạch, không có `remaining` hay `code` | đủ            | `test/integration/requests/spend-need-decision.integration-spec.ts` (line 95); `test/integration/requests/spend-finance-review.integration-spec.ts` (line 287)                                                     |
| `US-16-03` AC-1 | Nhu cầu đã xác nhận, chi phí, 100tr · 40tr · 20tr · còn lại 40tr · chờ 15tr · thời điểm | `GET /access-requests/{id}/spend-approval`           | `need` (`decidedBy`, `decidedAt`, `reason`), `cost` (`amount`, thuế); snapshot qua `budget-check/years` (`budget`, `spent`, `held`, `remaining`, `pending`) và `budget-check` (`ranAt`)                 | đủ            | `test/integration/requests/spend-approval.integration-spec.ts` (AC-1, line 93-117); `test/http/requests/spend-approvals.http-spec.ts`                                                                              |
| `US-16-03` AC-2 | Lưu snapshot khi quyết, override có lý do, chưa qua Finance thì chưa có bước quyết      | `POST /access-requests/{id}/spend-approval`          | Request body `decision`, `reason`, `override` (`reason`, `years`); lưu `check_id` tại thời điểm quyết; không cho gửi lại snapshot; chưa qua Finance trả 404/409                                         | đủ            | `test/integration/requests/spend-approval.integration-spec.ts` (AC-2, line 220-310); `test/http/requests/spend-approvals.http-spec.ts`; `test/integration/requests/spend-decision-constraints.integration-spec.ts` |
| `US-16-03` AC-4 | Bước nhu cầu hiện cùng hàng đợi, phân biệt được                                         | `GET /spend-approvals`                               | `ApprovalListResponseDto`: chỉ lọc bước `SPEND_APPROVAL` từ `SpendStepRepo.pageOpenSpendOf`; chưa có bước `NEED_DECISION`                                                                               | chặn bởi Q-11 | Vế quyết: `test/integration/requests/spend-need-decision.integration-spec.ts`; vế hàng đợi: chờ gỡ Q-11                                                                                                            |

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)                                            | Cấp test          | Kết quả mong đợi                                                                                   | Bằng chứng sau implement                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-16-02 AC-9 | Mở Request và dòng gợi ý (vai Manager): số tiền R1, dòng gợi ý, ẩn ngân sách   | HTTP, Integration | Thấy số tiền, dòng kế hoạch, trạng thái quá hạn; không thấy còn lại hay mã kiểm tra                | `test/integration/requests/spend-need-decision.integration-spec.ts` (line 80-96); `test/integration/requests/spend-finance-review.integration-spec.ts` (line 275-288) |
| US-16-03 AC-1 | Xem snapshot duyệt chi (Người duyệt chi): nhu cầu, chi phí, số liệu chỉ đọc    | HTTP, Integration | Nhu cầu đã xác nhận, chi phí, số liệu ngân sách 100·40·20·40, chờ 15tr, thời điểm dữ liệu; chỉ đọc | `test/integration/requests/spend-approval.integration-spec.ts` (line 93-117); `test/http/requests/spend-approvals.http-spec.ts`                                       |
| US-16-03 AC-2 | Duyệt/từ chối chi: lưu snapshot lúc quyết, override có lý do, quyền âm         | HTTP, Integration | Quyết định kèm snapshot, override ghi nhận; từ chối thiếu lý do 422; Finance/IT/Employee 403       | `test/integration/requests/spend-approval.integration-spec.ts` (line 220-310); `test/http/requests/spend-approvals.http-spec.ts`                                      |
| US-16-03 AC-4 | Bước nhu cầu của yêu cầu trưởng phòng tự gửi: hàng đợi chung và thao tác quyết | HTTP, Integration | Vế quyết định đúng quy tắc US-05-04; vế hiện cùng hàng đợi spend-approvals chặn bởi Q-11           | Vế quyết: `test/integration/requests/spend-need-decision.integration-spec.ts`; vế hàng đợi: chặn bởi Q-11                                                             |

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G10 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
