# Spec: khung — Căn cứ đã chi khi Request thất bại hoặc rút: không giải phóng phần đã chi

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8, G4, G5 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07/B-05 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Khi IT Admin đóng tác vụ cấp là thất bại hoặc Request bị rút sau khi đã có căn cứ đã chi (hóa đơn đã khớp, chứng từ mua có hiệu lực), phần đã chi không được giải phóng; Finance được báo; kiểm được bằng số dư khoản cam kết sau khi đóng.

## Sizing decision

- Container: G8, G4, G5 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Khi IT Admin đóng tác vụ cấp là thất bại hoặc Request bị rút sau khi đã có căn cứ đã chi (hóa đơn đã khớp, chứng từ mua có hiệu lực), phần đã chi không được giải phóng; Finance được báo; kiểm được bằng số dư khoản cam kết sau khi đóng.
- Boundaries: Giao dịch đóng tác vụ cấp (`requests` → `budgets`); bảng mới `purchase_documents` (`catalog`); nhánh `FAILED` của `AccessRequestGrantGate.reportOutcome`; quyền IT Admin ghi chứng từ mua (`BM-05`).
- Not larger: Sao kê khớp cam kết thuộc `g9-charge-reconciliation`; hóa đơn khớp thuộc `g8-commitment-realization`.
- Not smaller: Ba Story là ba đường vào của một quy tắc `QĐ-83a`/`QĐ-84g`; tách theo Story sẽ lặp cùng policy và cùng test matrix.
- Siblings: `g8-commitment-realization`, `g4-request-and-transfer-integration`, `g9-charge-reconciliation`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8), [G4](../../../roadmap.md#work-item-decomposition-g4), [G5](../../../roadmap.md#work-item-decomposition-g5).

## Primary Story/AC

| Story    | AC           | Coverage | Phần còn lại thuộc                                                                                                                                             |
| -------- | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-06-06 | AC-10, AC-12 | partial  | AC-1, AC-5, AC-9, AC-11: `g8-commitment-realization`; AC-8: `g9-charge-reconciliation`; AC-2→AC-4, AC-6, AC-7: `g5-commitment-lifecycle`                       |
| US-07-04 | AC-15        | partial  | AC-1→AC-3, AC-6→AC-14: `g4-provisioning-failure-handling`; AC-4, AC-6, AC-12: `g4-request-and-transfer-integration`; AC-5: `g3-downstream-finance-integration` |
| US-05-08 | AC-10        | partial  | AC khác: `g5-request-withdrawal`, `g5-finance-information-request`, `g5-commitment-lifecycle`                                                                  |

## Supporting references

`QĐ-83a`, `QĐ-84g`, `QĐ-77g`, `FR-5.8`, `FR-4.15`, Logical ERD 7.50 `purchase_documents`, `US-01-12` AC-10.

## Explicit out of scope

Luồng đòi hoàn tiền (`QĐ-34`); ghi tiết kiệm; bảng mua cho quyết định gia hạn của `US-11-02` (`renewal_decision_id`).

## Dependencies and blockers

Blocker: chưa có `purchase_documents` và chưa có thao tác ghi chứng từ mua (`BM-05`) gắn Request. Phát hiện ở re-audit 31/10: `reportOutcome` nhả toàn bộ cam kết khi `FAILED` (`src/modules/requests/grant/access-request-grant.listener.ts`). Điều kiện gỡ: `g8-commitment-realization` có `heldMinor` mới. `purchase_documents` đặt ở `catalog` theo domain C1 của Logical ERD.

## Ownership: module, data, API

`catalog` (bảng `purchase_documents`), `budgets` (chính sách giải phóng), `requests` (điểm gọi). Không đổi route hiện có của `provisioning-tasks`.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                          | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ------------------------------------------------------------ | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-06-06 AC-10 | Thất bại khi đã chi nhưng chưa có hóa đơn (chờ thiết kế)     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-06-06 AC-12 | Căn cứ đã chi với khoản cam kết năm tương lai (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-07-04 AC-15 | Đóng thất bại sau khi đã phát sinh chi (chờ thiết kế)        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-05-08 AC-10 | Rút sau khi đã phát sinh chi (chờ thiết kế)                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8, G4, G5 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
