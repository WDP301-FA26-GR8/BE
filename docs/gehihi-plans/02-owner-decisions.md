# Câu hỏi chờ Owner và gợi ý

Rà lại ngày 31/10/2026 trên Docs `d6d868c`, BE `d6c2112`: đọc sổ `QĐ`, BRD v3.57, US, Logical ERD và đối chiếu code.

Gợi ý ở đây là của Dev B cùng AI. Trạng thái từng mã ở mục ngay dưới. Khi có trả lời, ghi vào spec của hạng mục theo mẫu bảng `## Owner dispositions`
ở `docs/workspace/items/g0-g6-final-business-baseline-remediation/spec.md`: mã, trạng thái kèm ngày, câu hỏi, phương án.

`D*` là mã có sẵn trong spec. `Q-*` là mã gom khi lập bộ plan.

## Trả lời của Owner ngày 01/11/2026

Nguồn: Owner nhắn Dev B, Dev B chuyển lại nguyên văn. Owner trả lời tin hỏi riêng D2 và Review 2:

- D2: _"ngày đề xuất hoá đơn oke á"_.
- Review 2: Owner không có `REPORT.md` hay quyết định liên quan.
- Các report và owner decision: _"làm các recommend hoặc thay các decision bằng recommend trước xong rồi cứ note vào docs"_. Code xong Dev B
  review lại, test ổn thì Owner merge; có gì thì làm tiếp.

| Nhãn                            | Nghĩa                                                                                      | Mã                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `Owner trả lời`                 | Owner nói đúng phương án này                                                               | D2; Q-13 (không có Review 2, theo nguồn đã pin) |
| `Tạm theo khuyến nghị`          | Owner ủy quyền chung, chưa xem từng điểm. Plan chạy theo gợi ý; Owner đổi được về sau      | D5, D5a, D6, Q-02, Q-05, Q-07, Q-08, Q-01, Q-03 |
| Chưa thay được                  | Cần người khác làm hoặc trả lời; khuyến nghị không thay được                               | Q-10, Q-11, Q-12, A-06, A-10, G7, bên AI        |
| Chưa thay được: chờ Owner/Dev B | Cần Owner hoặc Dev B quyết định nghiệp vụ trước khi code tiếp; khuyến nghị không thay được | Q-14, Q-15, Q-16                                |

- Agent làm đúng phương án trong bảng, không tự chọn phương án khác.
- Câu hỏi mới phát sinh: agent vẫn dừng và báo. Dev B xin khuyến nghị, ghi vào file này rồi mới chạy tiếp.
- Code ảnh hưởng service ngoài plan: Owner nhắn lúc 15:45 _"fix luôn nha, có gì anh review lại cho, nhớ note cho anh là đc"_. Cách làm và giới hạn ở
  `00-agent-rules.md`, note ở `notes/`. Việc này không bỏ cổng Q-10.
- `Tạm theo khuyến nghị` không phải duyệt hay nghiệm thu. Không ghi thành `Owner approved` hay `accepted`.
- Owner cần đọc kỹ khi review: D6 (chấp nhận rủi ro khớp nhầm), Q-02 (giảm số giữ, đổi hành vi G5), Q-08 (thêm module, đổi bảng tầng).

## Nhóm 1: nguồn đã trả lời

Bộ plan làm theo các dòng này. Chỉ cần báo Owner; Owner bác thì sửa spec và plan tương ứng.

