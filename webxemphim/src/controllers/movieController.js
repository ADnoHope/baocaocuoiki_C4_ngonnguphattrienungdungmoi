// Helper tra JSON va helper boc tach ID tu URL path.
const { sendJson, parseIdFromPath } = require("../utils");
// Cac helper nghiep vu phim/suat chieu/so do ghe.
const { attachFormatsToMovies, buildSeatMap, getLastRowCode, isPremiumViewSeatLabel, getTakenSeats } = require("../utils/movie");

// API lay danh sach phim, co the loc theo trang thai (dang chieu/sap chieu...).
async function getAllMovies(req, res, { pool, requestUrl }) {
	// Lay query param "status" neu client truyen len.
	const status = requestUrl.searchParams.get("status");
	// Dinh nghia danh sach cot tra ve va doi ten cot theo camelCase cho frontend.
	const movieSelectFields = `
		id,
		title,
		description,
		genre,
		director,
		cast_info AS castInfo,
		language,
		rated,
		duration_minutes AS durationMinutes,
		release_date AS releaseDate,
		status,
		poster_url AS posterUrl,
		created_at AS createdAt
	`;
	// Tao SQL dong: co status thi co WHERE, khong thi lay tat ca.
	const sql = status
		? `SELECT ${movieSelectFields} FROM movies WHERE status = ? ORDER BY id DESC`
		: `SELECT ${movieSelectFields} FROM movies ORDER BY id DESC`;
	// Thuc thi query; params chi truyen khi co status.
	const [rows] = await pool.query(sql, status ? [status] : []);
	// Gan them danh sach format cho tung phim (neu co bang lien ket format).
	await attachFormatsToMovies(pool, rows);
	// Tra danh sach phim ve cho client.
	sendJson(res, 200, { ok: true, data: rows });
}

// API lay chi tiet 1 phim theo ID, kem danh sach suat chieu.
async function getMovieById(req, res, { pool, pathname }) {
	// Tach movieId tu pathname dang /api/movies/:id.
	const movieId = parseIdFromPath(pathname, "/api/movies");
	// Query lay thong tin chi tiet phim.
	const [rows] = await pool.query(
		`SELECT
			id,
			title,
			description,
			genre,
			director,
			cast_info AS castInfo,
			language,
			rated,
			duration_minutes AS durationMinutes,
			release_date AS releaseDate,
			status,
			poster_url AS posterUrl,
			created_at AS createdAt
		 FROM movies WHERE id = ? LIMIT 1`,
		[movieId]
	);
	// Neu khong tim thay phim theo ID thi tra 404.
	if (!rows.length) return sendJson(res, 404, { ok: false, message: "Không tìm thấy phim" });
	// Query lay cac suat chieu cua phim, join them ten rap va ten dinh dang.
	const [showtimes] = await pool.query(
		`SELECT
			s.id,
			s.movie_id AS movieId,
			s.theater_id AS theaterId,
			s.format_id AS formatId,
			s.start_time AS startTime,
			s.price,
			s.total_seats AS totalSeats,
			f.name AS formatName,
			t.name AS theaterName
		 FROM showtimes s
		 JOIN theaters t ON t.id = s.theater_id
		 LEFT JOIN movie_formats f ON f.id = s.format_id
		 WHERE s.movie_id = ?
		 ORDER BY s.start_time ASC`,
		[movieId]
	);
	// Bo sung danh sach format cho phim.
	await attachFormatsToMovies(pool, rows);
	// Tra thong tin phim (1 ban ghi) va showtimes di kem.
	sendJson(res, 200, { ok: true, data: { ...rows[0], showtimes } });
}

// API lay toan bo dinh dang phim (2D/3D/IMAX...).
async function getAllFormats(req, res, { pool }) {
	// Lay danh sach format sap xep theo ten tang dan.
	const [rows] = await pool.query("SELECT * FROM movie_formats ORDER BY name ASC");
	// Tra ket qua cho client.
	sendJson(res, 200, { ok: true, data: rows });
}

