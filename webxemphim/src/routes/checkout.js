const checkoutController = require("../controllers/checkoutController");

async function handle(req, res, pathname, context) {
	if (pathname === "/api/checkout" && req.method === "POST") return await checkoutController.checkout(req, res, context), true;
	if (pathname === "/api/checkout/momo_notify" && req.method === "POST") return await checkoutController.momoNotify(req, res, context), true;
	if (pathname === "/api/checkout/momo_return" && req.method === "GET") return await checkoutController.momoReturn(req, res, context), true;
	if (pathname.match(/^\/api\/payments\/\d+\/confirm$/) && req.method === "POST") return await checkoutController.confirmPayment(req, res, { ...context, pathname }), true;
	if (pathname === "/api/orders/me" && req.method === "GET") return await checkoutController.getMyOrders(req, res, context), true;
	return false;
}

module.exports = { handle };