| Mã   | Kết luận                                                                                                                      | Căn cứ                                                                                                                                                                    | Plan          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| D7   | Trưởng phòng cũ và mới xem đủ `BM-04`, gồm căn cứ và bản ghi xác minh                                                         | BRD, bảng biểu mẫu, dòng `BM-04`: người xem là "Super Admin; trưởng phòng cũ/mới; IT Admin — chỉ phần kỹ thuật và ngày hiệu lực"                                          | B05-2         |
| Q-04 | Hóa đơn vào Cost Center của phòng sở hữu thuê bao tại ngày hóa đơn, năm tài chính theo ngày hóa đơn; thực chi tính từ hóa đơn | `FR-5.3`, `FR-5.4`, `QĐ-82l`(1), `US-12-13` AC-3. `CostCenter` có `departmentId`, `linkedAt`, `deactivatedAt` nên tra được theo ngày và không hồi tố                      | B07-1→B07-7   |
| D3   | Bắt buộc tổng dòng bằng giá trước thuế; giảm giá hay làm tròn của nhà cung cấp ghi thành một dòng                             | Nguồn không cấm, là quyết định kỹ thuật. `US-12-13` AC-7 đòi tổng các phần bằng chi phí gốc, lệch thì mất tiền khi quy Cost Center theo dòng                              | B07-2         |
| Q-06 | `OQ-F-10` theo `LD-11`: hủy có lý do rồi ghi lại, lịch sử ở audit. `OQ-F-14` theo `LD-10`: khóa cặp ngày kỳ, cấm kỳ chồng lấn | `99-tail.md` xếp `OQ-F-10` loại `T`, tức thiết kế Logical quyết. `LD-10` nêu rõ không phải chọn tháng hay quý trước                                                       | B07-10, B08-4 |
| Q-09 | Không có mâu thuẫn; thêm luật theo cặp mục đích và đích gắn                                                                   | Bảng mục đích `US-04-04`: _Đính kèm hợp đồng_ cho IT và Finance; _Chứng từ mua `BM-05`_ thì IT gắn báo giá/hợp đồng, Finance gắn hóa đơn. `US-01-12` AC-10 nói về `BM-05` | B07-5         |
| Q-12 | Đề nghị chuyển `US-03-05` AC-3, `US-07-04` AC-5 sang A-10 và `US-07-09` AC-24 sang A-06                                       | Scope map ghi lý do chờ là "bảng điều khiển mục nợ" và "quyết định gia hạn `US-11-03`", không phải phép tính tiền. Cần Owner đổi chủ vì `DEV-B.md` đang ghi ở B-08        | B08-1         |

## Nhóm 2: thuộc quyền Owner, đang theo cột gợi ý

