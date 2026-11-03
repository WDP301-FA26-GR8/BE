# B07-12 — So ba con số và phân loại chênh lệch

| Gói  | Hạng mục                        | AC                                         | Loại     | Cổng vào                              |
| ---- | ------------------------------- | ------------------------------------------ | -------- | ------------------------------------- |
| B-07 | `g8-invoice-subscription-match` | `US-12-02` AC-1→3, AC-5→7; `US-12-10` AC-8 | `DESIGN` | B07-4 xong; Q-05 tạm theo khuyến nghị |

Chỉ `US-12-02` AC-2, AC-6 cần mở `Discrepancy`. `US-07-07` thuộc G7 của Owner. Q-05 tạm theo khuyến nghị, Owner ủy quyền 01/11/2026: B làm
phần tối thiểu ở `licensing` gồm bảng, mở hồ sơ idempotent theo dòng hóa đơn, đọc trạng thái; Owner giữ điều tra và đóng.

## Làm được ngay

Phần không cần `Discrepancy`, thiết kế trước rồi code ở lượt sau:

- `GET /invoices/{id}/seat-comparison`, `FINANCE`: ba số seat trên hóa đơn, thuê bao, đang dùng, cạnh nhau (`US-12-02` AC-1, vế hiển
  thị). Số thuê bao đọc `CatalogApi`, số đang dùng đọc `LicensingApi.getSeatsHeldInPlans`.
- Chênh lệch thuế/tỷ giá/phí: `US-12-02` AC-5, `US-12-10` AC-8 vế _không mở sai lệch_.
- `US-12-02` AC-3: dòng không khớp là `out_of_catalog`; đã có ở B07-2, chỉ cần test.

Đây là cạnh mới `budgets → licensing`, tầng cho phép. Cập nhật module card và chạy `pnpm arch:graph`.

## Thiết kế phần mở sai lệch

| Chủ đề           | Câu hỏi                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Hai khoảng chênh | Hóa đơn 110 so với thuê bao 100 là sai lệch; thuê bao 100 so với 80 Assignment là `G1`, **không** phải sai lệch     |
| Tách thuế        | Lệch cả thuế lẫn 10 seat: chỉ phần seat mở sai lệch                                                                 |
| Không tự sửa     | Thuê bao và hóa đơn không bị sửa, kiểm bằng test                                                                    |
| Vẫn tính         | AC-6: hóa đơn vẫn vào chi thực tế                                                                                   |
| Contract         | Gợi ý: `openInvoiceMismatch(tx, { subscriptionId, invoiceLineId, systemValue, vendorValue })`, idempotent theo dòng |
| Hướng phụ thuộc  | Bảng thuộc C3 `licensing`, `budgets` gọi xuống qua `LicensingApi`, không cần extension point                        |

AC-7 (đóng sai lệch) thuộc luồng của Owner; B chỉ cần hóa đơn giữ nguyên.

## Đầu ra

Lượt `DESIGN` cập nhật spec/plan, ghi Q-05 vào `## Owner dispositions` của spec. Dừng, không code.
