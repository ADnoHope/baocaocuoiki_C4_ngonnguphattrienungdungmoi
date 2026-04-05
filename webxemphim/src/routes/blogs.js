const { sendJson, parseIdFromPath } = require("../utils");

async function handle(req, res, pathname, { pool, authUser, requestUrl }) {
	if (pathname === "/api/blogs" && req.method === "GET") {
		const includeDraft = requestUrl.searchParams.get("includeDraft") === "1";
		let sql = "SELECT id, title, summary, content, image_url AS imageUrl, status, created_at AS createdAt, updated_at AS updatedAt FROM blogs";
		const params = [];
		if (!includeDraft) sql += " WHERE status = 'published'";
		sql += " ORDER BY created_at DESC";
		const [rows] = await pool.query(sql, params);
		sendJson(res, 200, { ok: true, data: rows });
		return true;
	}

	const blogId = parseIdFromPath(pathname, "/api/blogs");
	if (blogId && req.method === "GET") {
		const [[row]] = await pool.query(
			"SELECT id, title, summary, content, image_url AS imageUrl, status, created_at AS createdAt, updated_at AS updatedAt FROM blogs WHERE id = ? LIMIT 1",
			[blogId]
		);
		if (!row) { sendJson(res, 404, { ok: false, message: "Không tìm thấy blog" }); return true; }
		if (row.status !== "published" && (!authUser || authUser.role !== "admin")) {
			sendJson(res, 404, { ok: false, message: "Không tìm thấy blog" }); return true;
		}
		sendJson(res, 200, { ok: true, data: row });
		return true;
	}

	return false;
}

module.exports = { handle };