| Mã   | Câu hỏi                                                      | Gợi ý                                                                                                                                                                                            | Lý do                                                                                                                                                                                                                                                | Đánh đổi                                                                                                                                          | Plan                 |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| D2   | Tỷ giá hóa đơn lấy theo ngày nào                             | **Ngày hóa đơn, Owner trả lời 01/11/2026.** Áp cho cả dòng thuế, kể cả khi sửa                                                                                                                   | `QĐ-42b` để ngỏ riêng cho hóa đơn. `FR-5.3` viết "ghi nhận tại ngày hóa đơn", `FR-5.6` viết "thời điểm ghi nhận giao dịch". Cùng hóa đơn luôn ra cùng số dù nhập muộn                                                                                | Finance phải có tỷ giá ngày đó; hệ thống đã cho nhập ngày quá khứ. Câu chữ `US-12-10` AC-7 cũng hiểu được theo ngày nhập. Đổi sau rẻ: một tham số | B07-2                |
| D5   | Ai chọn khoản cam kết để khớp                                | Finance chọn **cho từng dòng hóa đơn**. Số khớp tự tính: min(chi phí dòng, phần còn giữ). Hệ thống từ chối khác nhà cung cấp                                                                     | Logical ERD: `InvoiceLine.commitmentId` 0..1. `FR-5.8`: mỗi hóa đơn chuyển đúng số tiền của nó. Chi phí thật vượt ước tính không bị chặn (`US-12-09` AC-9)                                                                                           | Cần hook từ `requests` vì `budgets` không đọc được Request                                                                                        | B07-8                |
| D5a  | Hóa đơn khác năm tài chính với khoản cam kết                 | Từ chối khớp. Finance nhả khoản cũ có lý do; hóa đơn tính vào năm của nó                                                                                                                         | `FR-5.8`: khoản của một năm khớp hóa đơn các kỳ của năm ấy. Cho khớp khác năm thì _còn lại_ của cả hai năm đều sai                                                                                                                                   | Thanh toán trượt qua năm cần Finance xử lý tay                                                                                                    | B07-8                |
| D6   | Khớp nhầm thì sửa thế nào                                    | Không có hủy khớp. Bù rủi ro bằng kiểm nhà cung cấp và năm                                                                                                                                       | `US-06-06` AC-4; Logical ERD ghi "lũy kế, không giảm"; cột hủy ở Inventory là bản lịch sử. `spent` lấy từ hóa đơn nên khớp nhầm chỉ sai phần _đang giữ_                                                                                              | Credit note **không** gỡ được khớp nhầm. Khoản bị khớp nhầm chỉ nhả được phần dư sau khi Request kết thúc. Owner phải chấp nhận rủi ro này        | B07-8                |
| Q-02 | F35: kỳ nào của giá catalog là dự báo                        | Chỉ với Request nhiều năm tài chính: kỳ sau `Subscription.endDate` có `binding = false`. Không có `endDate` thì giữ ràng buộc                                                                    | `P03-D10` = A đã hoãn việc này tới G8; phương án B ghi sẵn là thêm số tháng cam kết vào bằng chứng giá, gợi ý ở đây là phương án thứ ba. `QĐ-84a`(4). `pricing.policy.ts` đang đặt `binding: true` cho mọi kỳ giá catalog. Request một năm không đổi | Giảm số tiền khoản cam kết nhiều năm, đổi hành vi G5                                                                                              | B08-5, chỉ AC-7      |
| Q-05 | Ai làm `Discrepancy` (`US-07-07` thuộc G7)                   | Owner cho B làm phần tối thiểu ở `licensing`: bảng, mở hồ sơ idempotent theo dòng hóa đơn, đọc trạng thái. Owner giữ điều tra và đóng. Không thì Owner giao contract `openInvoiceMismatch` trước | Bảng thuộc C3 `licensing`, `budgets` gọi xuống được, không cần extension point                                                                                                                                                                       | B chạm phần của Owner, phải chia rõ ranh giới                                                                                                     | B07-12, AC-2 và AC-6 |
| Q-07 | `OOS-24`: Người duyệt chi là người dùng/người trả của hồ sơ  | Làm B09-5 cho mọi ca thường. Riêng ca này API từ chối bằng mã riêng, hồ sơ giữ mở, ghi là giới hạn                                                                                               | `QĐ-66ag`: không đặt người thay thế, nhưng "không đặt ≠ cho phép tự duyệt". Từ chối không tạo quy tắc mới                                                                                                                                            | Ca thật xảy ra thì hồ sơ kẹt tới khi Owner quyết                                                                                                  | B09-5, chỉ ca này    |
| Q-08 | Đặt G9 ở đâu                                                 | Module mới tầng T6 tên `reconciliation`; `budgets` mở `Contributions` để nhận thực chi từ sao kê                                                                                                 | G9 phải đọc `requests`, `budgets` và ghi `catalog`, `licensing`; chỉ T6 làm được mà không tạo cạnh ngược. Mẫu `Contributions` đã có ở `organization`                                                                                                 | Thêm một ADR, sửa `tiers.cjs` và bảng tầng                                                                                                        | B09-1→B09-5          |
| Q-14 | `EXCEEDS_HELD` khi nhóm đã khớp một phần                     | Nhả hệ thống kẹp `takeMinor = min(named, heldOf)` và bỏ qua khoản không còn `HELD`; `planRemainder` của Finance không đổi                                                                        | Khi cam kết nhóm đã chi/khớp một phần, phần giữ còn lại nhỏ hơn phần phân bổ ban đầu của thành viên thất bại/rút, nếu không kẹp sẽ ném `EXCEEDS_HELD` hoặc `NOT_HELD` làm rollback giao dịch                                                         | Thay đổi hành vi giải phóng cam kết nhóm của G5                                                                                                   | B07-9                |
| Q-15 | Finance được báo khi thất bại sau khi chi (`US-06-06` AC-9)  | `BudgetsApi.requestHasSpent` + fact mới ở `requests/status` + mã thông báo in-app mới; làm đường `GRANT_FAILED` trước, `LINE_GRANT_FAILED` sau                                                   | `ACCESS_REQUEST.GRANT_FAILED` hiện chỉ báo người gửi và người thụ hưởng; báo Finance cần kiểm tra thực chi và mã notice in-app mới                                                                                                                   | Mở rộng facade `BudgetsApi`, `StatusFacts` và bảng notification codes                                                                             | B07-9                |
| Q-16 | Credit note, hóa đơn gốc nhiều Cost Center hoặc có dòng null | Dòng không thuê bao để null, không giảm `spent` của Cost Center nào (hướng B08-3)                                                                                                                | Credit note ngoài danh mục không biết quy về phòng ban nào nếu hóa đơn gốc phân tán nhiều Cost Center                                                                                                                                                | Khoản hoàn không vào `spent` của Cost Center cụ thể nào tới khi đối soát/phân bổ ở B08-3                                                          | B07-9                |

