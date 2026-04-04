const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");
const { sendJson } = require("../utils");

async function getAuthUser(req, pool) {
	const authHeader = req.headers.authorization || "";
	if (!authHeader.startsWith("Bearer ")) return null;
	const token = authHeader.slice(7).trim();
	try {
		const payload = jwt.verify(token, jwtSecret);
		const [rows] = await pool.query(
			"SELECT id, full_name AS fullName, email, role FROM users WHERE id = ? LIMIT 1",
			[payload.sub]
		);
		return rows[0] || null;
	} catch {
		return null;
	}
}

async function requireAuth(req, res, context) {
	const user = await getAuthUser(req, context.pool);
	if (!user) {
		sendJson(res, 401, { ok: false, message: "Chưa đăng nhập" });
		return null;
	}
	context.authUser = user;
	return user;
}

async function requireAdmin(req, res, context) {
	const user = await requireAuth(req, res, context);
	if (!user) return null;
	if (user.role !== "admin") {
		sendJson(res, 403, { ok: false, message: "Cần quyền quản trị" });
		return null;
	}
	return user;
}

module.exports = {
	getAuthUser,
	requireAuth,
	requireAdmin,
};
