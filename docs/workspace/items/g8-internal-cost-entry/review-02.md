# Review thiết kế: g8-internal-cost-entry

- Hạng mục: `g8-internal-cost-entry` (Finance ghi chi phí phần mềm nội bộ vào đúng một Cost Center).
- Bước thực hiện: 02 — Audit và sửa thiết kế (theo `docs/workspace/prompts/02-review-design.md`).
- Người thực hiện: AI (theo ủy quyền Dev B, nhánh `hien-dev`).
- Ngày review: 03/11/2026.
- Revision đầu vào: Docs `d6d868c`, BE `d6c2112`, tree `hien-dev` sạch.
- Trạng thái hạng mục: Thiết kế đã hoàn thiện và audit (`ready` cho bước lập trình); chưa code, chưa commit.

## 1. Phạm vi và tài liệu đối chiếu

- US nguồn: `US-12-11` (AC-1→AC-11) tại `docs/BE-UserStory/src/EP-12.md`.
- ERD: Logical ERD Inventory 7.106 (`internal_cost_entries`), `LOGICAL-ERD.md`.
- Quyết định liên quan: `FR-5.2`, `FR-5.3`, `INV-03`, `QĐ-49a`, `QĐ-49b`, `QĐ-49g`, `QĐ-50a`, `QĐ-62m`, `QĐ-62o`, `QĐ-86b`, `QĐ-89a`, `LD-11`, `OI-08b`, `Q-06`.
- Codebase và kiến trúc: ADR-0019 (Module tiers), ADR-0016 (Budgets context), `src/modules/budgets/README.md`, `src/modules/budgets/budget/commitment.repo.ts`, `src/modules/budgets/budget/invoice-spend.repo.ts`.

## 2. Bảng tổng hợp Findings

| Mã finding | Mức độ | Vị trí                                    | Căn cứ                                                       | Hậu quả nếu không sửa                                                                                 | Hướng khắc phục                                                                                                                                                         | Tình trạng |
| ---------- | ------ | ----------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **F-01**   | MEDIUM | `spec.md` §3, `plan.md` Task 2            | `US-12-11` AC-11, `FR-5.3`, prompt B07-10                    | Tính phân bổ chi phí vắt năm tài chính trực tiếp trong SQL dễ lỗi date-diff và khó unit test độc lập  | Tách hàm thuần `internal-cost-spend.policy.ts` tính tỷ lệ ngày $D_{intersect}/D_{total}$ và chia dư tất định; `InternalCostSpendRepo` chỉ query candidate và gọi policy | **FIXED**  |
| **F-02**   | HIGH   | `plan.md` Task 3, `spec.md` §Dependencies | ADR-0019 (Public API and Module tiers)                       | `catalog.types.ts` chưa export `ApplicationKind`; `budgets` import nội bộ sẽ làm gate `arch:check` đỏ | Re-export `ApplicationKind` tại `src/modules/catalog/public/catalog.types.ts`; mở `lockApplicationShared` trên `CatalogApi`                                             | **FIXED**  |
| **F-03**   | MEDIUM | `spec.md` §Ownership, `plan.md` Task 1    | Logical ERD 7.106, `rules/database-business.md`              | Thiếu CHECK constraint trên `amount_reporting_minor` có thể dẫn tới lưu số tiền quy đổi 0 hoặc âm     | Bổ sung ràng buộc `CHECK (amount_reporting_minor > 0)` vào migration và schema Prisma                                                                                   | **FIXED**  |
| **F-04**   | HIGH   | `spec.md` §6, `test matrix` AC-9b/c       | `US-12-11` AC-9, `OI-08b`, `SoD-2`                           | Trưởng phòng có thể xem trộm chi phí của phòng khác nếu query không filter chặt ở tầng data/service   | Bắt buộc kiểm tra và filter theo Cost Center IDs mà Trưởng phòng phụ trách tại `internal-cost-query.service.ts`; từ chối 403 nếu cố truy cập ngoài phạm vi              | **FIXED**  |
| **F-05**   | MEDIUM | `spec.md` §1, `plan.md` Task 4            | `src/core/business-date.ts`                                  | Dùng `new Date()` trực tiếp cho cột `DATE` dễ bị lệch ngày do múi giờ server/database                 | Quy định bắt buộc dùng `toDateColumn` khi insert và `fromDateColumn` khi query                                                                                          | **FIXED**  |
| **F-06**   | MEDIUM | `spec.md` §Test matrix, `plan.md` Task 5  | `02-review-design.md`, `test/support/concurrency-harness.ts` | Thiếu test chứng minh an toàn đồng thời và tính nguyên tử khi rollback giao dịch                      | Thêm 2 ca test cụ thể vào test matrix: rollback khi audit fail, và concurrency 2 request ghi/hủy đồng thời                                                              | **FIXED**  |

## 3. Đánh giá tính sẵn sàng cho Bước 03 (Lập trình)

- **Độ bao phủ AC:** Đạt 100% cho `US-12-11` (AC-1→AC-11). Toàn bộ 11 AC đều có ít nhất một dòng kiểm thử cụ thể kèm dữ liệu số thực tế.
- **Phân quyền và SoD:** Rõ ràng, chỉ `FINANCE` ghi/hủy; Trưởng phòng chỉ xem trong phạm vi Cost Center của phòng mình; các vai khác bị từ chối 403.
- **Kiến trúc tầng:** Tuân thủ ADR-0019. Lõi `budget/` giữ repo spend, capability `budgets/internal-cost/` import lõi, không có vòng capability; gọi `catalog` qua `CatalogApi`.
- **Kết luận:** Thiết kế và kế hoạch đủ điều kiện làm đầu vào cho bước 03 (Coding).
