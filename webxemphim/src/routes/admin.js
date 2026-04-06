const { sendJson, sendBadRequest, readJsonBody, parseIdFromPath, toJsonArray, setMovieFormatMappings, getFormatNameById, getSeatLayoutPreset } = require("../utils");

function normalizeRatedScore(value) {
	const score = Number(String(value ?? "").trim());
	if (!Number.isInteger(score) || score < 1 || score > 10) return null;
	return String(score);
}

async function handle(req, res, pathname, { pool, authUser, runMulter, upload }) {
	if (!pathname.startsWith("/api/admin/")) return false;
	if (!authUser || authUser.role !== "admin") { sendJson(res, 403, { ok: false, message: "Cần quyền admin" }); return true; }

	if (pathname === "/api/admin/upload" && req.method === "POST") {
		try {
			await runMulter(req, res, upload.single("file"));
			if (!req.file) { sendBadRequest(res, "Không có file nào được tải lên"); return true; }
			sendJson(res, 201, { ok: true, message: "Tải file thành công", url: `/uploads/${req.file.filename}` });
		} catch (error) {
			sendJson(res, 500, { ok: false, message: "Lỗi tải file", error: error.message });
		}
		return true;
	}

	if (pathname === "/api/admin/overview" && req.method === "GET") {
		const [[m]] = await pool.query("SELECT COUNT(*) AS total FROM movies");
		const [[t]] = await pool.query("SELECT COUNT(*) AS total FROM theaters");
		const [[s]] = await pool.query("SELECT COUNT(*) AS total FROM showtimes");
		const [[o]] = await pool.query("SELECT COUNT(*) AS total FROM booking_orders");
		sendJson(res, 200, { ok: true, data: { movies: Number(m.total), theaters: Number(t.total), showtimes: Number(s.total), orders: Number(o.total) } });
		return true;
	}

	if (pathname === "/api/admin/orders" && req.method === "GET") {
		const [rows] = await pool.query(
			`SELECT o.id, u.full_name AS customerName, u.email, m.title AS movieTitle, t.name AS theaterName, s.start_time AS startTime, o.seat_list AS seatList, o.total_amount AS totalAmount, o.payment_status AS paymentStatus, o.status, o.created_at AS createdAt
			 FROM booking_orders o JOIN users u ON u.id = o.user_id JOIN showtimes s ON s.id = o.showtime_id JOIN movies m ON m.id = s.movie_id JOIN theaters t ON t.id = s.theater_id
			 ORDER BY o.id DESC`
		);
		sendJson(res, 200, { ok: true, data: rows.map(r => ({ ...r, seatList: toJsonArray(r.seatList) })) });
		return true;
	}

	const orderId = parseIdFromPath(pathname, "/api/admin/orders");
	if (orderId && req.method === "PUT") {
		const body = await readJsonBody(req);
		const status = body.status || "pending";
		const paymentStatus = body.paymentStatus || "pending";
		await pool.query("UPDATE booking_orders SET status = ?, payment_status = ? WHERE id = ?", [status, paymentStatus, orderId]);
		sendJson(res, 200, { ok: true, message: "Cập nhật đơn hàng thành công" });
		return true;
	}

	if (pathname === "/api/admin/formats" && req.method === "GET") {
		const [rows] = await pool.query("SELECT id, name, created_at AS createdAt FROM movie_formats ORDER BY name ASC");
		sendJson(res, 200, { ok: true, data: rows });
		return true;
	}

	if (pathname === "/api/admin/formats" && req.method === "POST") {
		const body = await readJsonBody(req);
		const name = String(body.name || "").trim().toUpperCase();
		if (!name) { sendBadRequest(res, "Cần cung cấp tên định dạng"); return true; }
		const [res2] = await pool.query("INSERT INTO movie_formats (name) VALUES (?)", [name]);
		sendJson(res, 201, { ok: true, message: "Tạo định dạng thành công", id: res2.insertId });
		return true;
	}

	const formatId = parseIdFromPath(pathname, "/api/admin/formats");
	if (formatId && req.method === "PUT") {
		const body = await readJsonBody(req);
		const name = String(body.name || "").trim().toUpperCase();
		await pool.query("UPDATE movie_formats SET name = ? WHERE id = ?", [name, formatId]);
		sendJson(res, 200, { ok: true, message: "Cập nhật định dạng thành công" });
		return true;
	}
	if (formatId && req.method === "DELETE") {
		await pool.query("DELETE FROM movie_formats WHERE id = ?", [formatId]);
		sendJson(res, 200, { ok: true, message: "Xóa định dạng thành công" });
		return true;
	}

	if (pathname === "/api/admin/movies" && req.method === "POST") {
		const body = await readJsonBody(req);
		if (!body.title) { sendBadRequest(res, "Cần cung cấp tiêu đề phim"); return true; }
		const rated = normalizeRatedScore(body.rated);
		const [res3] = await pool.query(
			"INSERT INTO movies (title, description, genre, director, cast_info, language, rated, duration_minutes, release_date, status, poster_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			[body.title, body.description || null, body.genre || null, body.director || null, body.castInfo || null, body.language || null, rated, body.durationMinutes || null, body.releaseDate || null, body.status || "coming_soon", body.posterUrl || null]
		);
		await setMovieFormatMappings(pool, res3.insertId, body.formatIds);
		sendJson(res, 201, { ok: true, message: "Tạo phim thành công", id: res3.insertId });
		return true;
	}

	const mid = parseIdFromPath(pathname, "/api/admin/movies");
	if (mid && req.method === "PUT") {
		const body = await readJsonBody(req);
		const rated = normalizeRatedScore(body.rated);
		await pool.query(
			"UPDATE movies SET title = ?, description = ?, genre = ?, director = ?, cast_info = ?, language = ?, rated = ?, duration_minutes = ?, release_date = ?, status = ?, poster_url = ? WHERE id = ?",
			[body.title, body.description || null, body.genre || null, body.director || null, body.castInfo || null, body.language || null, rated, body.durationMinutes || null, body.releaseDate || null, body.status || "coming_soon", body.posterUrl || null, mid]
		);
		await setMovieFormatMappings(pool, mid, body.formatIds);
		sendJson(res, 200, { ok: true, message: "Cập nhật phim thành công" });
		return true;
	}
	if (mid && req.method === "DELETE") {
		await pool.query("DELETE FROM movies WHERE id = ?", [mid]);
		sendJson(res, 200, { ok: true, message: "Xóa phim thành công" });
		return true;
	}

	if (pathname === "/api/admin/theaters" && req.method === "POST") {
		const body = await readJsonBody(req);
		if (!body.name) { sendBadRequest(res, "Cần cung cấp tên rạp"); return true; }
		const [res4] = await pool.query("INSERT INTO theaters (name, city, address) VALUES (?, ?, ?)", [body.name, body.city || null, body.address || null]);
		sendJson(res, 201, { ok: true, message: "Tạo rạp thành công", id: res4.insertId });
		return true;
	}
	const tid = parseIdFromPath(pathname, "/api/admin/theaters");
	if (tid && req.method === "PUT") {
		const body = await readJsonBody(req);
		await pool.query("UPDATE theaters SET name = ?, city = ?, address = ? WHERE id = ?", [body.name, body.city || null, body.address || null, tid]);
		sendJson(res, 200, { ok: true, message: "Cập nhật rạp thành công" });
		return true;
	}
	if (tid && req.method === "DELETE") {
		await pool.query("DELETE FROM theaters WHERE id = ?", [tid]);
		sendJson(res, 200, { ok: true, message: "Xóa rạp thành công" });
		return true;
	}

	if (pathname === "/api/admin/showtimes" && req.method === "POST") {
		const body = await readJsonBody(req);
		const fName = await getFormatNameById(pool, body.formatId);
		const lp = getSeatLayoutPreset(fName);
		const [res5] = await pool.query("INSERT INTO showtimes (movie_id, theater_id, format_id, start_time, price, total_seats) VALUES (?, ?, ?, ?, ?, ?)", [body.movieId, body.theaterId, body.formatId, body.startTime, body.price, lp.totalSeats]);
		sendJson(res, 201, { ok: true, message: "Tạo suất chiếu thành công", id: res5.insertId });
		return true;
	}
	const sid = parseIdFromPath(pathname, "/api/admin/showtimes");
	if (sid && req.method === "PUT") {
		const body = await readJsonBody(req);
		const fName = await getFormatNameById(pool, body.formatId);
		const lp = getSeatLayoutPreset(fName);
		await pool.query("UPDATE showtimes SET movie_id = ?, theater_id = ?, format_id = ?, start_time = ?, price = ?, total_seats = ? WHERE id = ?", [body.movieId, body.theaterId, body.formatId, body.startTime, body.price, lp.totalSeats, sid]);
		sendJson(res, 200, { ok: true, message: "Cập nhật suất chiếu thành công" });
		return true;
	}
	if (sid && req.method === "DELETE") {
		await pool.query("DELETE FROM showtimes WHERE id = ?", [sid]);
		sendJson(res, 200, { ok: true, message: "Xóa suất chiếu thành công" });
		return true;
	}

	if (pathname === "/api/admin/combos" && req.method === "POST") {
		const body = await readJsonBody(req);
		const [res6] = await pool.query("INSERT INTO combos (name, description, image_url, price) VALUES (?, ?, ?, ?)", [body.name, body.description || null, body.imageUrl || null, body.price]);
		sendJson(res, 201, { ok: true, message: "Tạo combo thành công", id: res6.insertId });
		return true;
	}
	const cid = parseIdFromPath(pathname, "/api/admin/combos");
	if (cid && req.method === "PUT") {
		const body = await readJsonBody(req);
		await pool.query("UPDATE combos SET name = ?, description = ?, image_url = ?, price = ? WHERE id = ?", [body.name, body.description || null, body.imageUrl || null, body.price, cid]);
		sendJson(res, 200, { ok: true, message: "Cập nhật combo thành công" });
		return true;
	}
	if (cid && req.method === "DELETE") {
		await pool.query("DELETE FROM combos WHERE id = ?", [cid]);
		sendJson(res, 200, { ok: true, message: "Xóa combo thành công" });
		return true;
	}

	if (pathname === "/api/admin/blogs" && req.method === "POST") {
		const body = await readJsonBody(req);
		const status = body.status === "draft" ? "draft" : "published";
		const [res7] = await pool.query("INSERT INTO blogs (title, summary, content, image_url, status) VALUES (?, ?, ?, ?, ?)", [body.title, body.summary || null, body.content, body.imageUrl || null, status]);
		sendJson(res, 201, { ok: true, message: "Tạo blog thành công", id: res7.insertId });
		return true;
	}
	const bid = parseIdFromPath(pathname, "/api/admin/blogs");
	if (bid && req.method === "PUT") {
		const body = await readJsonBody(req);
		const status = body.status === "draft" ? "draft" : "published";
		await pool.query("UPDATE blogs SET title = ?, summary = ?, content = ?, image_url = ?, status = ? WHERE id = ?", [body.title, body.summary || null, body.content, body.imageUrl || null, status, bid]);
		sendJson(res, 200, { ok: true, message: "Cập nhật blog thành công" });
		return true;
	}
	if (bid && req.method === "DELETE") {
		await pool.query("DELETE FROM blogs WHERE id = ?", [bid]);
		sendJson(res, 200, { ok: true, message: "Xóa blog thành công" });
		return true;
	}

	if (pathname === "/api/admin/promotions" && req.method === "GET") {
		const [rows] = await pool.query("SELECT id, code, discount_amount AS discountAmount, min_order_value AS minOrderValue, valid_from AS validFrom, valid_until AS validUntil, created_at AS createdAt FROM promotions ORDER BY id DESC");
		sendJson(res, 200, { ok: true, data: rows }); return true;
	}
	if (pathname === "/api/admin/promotions" && req.method === "POST") {
		const body = await readJsonBody(req);
		const [res8] = await pool.query("INSERT INTO promotions (code, discount_amount, min_order_value, valid_from, valid_until) VALUES (?, ?, ?, ?, ?)", [body.code, body.discountAmount, body.minOrderValue || 0, body.validFrom || null, body.validUntil || null]);
		sendJson(res, 201, { ok: true, message: "Tạo voucher thành công", id: res8.insertId }); return true;
	}
	const pid = parseIdFromPath(pathname, "/api/admin/promotions");
	if (pid && req.method === "DELETE") {
		await pool.query("DELETE FROM promotions WHERE id = ?", [pid]);
		sendJson(res, 200, { ok: true, message: "Xóa voucher thành công" }); return true;
	}

	return false;
}

module.exports = { handle };
