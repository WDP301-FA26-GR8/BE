# Plan thực thi đợt giao Dev B (B-05, B-07, B-08, B-09, B-10)

Bộ plan nhỏ để giao từng lượt cho agent Codex hoặc `gemini-3.8 flash -high`, lập 31/10/2026 trên BE `d6c2112`, Docs `d6d868c`.
Đường dẫn tính từ gốc repo BE. Repo Docs nằm ở `../docs`.

**Bộ này không thay spec.** Nguồn chính vẫn là `docs/workspace/items/<hạng-mục>/spec.md` + `plan.md`, tiến độ ở
`docs/roadmap.md`. Không ghi tiến độ hay kết quả test vào thư mục này.

## Cách chạy một lượt

1. Agent đọc [luật chung](00-agent-rules.md), rồi **đúng một** file plan.
2. Kiểm tra `Cổng vào` của plan. Cổng chưa thỏa thì dừng và báo, không làm.
3. Làm hết plan, chạy typecheck và unit test theo mục `Verify chung` của [luật chung](00-agent-rules.md#verify-chung),
   ghi bằng chứng vào `plan.md` của hạng mục, dừng và bàn giao. HTTP, integration, E2E dồn vào đợt test cuối.
4. Người phụ trách đọc bàn giao rồi mới mở lượt plan tiếp theo.

Mẫu câu lệnh cho agent:

```text
Đọc docs/gehihi-plans/00-agent-rules.md, rồi thực hiện đúng docs/gehihi-plans/<file-plan>.md.
Chỉ làm plan này. Cổng vào chưa thỏa thì dừng và báo cáo. Chưa commit.
```

## Loại plan

| Loại     | Nghĩa                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| `DOCS`   | Chỉ sửa tài liệu                                                                        |
| `AUDIT`  | Chạy lại, ghi bằng chứng; chỉ thêm test và sửa code khi test đỏ cho thấy thiếu          |
| `CODE`   | Thiết kế đã có, implement source + test                                                 |
| `DESIGN` | Hạng mục còn là khung: viết thiết kế và test matrix vào spec/plan, **không code**, dừng |
| `GATED`  | Chưa được bắt đầu; chờ điều kiện ghi trong plan                                         |

Một plan `DESIGN` xong phải được người phụ trách đọc, rồi mới giao phần code ở một lượt mới, dùng lại chính file plan đó.

## Thứ tự

Trạng thái dưới đây là lúc lập bộ plan, không phải tracker.

| #   | Plan                                              | Gói  | Hạng mục                                          | Loại     | Phụ thuộc     | Cổng còn mở           |
| --- | ------------------------------------------------- | ---- | ------------------------------------------------- | -------- | ------------- | --------------------- |
| 0   | [P00](p00-setup-baseline.md)                      | —    | môi trường và mốc                                 | `AUDIT`  | —             | Q-01, Q-03            |
| 1   | [P01](p01-spec-sync.md)                           | —    | áp sửa thiết kế vào spec                          | `DOCS`   | P00           | người phụ trách duyệt |
| 2   | [B05-1](b05-1-evidence-rerun.md)                  | B-05 | `g4-request-and-transfer-integration`             | `AUDIT`  | P00           | —                     |
| 3   | [B05-2](b05-2-transfer-read-for-heads.md)         | B-05 | `g4-request-and-transfer-integration`             | `CODE`   | B05-1         | —                     |
| 4   | [B10-1](b10-1-approval-api-gaps.md)               | B-10 | `g10-approval-api-gaps`                           | `AUDIT`  | P00           | Q-11                  |
| 5   | [B07-1](b07-1-invoice-schema.md)                  | B-07 | `g8-invoice-recording`                            | `CODE`   | P01           | —                     |
| 6   | [B07-2](b07-2-invoice-record.md)                  | B-07 | `g8-invoice-recording`                            | `CODE`   | B07-1         | —                     |
| 7   | [B07-3](b07-3-invoice-tax-lines.md)               | B-07 | `g8-invoice-recording`                            | `CODE`   | B07-2         | —                     |
| 8   | [B07-4](b07-4-invoice-read.md)                    | B-07 | `g8-invoice-recording`                            | `CODE`   | B07-2         | —                     |
| 9   | [B07-5](b07-5-invoice-documents.md)               | B-07 | `g8-invoice-recording`                            | `CODE`   | B07-2         | Q-10                  |
| 10  | [B07-6](b07-6-realization-schema-and-held.md)     | B-07 | `g8-commitment-realization`                       | `CODE`   | B07-2         | —                     |
| 11  | [B07-7](b07-7-spent-one-source.md)                | B-07 | `g8-commitment-realization`                       | `CODE`   | B07-6         | —                     |
| 12  | [B07-8](b07-8-commitment-match.md)                | B-07 | `g8-commitment-realization`                       | `CODE`   | B07-7         | —                     |
| 13  | [B07-9](b07-9-partial-failure-and-credit-note.md) | B-07 | `g8-commitment-realization`                       | `CODE`   | B07-8         | —                     |
| 14  | [B07-10](b07-10-internal-cost-entry.md)           | B-07 | `g8-internal-cost-entry`                          | `DESIGN` | B07-7         | —                     |
| 15  | [B08-6](b08-6-process-performance-report.md)      | B-08 | `g8-process-performance-report`                   | `DESIGN` | P00           | —                     |
| 16  | [B07-11](b07-11-spend-basis-on-failure.md)        | B-07 | `g8-spend-basis-on-failure`                       | `DESIGN` | B07-9         | Q-10                  |
| 17  | [B08-1](b08-1-seat-cost-attribution.md)           | B-08 | `g8-seat-cost-attribution`                        | `DESIGN` | B07-7         | —                     |
| 18  | [B08-2](b08-2-spend-summary.md)                   | B-08 | `g8-spend-summary`                                | `DESIGN` | B08-1, B07-10 | —                     |
| 19  | [B09-0](b09-0-module-placement.md)                | B-09 | quyết định đặt module G9                          | `DESIGN` | B07-7         | —                     |
| 20  | [B09-1](b09-1-statement-import.md)                | B-09 | `g9-statement-import`                             | `DESIGN` | B09-0, B07-2  | Q-10                  |
| 21  | [B09-2](b09-2-discovery-findings.md)              | B-09 | `g9-discovery-findings`                           | `DESIGN` | B09-1         | —                     |
| 22  | [B09-3](b09-3-finding-investigation.md)           | B-09 | `g9-finding-investigation`                        | `DESIGN` | B09-2         | —                     |
| 23  | [B09-4](b09-4-charge-reconciliation.md)           | B-09 | `g9-charge-reconciliation`                        | `DESIGN` | B09-1, B07-8  | —                     |
| 24  | [B09-5](b09-5-finding-legalization.md)            | B-09 | `g9-finding-legalization`                         | `DESIGN` | B09-3, B09-4  | —                     |
| 25  | [B08-3](b08-3-unallocated-cost-line.md)           | B-08 | `g8-unallocated-cost-line`                        | `DESIGN` | B09-4, B08-2  | —                     |
| 26  | [B08-4](b08-4-period-close-report.md)             | B-08 | `g8-period-close-report`                          | `DESIGN` | B08-2         | —                     |
| 27  | [B08-7](b08-7-data-quality-report.md)             | B-08 | `g8-data-quality-report`                          | `DESIGN` | B08-2         | vế usage chờ G7       |
| 28  | [B08-9](b08-9-finance-dashboards.md)              | B-08 | `g8-finance-dashboards`                           | `DESIGN` | B08-2         | A-06, A-10            |
| 29  | [B07-12](b07-12-invoice-subscription-match.md)    | B-07 | `g8-invoice-subscription-match`                   | `DESIGN` | B07-4         | —                     |
| 30  | [B08-5](b08-5-forecast.md)                        | B-08 | `g8-forecast`                                     | `DESIGN` | B08-2         | A-06, chỉ AC-5, AC-7  |
| 31  | [B08-8](b08-8-savings-and-usage-reports.md)       | B-08 | `g8-savings-report`, `g8-usage-efficiency-report` | `GATED`  | B08-2         | G7, A-06              |

Ngày 01/11/2026 Owner trả lời D2, Q-13 và ủy quyền dùng khuyến nghị cho các câu còn lại, xem [02-owner-decisions.md](02-owner-decisions.md).
Cột `Cổng còn mở` nay chỉ còn việc của người khác hoặc câu khuyến nghị không thay được.

## Tài liệu dùng chung

- [00-agent-rules.md](00-agent-rules.md): luật cho mọi lượt.
- [01-design-corrections.md](01-design-corrections.md): lỗi thiết kế đã xác minh trên source, mã `F-*`.
- [02-owner-decisions.md](02-owner-decisions.md): gợi ý cho từng câu, phần Owner cần quyết, plan bị chặn và tin gửi Owner.

## Phạm vi đối chiếu với phiếu giao

| Gói  | Hạng mục do B giữ                                                                                                                                         | Không thuộc B ở đợt này                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| B-05 | `g4-request-and-transfer-integration`; vế `US-01-04` AC-15 của `g2-downstream-integration`                                                                | `US-01-04` AC-8 (B-01); `US-03-06` AC-19 vế khuyến nghị (G7)             |
| B-07 | `g8-invoice-recording`, `g8-commitment-realization`, `g8-spend-basis-on-failure`, `g8-invoice-subscription-match`, `g8-internal-cost-entry`               | `g8-subscription-renewal` (A-06); `US-07-07` điều tra sai lệch (Owner)   |
| B-08 | `g8-seat-cost-attribution`, `g8-spend-summary`, `g8-unallocated-cost-line`, `g8-period-close-report`, `g8-forecast`, các báo cáo, `g8-finance-dashboards` | `g8-role-dashboards-and-alerts` (A-10); engine usage và khuyến nghị (G7) |
| B-09 | `g9-statement-import`, `g9-discovery-findings`, `g9-finding-investigation`, `g9-charge-reconciliation`, `g9-finding-legalization`                         | Story `DEFERRED`: `US-13-02`, `US-13-04`                                 |
| B-10 | `g10-approval-api-gaps`                                                                                                                                   | `g10-mobile-be-integration` (A-07→A-09); `g10-ai-assist`; app native     |

B-01→B-04 không có trong ảnh phân công nên không có plan ở đây; xem Q-11.
