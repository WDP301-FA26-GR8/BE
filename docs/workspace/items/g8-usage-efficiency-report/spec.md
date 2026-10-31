# Spec: khung — Báo cáo hiệu suất sử dụng theo ứng dụng và phòng ban

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Người có quyền xem hiệu suất sử dụng theo ứng dụng và phòng từ bằng chứng usage có coverage, không suy 0 từ ngày thiếu dữ liệu.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Người có quyền xem hiệu suất sử dụng theo ứng dụng và phòng từ bằng chứng usage có coverage, không suy 0 từ ngày thiếu dữ liệu.
- Boundaries: Chỉ đọc; tiêu thụ evidence/coverage G7 qua public contract.
- Not larger: Không gồm engine phát hiện không dùng (G7, Owner).
- Not smaller: Một báo cáo chỉ đọc.
- Siblings: `g8-savings-report`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-12-05 | AC-1→AC-14 | full     | —                  |

## Supporting references

`FR-5.10`, handoff G7 của Owner.

## Explicit out of scope

Thu thập usage, rule G1→G4.

## Dependencies and blockers

Blocker: chưa có contract usage/coverage của G7 (Owner).

## Ownership: module, data, API

Chốt chỗ đặt khi thiết kế theo [hướng dẫn dev mới](../../../guides/huong-dan-dev-moi.md#3-thêm-x-thì-đặt-ở-đâu): `budgets` không import được `requests`, nên phần cần dữ liệu Request đặt ở `requests` (đã có cạnh `requests → budgets`).

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                       | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | --------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-05 AC-1  | Bốn trạng thái (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-2  | `KPI-3` chia cho số seat đã mua (chờ thiết kế)            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-3  | Ba chỉ số, không gọi nhầm tên (chờ thiết kế)              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-4  | Slot `pending` nằm trong mẫu số (chờ thiết kế)            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-5  | Gói không theo đầu người bị loại (chờ thiết kế)           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-6  | Thiếu bằng chứng (chờ thiết kế)                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-7  | Ẩn kèm lý do (chờ thiết kế)                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-8  | Gói Free (chờ thiết kế)                                   | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-9  | Theo ứng dụng và theo phòng ban (chờ thiết kế)            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-10 | Nhân viên chuyển phòng giữa kỳ (chờ thiết kế)             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-11 | Phạm vi trưởng phòng (chờ thiết kế)                       | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-12 | Không xếp hạng (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-13 | Quyền cấp trong kỳ (chờ thiết kế)                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-05 AC-14 | Không đánh giá lý do, không đánh giá người (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
