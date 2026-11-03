# Note 03: Bổ sung tra cứu và khóa ứng dụng trong CatalogApi cho Dev A

- **Người thực hiện:** Dev B (nhánh `hien-dev`).
- **Hạng mục nguồn:** B07-10 (`g8-internal-cost-entry`).
- **Module tác động:** `catalog` (`src/modules/catalog/public/catalog.api.ts`, `src/modules/catalog/public/catalog.types.ts`).

## 1. Lý do sửa

Hạng mục B07-10 (`US-12-11` AC-5) yêu cầu kiểm tra phần mềm được ghi nhận chi phí nội bộ phải là phần mềm nội bộ (`kind === 'INTERNAL'`), từ chối nếu là SaaS/Licensed thương mại, và khóa hàng chia sẻ (`FOR SHARE`) trong transaction để tránh bị chuyển `RETIRED` trong lúc ghi nhận.

`ApplicationLookupService` của `catalog` đã có hàm `lockShared(tx, id)`, nhưng `CatalogApi` (facade public của `catalog`) chưa mở phương thức này và `public/catalog.types.ts` chưa định nghĩa các kiểu `ApplicationKind`, `CatalogStatus`, `LockedApplication`.

## 2. Phần đã sửa

1. `src/modules/catalog/public/catalog.types.ts`:
   - Thêm định nghĩa các type: `ApplicationKind = 'SAAS' | 'LICENSED' | 'INTERNAL'`, `CatalogStatus = 'APPROVED' | 'RETIRED'`, và interface `LockedApplication`.
2. `src/modules/catalog/public/catalog.api.ts`:
   - Mở phương thức `lockApplicationShared(tx: DbTx, applicationId: string): Promise<LockedApplication | null>` ủy quyền gọi tới `this.applicationLookup.lockShared(tx, applicationId)`.

## 3. Lệnh kiểm chứng và kết quả

- `npx jest src/modules/catalog/` → PASS (100% test catalog cũ và mới không bị ảnh hưởng).
- `pnpm test:gates` → PASS (16/16 test gates xanh, tuân thủ giới hạn kiến trúc tầng và public contracts).

## 4. Bàn giao cho Dev A

Dev B thông báo Dev A: `CatalogApi` đã có thêm phương thức `lockApplicationShared` và các kiểu dữ liệu liên quan ở public API của `catalog`.
