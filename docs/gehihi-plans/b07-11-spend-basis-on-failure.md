# B07-11 — Không nhả cam kết khi đã có căn cứ chi

| Gói  | Hạng mục                    | AC                                                          | Loại     | Cổng vào                             |
| ---- | --------------------------- | ----------------------------------------------------------- | -------- | ------------------------------------ |
| B-07 | `g8-spend-basis-on-failure` | `US-06-06` AC-10, AC-12; `US-07-04` AC-15; `US-05-08` AC-10 | `DESIGN` | B07-9 xong; Q-10 đã thống nhất với A |

Lượt đầu chỉ thiết kế. Rủi ro cao: đổi đường nhả cam kết mà `requests` đang dùng ở 7 chỗ.

## Quy tắc nghiệp vụ

- **Căn cứ đã chi:** hóa đơn đã khớp, khoản sao kê đã khớp, chứng từ mua/hợp đồng **đã có hiệu lực và tạo nghĩa vụ thanh toán xác
  định** cho khoản mua của chính Request (`QĐ-84g`). Báo giá, dự thảo, tài liệu chưa chấp nhận **không** phải căn cứ.
- Đóng thất bại hoặc rút khi đã có căn cứ: phần đã chi giữ; phần còn `HELD` chờ hóa đơn hoặc Finance giải phóng phần dư có lý do;
  Finance được báo; Request vẫn `FAILED`/`WITHDRAWN`; seat đã mua thành `G1`; không ghi tiết kiệm.
- Hợp đồng nhiều kỳ không hủy được: giữ đúng **các kỳ nó buộc trả**, kể cả khoản năm tương lai (AC-12).
- Đóng thất bại không có căn cứ: giải phóng như hiện tại (`US-07-04` AC-6).
- Rút khi tác vụ còn chờ thực thi: giải phóng ngay phần chưa chi.

## Nguồn

- AC ở `EP-06.md`, `EP-07.md`, `EP-05.md`; `QĐ-83a`, `QĐ-84g`, `QĐ-77g` ở `../docs/Decisions/project-decisions.md`
- `../docs/ERD/logical/LOGICAL-ERD-INVENTORY.md` mục 7.50; `LOGICAL-ERD-MAPPING.md`
- Spec hạng mục; `g4-request-and-transfer-integration/spec.md` mục Re-audit

## 7 điểm gọi `releaseForRequest`

Thiết kế phải quyết định từng điểm:

| File trong `src/modules/requests/`                            | Lý do               |
| ------------------------------------------------------------- | ------------------- |
| `grant/access-request-grant.listener.ts`, `reportOutcome`     | `GRANT_FAILED`      |
| `grant/access-request-grant.listener.ts`, `reportCancelled`   | `REQUEST_WITHDRAWN` |
| `group-request/group-grant.service.ts`                        | nhóm                |
| `group-request/group-withdrawal-aftermath.service.ts`         | nhóm, có `amounts`  |
| `renewal-apply/renewal-apply.service.ts`                      | `REQUEST_CANCELLED` |
| `request-end/request-end.service.ts`                          | kết thúc Request    |
| `service-account-request/service-account-boundary.service.ts` | `REQUEST_CANCELLED` |

## Thiết kế đề xuất, cần xác nhận

- Bảng `purchase_documents` ở `catalog` theo domain C1, FK DB tới `access_requests` như cách `budget_commitments.request_id` đang
  làm. `catalog` không đọc `access_requests`. Bảng này thuộc vùng A, phải thống nhất Q-10.
- `renewal_decision_id` để A-06 thêm sau, hoặc tạo sẵn nếu A cần; chốt với A. Không làm logic gia hạn.
- Thêm `purchase_document_id` vào `commitment_realizations`, đổi `invoice_line_id` sang nullable, CHECK `num_nonnulls(invoice_line_id, purchase_document_id) = 1`.
- Đặt quy tắc **một chỗ**, trong `CommitmentService.release` ở `budgets`: hỏi `CatalogApi` căn cứ có hiệu lực của Request, tính số
  được nhả bằng hàm thuần `commitment-release.policy.ts`. Cả 7 điểm gọi tự đúng, không rẽ nhánh rải rác ở `requests`.
- Điểm gọi có `amounts` phải được xét riêng vì có thể ném `EXCEEDS_HELD`.
- Ghi chứng từ: `BM-05`, IT Admin ghi báo giá và hợp đồng; quyền theo `US-01-12` AC-10.
- `CommitmentReleaseReason`: có cần lý do mới không.
- Báo Finance: dùng luồng đã làm ở B07-9.

## Test phải có trong matrix

| AC                 | Tình huống                                                              | Đáp án                                                     |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `US-06-06` AC-10   | Chứng từ mua 21tr có hiệu lực, sao kê 21tr, chưa hóa đơn, đóng thất bại | `K1` vẫn `HELD` 21tr, còn lại không tăng                   |
| `US-06-06` AC-12   | Hợp đồng 24 tháng không hủy được, K-2026 `EXPENSED`, K-2027 `HELD`      | K-2027 không nhả                                           |
| `US-07-04` AC-15   | Mua thêm seat có chứng từ, đóng thất bại                                | Request/Assignment `FAILED`, cam kết giữ, Finance được báo |
| `US-05-08` AC-10   | Như trên nhưng rút rồi IT đóng _đã hủy_                                 | `WITHDRAWN`, `K2` không nhả                                |
| Hồi quy AC-3, AC-6 | Không có căn cứ                                                         | Nhả toàn bộ như cũ                                         |
| Không phải căn cứ  | Chỉ có báo giá hoặc dự thảo                                             | Nhả toàn bộ                                                |

Vế sao kê của `QĐ-84g` chờ `g9-charge-reconciliation`; ghi rõ.

## Đầu ra

Cập nhật `spec.md`, `plan.md`, thay câu "Chưa thiết kế". Migration là task riêng. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
