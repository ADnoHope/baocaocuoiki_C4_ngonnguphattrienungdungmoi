const { sendJson, readJsonBody, toJsonArray } = require("../utils");
const { createBookingOrder } = require("../services/bookingService");
const { requireAuth } = require("../middlewares/auth");

const momoService = require("../services/momoService");

async function checkout(req, res, context) {
	if (!(await requireAuth(req, res, context))) return;
	const body = await readJsonBody(req);
	try {
		const result = await createBookingOrder(context.pool, { authUser: context.authUser, body, ioInstance: context.ioInstance });
		
		if (body.paymentMethod === 'momo') {
			const momoResponse = await momoService.createPaymentAsync({
				OrderId: result.orderId.toString(),
				Amount: result.totalAmount,
				OrderInfo: "Thanh toan ve xem phim ma don: " + result.orderId,
			});
			if (momoResponse.payUrl) {
				return sendJson(res, 201, { ok: true, message: "Tạo đơn thành công", data: result, payUrl: momoResponse.payUrl });
			} else {
				throw new Error("Không thể tạo URL thanh toán Momo: " + momoResponse.message);
			}
		}

		sendJson(res, 201, { ok: true, message: "Tạo đơn thành công", data: result });
	} catch (error) {
		sendJson(res, 400, { ok: false, message: error.message });
	}
}

async function momoNotify(req, res, context) {
	const body = await readJsonBody(req);
	if (!body) return sendJson(res, 400, { message: "Bad request" });

	const isValid = momoService.verifySignature(body);
	if (!isValid) {
		return sendJson(res, 400, { message: "Invalid signature" });
	}

	if (body.resultCode === 0) {
		const orderIdParts = body.orderId.split("_");
		const originalOrderId = Number(orderIdParts[0]);
		
		await context.pool.query("UPDATE booking_orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ?", [originalOrderId]);
		return sendJson(res, 204, ""); // Momo requires 204 No Content for successful IPN
	}

	return sendJson(res, 204, "");
}

async function momoReturn(req, res, context) {
	const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
	const resultCode = searchParams.get("resultCode");
	
	if (resultCode === "0") {
		// redirect to success page or history
		res.writeHead(302, { Location: "/history.html?payment=success" });
	} else {
		res.writeHead(302, { Location: "/history.html?payment=failed" });
	}
	res.end();
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

module.exports = { checkout, confirmPayment, getMyOrders, momoNotify, momoReturn };
