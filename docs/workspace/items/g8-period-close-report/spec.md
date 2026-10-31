# Spec: khung — Finance khép kỳ chi phí và phát hành báo cáo bất biến theo vai

- Phụ trách: Dev B (nhánh `hien-dev`).
- Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Thiết kế: `draft`. Owner review: chưa review.
- Nguồn: Docs `d6d868c` (BRD v3.57, US v0.15 — Story/AC ở bảng Primary Story/AC), BE `d6c2112`.
- Nhóm roadmap: G8 — chỉ là planning container, không phải phạm vi của hạng mục này (xem `## Sizing decision`).
- Gói giao việc: B-07/B-08 ([audit 31/10/2026](../../../reviews/roadmap-and-api-gaps-2026-10-31/README.md)).
- [Kế hoạch](plan.md).

## Business outcome

Finance phát hành báo cáo kỳ một lần; bản chụp bất biến theo vai; khoản đến muộn hiện ở báo cáo sau với nhãn điều chỉnh kỳ trước.

## Sizing decision

- Container: G8 (nhóm giao việc, không phải ranh giới hạng mục).
- Mode: `split-story`.
- Outcome and owner: Finance phát hành báo cáo kỳ một lần; bản chụp bất biến theo vai; khoản đến muộn hiện ở báo cáo sau với nhãn điều chỉnh kỳ trước.
- Boundaries: `cost_reports`, `cost_report_lines`; một giao dịch phát hành; không khóa kỳ; cấm phát hành lại.
- Not larger: Không gồm dự báo (`g8-forecast`) ngoài việc đính kèm kết quả đọc.
- Not smaller: Khép kỳ và phát hành là một giao dịch và một bản chụp.
- Siblings: `g8-spend-summary`, `g8-forecast`.
- Scope map: [G8](../../../roadmap.md#work-item-decomposition-g8).

## Primary Story/AC

| Story    | AC         | Coverage | Phần còn lại thuộc                                                                                                        |
| -------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| US-12-14 | AC-1→AC-17 | full     | —                                                                                                                         |
| US-12-10 | AC-9       | partial  | AC-1→AC-7, AC-10, AC-11: `g8-invoice-recording`; AC-8: `g8-invoice-subscription-match`; AC-12: `g9-charge-reconciliation` |

## Supporting references

`FR-5.1`, `QĐ-62m`, `QĐ-66ab`, `QĐ-66ac`, `US-12-09` AC-9, Logical ERD 7.107, 7.108, `LD-10`.

## Explicit out of scope

Bản nháp AI (`US-15-06`, bên AI); AC-12 chỉ giữ vế AI tắt/không dùng được.

## Dependencies and blockers

`g8-spend-summary`. `OQ-F-14` có lựa chọn Logical `LD-10`: khóa (`period_start`, `period_end`).

## Ownership: module, data, API

`budgets` capability `cost-report`; bảng `cost_reports`, `cost_report_lines`.

## Behavior and design

Chưa thiết kế — khung giữ chỗ cho scope map; thiết kế chi tiết khi tới lượt và khi blocker được gỡ. Đối chiếu Logical ERD ở Docs
`d6d868c` trước khi tạo bảng.

## Test matrix

| AC / rủi ro    | Tình huống (gồm từ chối, edge case)                                       | Cấp test                    | Kết quả mong đợi                                     | Bằng chứng sau implement |
| -------------- | ------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| US-12-14 AC-1  | Cam kết khớp thành chi phí (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-2  | Giải phóng phần dư có lý do (chờ thiết kế)                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-3  | Ghi chi phí nội bộ lúc khép kỳ (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-4  | Xem lại phân bổ (chờ thiết kế)                                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-5  | Budget vs Actual trên chi phí thực chịu (chờ thiết kế)                    | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-6  | Dự báo kèm báo cáo (chờ thiết kế)                                         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-7  | Phát hành theo phạm vi vai (chờ thiết kế)                                 | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-8  | Bản chụp bất biến có thời điểm (chờ thiết kế)                             | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-9  | Khoản đến muộn: điều chỉnh kỳ trước (chờ thiết kế)                        | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-10 | Không khóa kỳ (chờ thiết kế)                                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-11 | Finance không phải người duyệt; sai vai bị từ chối (chờ thiết kế)         | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-12 | AI tùy chọn (chờ thiết kế)                                                | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-13 | Thiếu ngân sách và còn lại âm (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-14 | Ngoại lệ đang mở trong bản chụp (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-15 | Audit Trail phát hành (chờ thiết kế)                                      | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-16 | Không phát hành lại cùng một kỳ (chờ thiết kế)                            | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-14 AC-17 | Lời diễn giải chỉ trong bản của Finance và Người duyệt chi (chờ thiết kế) | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |
| US-12-10 AC-9  | Sửa sau khi báo cáo phát hành (chờ thiết kế)                              | theo AC (HTTP + PostgreSQL) | theo AC trong nguồn; ma trận cụ thể viết khi `ready` | chưa chạy                |

Ma trận trên là khung từ tiêu đề AC; tình huống cụ thể được viết lại khi thiết kế chuyển `ready` và trước khi code.

## Definition of Done

- [ ] Mọi primary AC `full` có test đỏ-trước/xanh-sau ở cấp phù hợp; AC `partial` ghi đúng vế đã làm.
- [ ] Gate theo [CONTRIBUTING](../../../../CONTRIBUTING.md) chạy xanh trên revision cuối; HTTP đổi thì e2e + OpenAPI.
- [ ] Spec/plan/roadmap phản ánh implementation cuối; contract đổi đã ghi và báo consumer FE.
- [ ] Không tăng legacy ledger kiến trúc; nếu gỡ được mục nào thì xóa mục đó.
- [ ] Tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.

## Changes and acceptance

31/10/2026: lập khung theo scope map G8 của [roadmap](../../../roadmap.md) ở bước 01. Chưa thiết kế chi tiết, chưa code, chưa review, chưa nghiệm thu.