// API lay toan bo rap.
async function getAllTheaters(req, res, { pool }) {
	// Lay danh sach rap moi nhat truoc theo id giam dan.
	const [rows] = await pool.query("SELECT * FROM theaters ORDER BY id DESC");
	// Tra danh sach rap.
	sendJson(res, 200, { ok: true, data: rows });
}

// API lay danh sach suat chieu, co ho tro loc theo phim va/hoac rap.
async function getShowtimes(req, res, { pool, requestUrl }) {
	// Lay movieId filter tu query string.
	const movieFilter = requestUrl.searchParams.get("movieId");
	// Lay theaterId filter tu query string.
	const theaterFilter = requestUrl.searchParams.get("theaterId");
	// Mang params se dua vao prepared statement.
	const params = [];
	// Cau truy van goc join du lieu suat chieu voi phim, rap, format.
	let sql = `SELECT
		s.id,
		s.movie_id AS movieId,
		s.theater_id AS theaterId,
		s.format_id AS formatId,
		s.start_time AS startTime,
		s.price,
		s.total_seats AS totalSeats,
		m.title AS movieTitle,
		t.name AS theaterName,
		f.name AS formatName
	FROM showtimes s
	JOIN movies m ON m.id = s.movie_id
	JOIN theaters t ON t.id = s.theater_id
	LEFT JOIN movie_formats f ON f.id = s.format_id`;
	// Mang dieu kien WHERE duoc ghep dong theo filter.
	const cond = [];
	// Neu co movieFilter thi bo sung dieu kien movie_id = ?.
	if (movieFilter) { cond.push("s.movie_id = ?"); params.push(movieFilter); }
	// Neu co theaterFilter thi bo sung dieu kien theater_id = ?.
	if (theaterFilter) { cond.push("s.theater_id = ?"); params.push(theaterFilter); }
	// Neu co it nhat 1 dieu kien thi ghep vao SQL.
	if (cond.length) sql += ` WHERE ${cond.join(" AND ")}`;
	// Sap xep suat chieu theo gio bat dau tang dan.
	sql += " ORDER BY s.start_time ASC";
	// Chay query va lay du lieu.
	const [rows] = await pool.query(sql, params);
	// Tra danh sach suat chieu.
	sendJson(res, 200, { ok: true, data: rows });
}

// API lay so do ghe cua 1 suat chieu.
async function getSeatsForShowtime(req, res, { pool, pathname }) {
	// Tach showtimeId tu path /api/showtimes/:id/seats.
	const showtimeId = Number(pathname.match(/^\/api\/showtimes\/(\d+)\/seats$/)[1]);
	// Lay thong tin suat chieu va ten format tu DB.
	const [rows] = await pool.query(`SELECT s.*, f.name AS formatName FROM showtimes s LEFT JOIN movie_formats f ON f.id = s.format_id WHERE s.id = ? LIMIT 1`, [showtimeId]);
	// Neu khong tim thay suat chieu thi tra 404.
	if (!rows.length) return sendJson(res, 404, { ok: false, message: "Không tìm thấy suất chiếu" });
	// Neu suat chieu chua co format thi mac dinh la 2D.
	const formatName = rows[0].formatName || "2D";
	// Sinh toan bo danh sach nhan ghe theo format va tong so ghe.
	const allSeats = buildSeatMap(formatName, rows[0].total_seats);
	// Xac dinh hang ghe cuoi (de gan loai ghe doi/couple).
	const lastRow = getLastRowCode(formatName, rows[0].total_seats);
	// Lay tap ghe da duoc dat de danh dau taken.
	const taken = await getTakenSeats(pool, showtimeId);
	// Tra du lieu ghe bao gom: nhan ghe, trang thai da dat, va loai ghe.
	sendJson(res, 200, { ok: true, data: { showtimeId, seats: allSeats.map(label => ({ label, taken: taken.has(label), seatType: label.startsWith(lastRow) ? "couple" : isPremiumViewSeatLabel(label) ? "premium" : "standard" })) } });
}

// Export cac API handler cho module router movies.
module.exports = { getAllMovies, getMovieById, getAllFormats, getAllTheaters, getShowtimes, getSeatsForShowtime };
