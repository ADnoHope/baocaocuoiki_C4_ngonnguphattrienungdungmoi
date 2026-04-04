const { sendJson } = require("../utils");

async function handle(req, res, pathname, { pool, requestUrl }) {
	if (pathname === "/api/promotions/check" && req.method === "GET") {
		const code = requestUrl.searchParams.get("code") || "";
		if (!code) { sendJson(res, 400, { ok: false, message: "Cần mã khuyến mãi" }); return true; }
		const [rows] = await pool.query(
			"SELECT id, code, discount_amount AS discountAmount, min_order_value AS minOrderValue, valid_from AS validFrom, valid_until AS validUntil FROM promotions WHERE code = ? LIMIT 1",
			[code]
		);
		if (!rows.length) { sendJson(res, 404, { ok: false, message: "Voucher không tồn tại" }); return true; }
		const promo = rows[0];
		const now = new Date();
		if (promo.validFrom && new Date(promo.validFrom) > now) { sendJson(res, 400, { ok: false, message: "Voucher chưa đến ngày hiệu lực", voucher: promo }); return true; }
		if (promo.validUntil && new Date(promo.validUntil) < now) { sendJson(res, 400, { ok: false, message: "Voucher đã hết hạn", voucher: promo }); return true; }
		sendJson(res, 200, { ok: true, message: "Voucher hợp lệ", data: promo });
		return true;
	}
	return false;
}

module.exports = { handle };
