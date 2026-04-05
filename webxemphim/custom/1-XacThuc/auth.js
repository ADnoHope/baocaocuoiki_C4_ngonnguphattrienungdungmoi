const authController = require("../controllers/authController");

async function handle(req, res, pathname, context) {
	if (pathname === "/api/auth/register" && req.method === "POST") return await authController.register(req, res, context), true;
	if (pathname === "/api/auth/login" && req.method === "POST") return await authController.login(req, res, context), true;
	if (pathname === "/api/auth/me" && req.method === "GET") return await authController.me(req, res, context), true;
	return false;
}

module.exports = { handle };
