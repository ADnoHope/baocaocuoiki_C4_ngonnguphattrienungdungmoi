---
description: 7 Functional Modules Report
---
# Báo cáo Phân loại 7 Chức năng WebXemphimC4

Chào bạn, tôi đã thực hiện tách 7 chức năng của trang web vào thư mục `custom` theo yêu cầu. Mỗi thư mục dành cho 1 người đảm nhiệm, chứa đầy đủ các file logic liên quan của chức năng đó.

## Danh sách các chức năng và thành phần:

### 1-XacThuc (Xác thực & Người dùng)
- `auth.js`: Các route đăng ký, đăng nhập, thông tin cá nhân.
- `authController.js`: Xử lý logic nghiệp vụ xác thực.
- `user.js`: Định nghĩa schema/dữ liệu người dùng.

### 2-QuanLyPhim (Phim, Rạp & Suất chiếu)
- `movies.js`: Các route lấy danh sách phim, chi tiết phim cho người dùng.
- `movieController.js`: Xử lý logic hiển thị phim.
- `movie.js`: Định nghĩa schema/dữ liệu phim.

### 3-DatVeThanhToan (Đặt vé & Checkout)
- `checkout.js`: Các route xử lý đặt vé, thanh toán.
- `checkoutController.js`: Điều hướng logic thanh toán.
- `bookingService.js`: Dịch vụ tính toán ghế, giá vé, tạo đơn hàng.

### 4-TinTucBlog (Tin tức & Blog)
- `blogs.js`: Các route lấy danh sách tin tức, chi tiết bài viết (logic nằm trực tiếp trong route).

### 5-DoAnCombo (Đồ ăn & Combo)
- `combos.js`: Các route lấy danh sách combo đồ ăn (logic nằm trực tiếp trong route).

### 6-KhuyenMai (Voucher & Khuyến mãi)
- `promotions.js`: Các route kiểm tra và áp dụng mã khuyến mãi.

### 7-QuanTriHeThong (Admin Dashboard & Tổng quát)
- `admin.js`: Đây là trung tâm quản lý cho Admin, bao gồm:
    - Overview (Xem tổng quan hệ thống).
    - Image Upload (Tải file).
    - Quản lý các đơn hàng (Booking Orders).
    - Quản lý Phim, Suất chiếu, Rạp, Combo, Blog, Voucher (Phần Admin CRUD).

---
**Lưu ý:**
- Các file trong thư mục `custom` là bản copy từ nguồn để các thành viên có thể làm việc riêng biệt.
- Khi cần cập nhật code, hãy thực hiện trong folder của mình rồi gộp lại vào core sau.
