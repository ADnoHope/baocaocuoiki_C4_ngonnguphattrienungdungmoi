const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");
const { sendJson, sendBadRequest, readJsonBody } = require("../utils");

const createToken = (user) => jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: "7d" });

async function register(req, res, { pool }) {
	const body = await readJsonBody(req);
	if (!body.fullName || !body.email || !body.password) return sendBadRequest(res, "Cần fullName, email và password");
	const passwordHash = await bcrypt.hash(body.password, 10);
	try {
		const [result] = await pool.query("INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'user')", [body.fullName, body.email, passwordHash]);
		const token = createToken({ id: result.insertId, email: body.email, role: "user" });
		sendJson(res, 201, { ok: true, message: "Đăng ký thành công", token, user: { id: result.insertId, fullName: body.fullName, email: body.email, role: "user" } });
	} catch (error) {
		if (error.code === "ER_DUP_ENTRY") sendJson(res, 409, { ok: false, message: "Email đã tồn tại" });
		else throw error;
	}
}

async function login(req, res, { pool }) {
	const body = await readJsonBody(req);
	const [rows] = await pool.query("SELECT id, full_name, email, password_hash, role FROM users WHERE email = ? LIMIT 1", [body.email]);
	if (!rows.length || !(await bcrypt.compare(body.password, rows[0].password_hash))) {
		return sendJson(res, 401, { ok: false, message: "Email hoặc mật khẩu không đúng" });
	}
	const token = createToken(rows[0]);
	sendJson(res, 200, { ok: true, message: "Đăng nhập thành công", token, user: { id: rows[0].id, fullName: rows[0].full_name, email: rows[0].email, role: rows[0].role } });
}

async function me(req, res, { authUser }) {
	if (!authUser) return sendJson(res, 401, { ok: false, message: "Chưa đăng nhập" });
	sendJson(res, 200, { ok: true, user: authUser });
}

module.exports = { register, login, me };
