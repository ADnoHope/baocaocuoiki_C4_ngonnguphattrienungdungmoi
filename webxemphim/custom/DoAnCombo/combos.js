const { sendJson } = require("../utils");

async function handle(req, res, pathname, { pool }) {
	if (pathname === "/api/combos" && req.method === "GET") {
		const [rows] = await pool.query("SELECT id, name, description, image_url AS imageUrl, price, created_at AS createdAt FROM combos ORDER BY id DESC");
		sendJson(res, 200, { ok: true, data: rows });
		return true;
	}
	return false;
}

module.exports = { handle };
