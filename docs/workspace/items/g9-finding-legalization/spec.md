# Spec: khung — Người duyệt chi quyết định hợp thức hóa ứng dụng vào danh mục

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `blocked`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G9 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-09 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Người duyệt chi quyết Báo nhầm, Không duyệt hoặc Duyệt hợp thức hóa; ứng dụng vào danh mục và người dùng giữ lại được gán đúng nguồn.

## Sizing decision

- Container: G9 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `single-story`.
- Outcome and owner: Người duyệt chi quyết Báo nhầm, Không duyệt hoặc Duyệt hợp thức hóa; ứng dụng vào danh mục và người dùng giữ lại được gán đúng nguồn.
- Boundaries: `finding_decisions`, `finding_kept_users`; giao dịch ghi danh mục qua `CatalogApi`; snapshot ngân sách.
- Not larger: Không gồm thực hiện thu hồi (`US-07-05`).
- Not smaller: Một quyết định với ba kết quả.
- Siblings: `g9-finding-investigation`, `g9-charge-reconciliation`.
- Scope map: [G9](../../../roadmap.md#work-item-decomposition-g9).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc |
| -------- | ---------- | -------- | ------------------ |
| US-13-06 | AC-1→AC-21 | full     | —                  |

## Supporting references

`FR-3.4c-1`, `SoD-5`, `SoD-7`, `QĐ-66ag`, `QĐ-58d`, `OOS-24`.

## Explicit out of scope

Cổng không kiểm soát được của `US-05-18` (không áp).

## Dependencies and blockers

Blocker: `OOS-24` — chưa có quyết định khi Người duyệt chi là người dùng/người trả của hồ sơ. Owner chốt hoặc giới hạn trước khi thiết kế.

## Ownership: module, data, API

Chốt khi thiết kế G9. Vùng C6 có bảng, nghiệp vụ và vai riêng nên có thể là bounded context mới; khi đó phải sửa `tiers.cjs`, bảng tầng ở `module-structure` và ADR-0019 trước khi code.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                                         | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-13-06 AC-1  | Một quyết định chi duy nhất (chờ thiết kế)                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-2  | Danh mục kèm gói và kiểu cấp (chờ thiết kế)                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-3  | Người đang dùng trên tài khoản công ty có quyền chính thức, không xin lại (chờ thiết kế)    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-4  | Tài khoản cá nhân không thành Assignment (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-5  | Thứ tự (DQ-06) (chờ thiết kế)                                                               | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-6  | Không duyệt chi lần hai (chờ thiết kế)                                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-7  | Business Owner và hồ sơ danh mục (chờ thiết kế)                                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-8  | Đóng bản ghi (chờ thiết kế)                                                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-9  | Chỉ Người duyệt chi quyết (chờ thiết kế)                                                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-10 | Không duyệt (chờ thiết kế)                                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-11 | Không duyệt ⟹ IT Admin xác nhận bàn giao (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-12 | Báo nhầm (chờ thiết kế)                                                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-13 | Mức kiểm soát không chặn hợp thức hóa (chờ thiết kế)                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-14 | Quyết định ghi vào từng khoản chi (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-15 | Hỏi Finance không dừng SLA và không chặn (chờ thiết kế)                                     | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-16 | Audit Trail (chờ thiết kế)                                                                  | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-17 | Không tự hợp thức hóa (chờ thiết kế)                                                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-18 | Số seat do Người duyệt chi nêu; ít hơn số người dùng thì chọn người được giữ (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-19 | Người dùng bằng tài khoản cá nhân được cấp lại trên tài khoản công ty (chờ thiết kế)        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-20 | Ba kết cục; thay bằng công cụ đã có là Không duyệt (chờ thiết kế)                           | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-13-06 AC-21 | Hợp thức hóa cho một phòng; phòng chưa có Cost Center (chờ thiết kế)                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G9 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
