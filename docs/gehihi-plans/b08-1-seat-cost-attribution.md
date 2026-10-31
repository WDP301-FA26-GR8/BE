# B08-1 — Quy chi phí về phòng sở hữu thuê bao

| Gói  | Hạng mục                   | AC                                                                | Loại     | Cổng vào   |
| ---- | -------------------------- | ----------------------------------------------------------------- | -------- | ---------- |
| B-08 | `g8-seat-cost-attribution` | `US-12-13` AC-1→10; vế chi phí `US-03-01` AC-12, `US-03-07` AC-10 | `DESIGN` | B07-7 xong |

Cơ sở _theo dòng tiền_ đã có từ B07-2 và B07-7: mỗi dòng hóa đơn chốt Cost Center tại ngày hóa đơn. Plan này làm phần còn lại: cơ sở
_theo kỳ_ và chứng minh các AC. Lượt đầu chỉ thiết kế.

## Quy tắc nghiệp vụ

- Mọi seat, kể cả `G1`, và gói tính tiền chung: 100% về Cost Center `Unit` hiện hành của **phòng sở hữu thuê bao** (`QĐ-89a`).
- Seat **không** đi theo người khi điều chuyển, không chia theo ngày giữa hai phòng (`QĐ-89b`).
- Hai cơ sở: _theo kỳ_ = cộng theo ngày; _theo dòng tiền_ = hóa đơn vào Cost Center của phòng sở hữu **tại ngày hóa đơn**.
- Ngày phòng không có Cost Center hiện hành → dòng _Chưa phân bổ Cost Center_, lý do _phòng chưa hoàn tất cấu hình tài chính_.
  Liên kết Cost Center sau đó **không hồi tố** (`QĐ-87d`).
- Tài khoản dịch vụ theo `Unit` của phòng sở hữu ghi trên Assignment (`QĐ-86c`, `QĐ-89c`).
- Không tỷ lệ phân bổ. `US-04-08`, Cost Center `Company` đã bỏ.
- AC-7: tính lại cho cùng kết quả, tổng các phần bằng chi phí gốc.

## Dữ liệu đã có

- `Subscription.ownerDepartmentId`: bắt buộc, bất biến.
- `CatalogApi.getSubscriptionIdsOwnedBy`, `findSeatTarget`; `LicensingApi.getSeatsHeldInPlans`.
- Hàm tra Cost Center của phòng tại một ngày, thêm ở B07-2.
- `invoice_lines.cost_center_id`, `fiscal_year`, `cost_reporting_minor`.

## Thiết kế phải trả lời

| Chủ đề                  | Câu hỏi                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Hàm thuần               | `budgets/cost-attribution/`, policy theo ngày, không ghi Assignment                                                        |
| Kỳ dịch vụ              | Dòng hóa đơn có `service_period_*` thì chia theo ngày thế nào; dòng thiếu kỳ dịch vụ thì sao                               |
| Không hóa đơn           | Chi phí seat theo kỳ tính từ thuê bao, từ hóa đơn, hay cả hai; tổng theo kỳ phải khớp tổng theo dòng tiền của cùng hóa đơn |
| Làm tròn                | AC-7 đòi tổng các phần bằng chi phí gốc; chia theo ngày phải phân phối phần dư tất định, cùng cách `splitAcrossLines`      |
| Đổi Cost Center giữa kỳ | AC-10: 1–15/10 ở `CC-B`, 16–31/10 vào _Chưa phân bổ_                                                                       |
| Quyền                   | Hệ thống tính, Finance xem, không ai sửa tay                                                                               |

## Không nhận

`US-03-05` AC-3, `US-07-04` AC-5, `US-07-09` AC-24: đề nghị chuyển chủ theo Q-12 (F-18).

## Test phải có trong matrix

Dùng đúng số trong AC: Figma 15 USD/tháng, điều chuyển 16/10, hai lần điều chuyển trong kỳ, 10 seat có 2 seat trống, ngừng Cost
Center ngày 16/10, hóa đơn 05/10 và 20/10, tài khoản dịch vụ `ci-bot`, tính lại hai lần ra cùng số.

## Đầu ra

Cập nhật spec, plan của hạng mục; chuyển chủ `US-03-01` AC-12, `US-03-07` AC-10 trong scope map theo convention. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
