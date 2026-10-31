# Spec: khung — Ghép dòng hóa đơn về thuê bao, ba con số seat và phân loại chênh lệch

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance thấy cạnh nhau số seat trên hóa đơn, thuê bao và đang dùng; chênh lệch chỉ do thuế/tỷ giá ghi riêng, lệch số lượng/đơn giá mở sai lệch; thuê bao không bị tự sửa.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Finance thấy cạnh nhau số seat trên hóa đơn, thuê bao và đang dùng; chênh lệch chỉ do thuế/tỷ giá ghi riêng, lệch số lượng/đơn giá mở sai lệch; thuê bao không bị tự sửa.
- Boundaries: Đọc `invoice_lines`, thuê bao (`CatalogApi`) và Assignment (`LicensingApi`); ghi phân loại chênh lệch; mở hồ sơ sai lệch theo contract `US-07-07`.
- Not larger: Không chuyển cam kết thành chi phí (`g8-commitment-realization`) và không điều tra sai lệch (`US-07-07`, Owner).
- Not smaller: So ba con số và phân loại chênh lệch là một quyết định trên cùng một dòng hóa đơn.
- Siblings: `g8-invoice-recording`, `g8-commitment-realization`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC                   | Coverage | Phần còn lại thuộc                                                                                                 |
| -------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| US-12-02 | AC-1→AC-3, AC-5→AC-7 | partial  | AC-4, AC-8: `g8-commitment-realization`; AC-9: `g8-invoice-recording`                                              |
| US-12-10 | AC-8                 | partial  | AC-1→AC-7, AC-10, AC-11: `g8-invoice-recording`; AC-9: `g8-period-close-report`; AC-12: `g9-charge-reconciliation` |

## Supporting references

`FR-5.4`, `FR-5.13`, `FR-7.7`, `QĐ-49f`, `US-07-07`.

## Explicit out of scope

Điều tra và đóng sai lệch (`US-07-07`, phân công Owner); import hóa đơn trước khi `OQ-F-03` đóng.

## Dependencies and blockers

Blocker: chưa có bảng/contract sai lệch vì `US-07-07` thuộc G7 của Owner (cần contract mở sai lệch); `OQ-F-03` chặn phần import. Điều kiện gỡ: Owner chốt contract `Discrepancy`.

## Ownership: module, data, API

`budgets` capability `invoice`; đọc qua `CatalogApi`, `LicensingApi`. Chốt API khi `ready`.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro   | Tình huống (gồm từ chối, edge case)                          | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| ------------- | ------------------------------------------------------------ | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-02 AC-1 | Ba con số (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-02 AC-2 | Không tự sửa (chờ thiết kế)                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-02 AC-3 | Không ghép được (chờ thiết kế)                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-02 AC-5 | Chỉ lệch do thuế: không mở sai lệch (chờ thiết kế)           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-02 AC-6 | Lệch số lượng: mở sai lệch, hóa đơn vẫn tính (chờ thiết kế)  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-02 AC-7 | Nhà cung cấp tính sai (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-10 AC-8 | Chênh lệch thuế tách khỏi chênh lệch số lượng (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
