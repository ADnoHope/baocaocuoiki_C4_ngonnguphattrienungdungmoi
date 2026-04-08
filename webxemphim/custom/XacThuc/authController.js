// Dung bcryptjs de bam (hash) mat khau truoc khi luu vao DB.
const bcrypt = require("bcryptjs");
// Dung jsonwebtoken de tao access token cho user sau khi dang ky/dang nhap.
const jwt = require("jsonwebtoken");
// Lay khoa bi mat dung de ky JWT tu cau hinh he thong.
const { jwtSecret } = require("../config");
// Lay cac helper dung chung de doc body va tra ve JSON response.
const { sendJson, sendBadRequest, readJsonBody } = require("../utils");

// Tao JWT chua thong tin dinh danh user (sub, email, role), co han 7 ngay.
const createToken = (user) => jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: "7d" });

// API dang ky tai khoan moi.
async function register(req, res, { pool }) {
	// Doc JSON body tu request.
	const body = await readJsonBody(req);
	// Kiem tra du lieu bat buoc; neu thieu thi tra loi 400.
	if (!body.fullName || !body.email || !body.password) return sendBadRequest(res, "Cần fullName, email và password");
	// Bam mat khau voi salt rounds = 10 de luu an toan.
	const passwordHash = await bcrypt.hash(body.password, 10);
	try {
		// Luu user moi vao bang users voi role mac dinh la user.
		const [result] = await pool.query("INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'user')", [body.fullName, body.email, passwordHash]);
		// Tao token cho user vua dang ky thanh cong.
		const token = createToken({ id: result.insertId, email: body.email, role: "user" });
		// Tra ket qua 201 (Created) kem thong tin user va token.
		sendJson(res, 201, { ok: true, message: "Đăng ký thành công", token, user: { id: result.insertId, fullName: body.fullName, email: body.email, role: "user" } });
	} catch (error) {
		// Neu email bi trung (vi unique index), tra loi 409 Conflict.
		if (error.code === "ER_DUP_ENTRY") sendJson(res, 409, { ok: false, message: "Email đã tồn tại" });
		// Loi khac day tiep len handler cha de log/xu ly.
		else throw error;
	}
}

// API dang nhap.
async function login(req, res, { pool }) {
	// Doc thong tin email/password tu body.
	const body = await readJsonBody(req);
	// Tim user theo email, chi lay 1 ban ghi duy nhat.
	const [rows] = await pool.query("SELECT id, full_name, email, password_hash, role FROM users WHERE email = ? LIMIT 1", [body.email]);
	// Neu khong tim thay user hoac mat khau sai thi tra 401 Unauthorized.
	if (!rows.length || !(await bcrypt.compare(body.password, rows[0].password_hash))) {
		return sendJson(res, 401, { ok: false, message: "Email hoặc mật khẩu không đúng" });
	}
	// Tao token tu thong tin user vua xac thuc thanh cong.
	const token = createToken(rows[0]);
	// Tra ve token va profile can thiet cho client.
	sendJson(res, 200, { ok: true, message: "Đăng nhập thành công", token, user: { id: rows[0].id, fullName: rows[0].full_name, email: rows[0].email, role: rows[0].role } });
}

// API lay thong tin nguoi dang dang nhap (me).
async function me(req, res, { authUser }) {
	// Neu middleware auth chua gan authUser thi xem nhu chua dang nhap.
	if (!authUser) return sendJson(res, 401, { ok: false, message: "Chưa đăng nhập" });
	// Tra profile user dang dang nhap.
	sendJson(res, 200, { ok: true, user: authUser });
}

// Export cac controller function de router su dung.
module.exports = { register, login, me };
