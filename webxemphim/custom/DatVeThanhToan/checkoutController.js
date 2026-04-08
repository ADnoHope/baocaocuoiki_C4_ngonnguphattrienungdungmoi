// Helper dung chung: tra JSON, doc JSON body, parse chuoi JSON tu DB thanh mang.
const { sendJson, readJsonBody, toJsonArray } = require("../utils");
// Service xu ly tao don dat ve va cac nghiep vu booking.
const { createBookingOrder } = require("../services/bookingService");
// Middleware helper bat buoc user dang nhap.
const { requireAuth } = require("../middlewares/auth");

// API checkout tao don hang dat ve.
async function checkout(req, res, context) {
	// Bat buoc da dang nhap; neu khong hop le thi requireAuth tu tra response va dung luon.
	if (!(await requireAuth(req, res, context))) return;
	// Doc thong tin checkout (ghe, suat chieu, combo...) tu body.
	const body = await readJsonBody(req);
	try {
		// Tao don hang trong DB va xu ly lock/tru ghe trong service.
		const result = await createBookingOrder(context.pool, { authUser: context.authUser, body, ioInstance: context.ioInstance });
		// Tra ket qua tao don thanh cong.
		sendJson(res, 201, { ok: true, message: "Tạo đơn thành công", data: result });
	} catch (error) {
		// Bat moi loi phat sinh trong qua trinh checkout va tra 400 de frontend hien thi.
		sendJson(res, 400, { ok: false, message: error.message });
	}
}

// API xac nhan thanh toan thu cong cho don hang.
async function confirmPayment(req, res, context) {
	// Bat buoc da dang nhap.
	if (!(await requireAuth(req, res, context))) return;
	// Lay orderId tu path /api/payments/:id/confirm.
	const orderId = Number(context.pathname.match(/^\/api\/payments\/(\d+)\/confirm$/)[1]);
	// Cap nhat trang thai thanh toan/confirm cho don.
	await context.pool.query("UPDATE booking_orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ?", [orderId]);
	// Tra thong bao thanh cong.
	sendJson(res, 200, { ok: true, message: "Xác nhận thanh toán thành công" });
}

// API lay lich su don hang cua chinh nguoi dung dang dang nhap.
async function getMyOrders(req, res, context) {
	// Bat buoc da dang nhap.
	if (!(await requireAuth(req, res, context))) return;
	// Query danh sach don + thong tin phim/rap/suat chieu lien quan.
	const [rows] = await context.pool.query(
		`SELECT o.*, m.title AS movieTitle, t.name AS theaterName, s.start_time AS startTime FROM booking_orders o JOIN showtimes s ON s.id = o.showtime_id JOIN movies m ON m.id = s.movie_id JOIN theaters t ON t.id = s.theater_id WHERE o.user_id = ? ORDER BY o.id DESC`,
		[context.authUser.id]
	);
	// Chuyen seat_list (dang chuoi JSON) thanh mang de frontend xu ly de dang.
	sendJson(res, 200, { ok: true, data: rows.map(r => ({ ...r, seatList: toJsonArray(r.seat_list) })) });
}

// Export cac handler checkout/thanh toan cho router.
module.exports = { checkout, confirmPayment, getMyOrders };