Nếu khi review Owner đổi D5, D6, Q-02 hoặc Q-08 thì phải viết lại plan liên quan trước khi giao agent.

## Nhóm 3: quy trình

| Mã   | Việc                                                                                                                                                                                    | Ai       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q-01 | Tạm giữ pin Docs `d6d868c`, BE `d6c2112`. Checkpoint/hạn và phần loại trừ vẫn chưa có. `eb41f9c` trong audit không có trong repo. `origin/dev` có thêm `a49d359`, chỉ sửa script deploy | Owner    |
| Q-03 | Tạm dùng Codex và `gemini-3.8 flash -high`: Gemini làm `AUDIT`, `DOCS`, schema, CRUD; B07-6→B07-8 và B09-4 dùng Codex, có model khác audit bước 02, 04                                  | Owner    |
| Q-10 | Gửi A danh sách thay đổi chỉ-thêm ở `catalog`: đọc thuê bao, gắn tệp vào hóa đơn, mở `COST_STATEMENT`. Chốt ai giữ `purchase_documents`                                                 | Dev B, A |
| Q-11 | Chốt người giữ B-01→B-04. Source chưa có hàng đợi nhu cầu, nên `US-16-03` AC-4 tiếp tục mở                                                                                              | Owner    |
| Q-13 | Đóng 01/11/2026: Owner không có Review 2, làm theo nguồn đã pin. Review 2 chưa được dùng; có file về sau thì đối chiếu lại                                                              | Owner    |

## Phụ thuộc người khác

| Từ     | Cần gì                                                           | Plan                |
| ------ | ---------------------------------------------------------------- | ------------------- |
| A-06   | Sự kiện kết quả gia hạn, đề xuất gia hạn chờ duyệt               | B08-5, B08-8, B08-9 |
| A-10   | Ranh giới với dashboard vận hành, contract tiền cho phần Manager | B08-9               |
| Owner  | G7: usage, coverage, khuyến nghị đã thực hiện                    | B08-7, B08-8        |
| Bên AI | `US-12-14` AC-12, AC-17 chỉ giữ vế AI tắt hoặc không dùng được   | B08-4               |

## Tin báo Owner

```text
Anh ơi, em làm theo khuyến nghị như anh dặn. Đây là các điểm em đang dùng tạm, lúc review anh xem giúp em, chỗ nào không đúng thì em sửa:

1. Khớp cam kết (D5): Finance chọn cho từng dòng hóa đơn, số tiền tự tính, từ chối khác nhà cung cấp.
2. Khác năm tài chính (D5a): từ chối khớp, Finance nhả khoản cũ có lý do.
3. Khớp nhầm (D6): không có hủy khớp theo US-06-06 AC-4. Rủi ro: khoản khớp nhầm chỉ nhả phần dư sau khi Request kết thúc.
4. F35 (Q-02): với Request nhiều năm, kỳ sau ngày kết thúc thuê bao là dự báo. Việc này giảm số giữ của khoản cam kết nhiều năm.
5. Discrepancy (Q-05): em làm phần mở hồ sơ tối thiểu ở licensing, anh giữ điều tra và đóng.
6. OOS-24 (Q-07): ca Người duyệt chi là người dùng/người trả thì API từ chối, hồ sơ giữ mở, ghi là giới hạn.
7. G9 (Q-08): tạo module T6 `reconciliation`, budgets mở Contributions nhận thực chi từ sao kê.
8. Pin Docs d6d868c, BE d6c2112; em dùng Codex và gemini-3.8 flash -high thay cấu hình Opus/Sonnet.

Mấy việc này em cần anh trả lời vì khuyến nghị không thay được:
- Checkpoint/hạn và phần loại trừ của đợt này.
- Ai giữ B-01→B-04.
- Chuyển US-03-05 AC-3, US-07-04 AC-5 sang A-10 và US-07-09 AC-24 sang A-06 được không.
- Q-14 (nhả nhóm kẹp heldOf tránh EXCEEDS_HELD và bỏ qua khoản đã hết), Q-15 (báo Finance khi thất bại sau khi chi), Q-16 (Cost Center credit note dòng null).
```
