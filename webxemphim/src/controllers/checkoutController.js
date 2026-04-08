// Helper dung chung: tra JSON, doc JSON body, parse chuoi JSON tu DB thanh mang.
const { sendJson, readJsonBody, toJsonArray } = require("../utils");
// Service xu ly tao don dat ve va cac giao dich lien quan.
const { createBookingOrder } = require("../services/bookingService");
// Middleware helper bat buoc user dang nhap.
const { requireAuth } = require("../middlewares/auth");

// Service ket noi cong thanh toan Momo.
const momoService = require("../services/momoService");

// API checkout tao don hang dat ve.
async function checkout(req, res, context) {
	// Bat buoc da dang nhap; neu khong hop le thi requireAuth tu tra response va dung luon.
	if (!(await requireAuth(req, res, context))) return;
	// Doc thong tin checkout (ghe, suat chieu, paymentMethod...) tu body.
	const body = await readJsonBody(req);
	try {
		// Tao don hang trong DB va xu ly lock/tru ghe trong service.
		const result = await createBookingOrder(context.pool, { authUser: context.authUser, body, ioInstance: context.ioInstance });
		
		// Neu nguoi dung chon thanh toan Momo thi tao URL thanh toan.
		if (body.paymentMethod === 'momo') {
			// Goi API Momo de tao payment link theo thong tin don.
			const momoResponse = await momoService.createPaymentAsync({
				// Ma don de doi soat voi he thong booking.
				OrderId: result.orderId.toString(),
				// Tong tien thanh toan cua don.
				Amount: result.totalAmount,
				// Mo ta giao dich hiem thi ben Momo.
				OrderInfo: "Thanh toan ve xem phim ma don: " + result.orderId,
			});
			// Neu Momo tra ve payUrl hop le thi tra ve cho frontend de redirect.
			if (momoResponse.payUrl) {
				return sendJson(res, 201, { ok: true, message: "Tạo đơn thành công", data: result, payUrl: momoResponse.payUrl });
			} else {
				// Neu khong co payUrl thi xem la loi tao giao dich Momo.
				throw new Error("Không thể tạo URL thanh toán Momo: " + momoResponse.message);
			}
		}

		// Truong hop khong dung Momo (vi du COD/chuyen khoan noi bo) thi tra ket qua tao don.
		sendJson(res, 201, { ok: true, message: "Tạo đơn thành công", data: result });
	} catch (error) {
		// Bat moi loi phat sinh trong qua trinh checkout va tra 400 de frontend hien thi.
		sendJson(res, 400, { ok: false, message: error.message });
	}
}

// API IPN (server-to-server) tu Momo goi ve sau khi thanh toan.
async function momoNotify(req, res, context) {
	// Doc payload callback tu Momo.
	const body = await readJsonBody(req);
	// Neu payload rong/khong hop le thi bao loi.
	if (!body) return sendJson(res, 400, { message: "Bad request" });

	// Kiem tra chu ky de dam bao callback la tu Momo that.
	const isValid = momoService.verifySignature(body);
	// Chu ky sai thi tu choi xu ly.
	if (!isValid) {
		return sendJson(res, 400, { message: "Invalid signature" });
	}

	// resultCode = 0 nghia la giao dich thanh cong.
	if (body.resultCode === 0) {
		// Tach orderId goc cua he thong booking (phong truong hop orderId co them hau to).
		const orderIdParts = body.orderId.split("_");
		const originalOrderId = Number(orderIdParts[0]);
		
		// Cap nhat don hang sang trang thai da thanh toan va da xac nhan.
		await context.pool.query("UPDATE booking_orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ?", [originalOrderId]);
		// Theo yeu cau Momo, tra 204 No Content khi xu ly IPN thanh cong.
		return sendJson(res, 204, "");
	}

	// Truong hop thanh toan that bai van tra 204 de xac nhan da nhan callback.
	return sendJson(res, 204, "");
}

// API return URL: trinh duyet nguoi dung duoc dieu huong ve sau khi thanh toan.
async function momoReturn(req, res, context) {
	// Tach query string tu URL hien tai de doc ket qua thanh toan.
	const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
	// Lay ma ket qua giao dich.
	const resultCode = searchParams.get("resultCode");
	
	// Neu thanh cong thi redirect sang trang lich su voi flag success.
	if (resultCode === "0") {
		res.writeHead(302, { Location: "/history.html?payment=success" });
	} else {
		// Neu that bai/bi huy thi redirect voi flag failed.
		res.writeHead(302, { Location: "/history.html?payment=failed" });
	}
	// Ket thuc response redirect.
	res.end();
}

// API xac nhan thanh toan thu cong (admin hoac chu don).
async function confirmPayment(req, res, context) {
	// Bat buoc da dang nhap.
	if (!(await requireAuth(req, res, context))) return;
	// Lay orderId tu path /api/payments/:id/confirm.
	const orderId = Number(context.pathname.match(/^\/api\/payments\/(\d+)\/confirm$/)[1]);
	// Tim don hang de kiem tra ton tai va quyen truy cap.
	const [[order]] = await context.pool.query("SELECT id, user_id AS userId FROM booking_orders WHERE id = ? LIMIT 1", [orderId]);
	// Neu khong ton tai don hang thi tra 404.
	if (!order) {
		sendJson(res, 404, { ok: false, message: "Không tìm thấy đơn hàng" });
		return;
	}
	// Chi admin hoac dung chu don moi duoc xac nhan thanh toan.
	if (context.authUser.role !== "admin" && Number(order.userId) !== Number(context.authUser.id)) {
		sendJson(res, 403, { ok: false, message: "Bạn không có quyền xác nhận thanh toán đơn này" });
		return;
	}
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
module.exports = { checkout, confirmPayment, getMyOrders, momoNotify, momoReturn };
