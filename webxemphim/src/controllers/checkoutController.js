const { sendJson, readJsonBody, toJsonArray } = require("../utils");
const { createBookingOrder } = require("../services/bookingService");
const { requireAuth } = require("../middlewares/auth");

async function checkout(req, res, context) {
	if (!(await requireAuth(req, res, context))) return;
	const body = await readJsonBody(req);
	try {
		const result = await createBookingOrder(context.pool, { authUser: context.authUser, body, ioInstance: context.ioInstance });
		sendJson(res, 201, { ok: true, message: "Tạo đơn thành công", data: result });
	} catch (error) {
		sendJson(res, 400, { ok: false, message: error.message });
	}
}

async function confirmPayment(req, res, context) {
	if (!(await requireAuth(req, res, context))) return;
	const orderId = Number(context.pathname.match(/^\/api\/payments\/(\d+)\/confirm$/)[1]);
	const [[order]] = await context.pool.query("SELECT id, user_id AS userId FROM booking_orders WHERE id = ? LIMIT 1", [orderId]);
	if (!order) {
		sendJson(res, 404, { ok: false, message: "Không tìm thấy đơn hàng" });
		return;
	}
	if (context.authUser.role !== "admin" && Number(order.userId) !== Number(context.authUser.id)) {
		sendJson(res, 403, { ok: false, message: "Bạn không có quyền xác nhận thanh toán đơn này" });
		return;
	}
	await context.pool.query("UPDATE booking_orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ?", [orderId]);
	sendJson(res, 200, { ok: true, message: "Xác nhận thanh toán thành công" });
}

async function getMyOrders(req, res, context) {
	if (!(await requireAuth(req, res, context))) return;
	const [rows] = await context.pool.query(
		`SELECT o.*, m.title AS movieTitle, t.name AS theaterName, s.start_time AS startTime FROM booking_orders o JOIN showtimes s ON s.id = o.showtime_id JOIN movies m ON m.id = s.movie_id JOIN theaters t ON t.id = s.theater_id WHERE o.user_id = ? ORDER BY o.id DESC`,
		[context.authUser.id]
	);
	sendJson(res, 200, { ok: true, data: rows.map(r => ({ ...r, seatList: toJsonArray(r.seat_list) })) });
}

module.exports = { checkout, confirmPayment, getMyOrders };
