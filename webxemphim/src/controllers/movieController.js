const { sendJson, parseIdFromPath } = require("../utils");
const { attachFormatsToMovies, buildSeatMap, getLastRowCode, isPremiumViewSeatLabel, getTakenSeats } = require("../utils/movie");

async function getAllMovies(req, res, { pool, requestUrl }) {
	const status = requestUrl.searchParams.get("status");
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
	const sql = status
		? `SELECT ${movieSelectFields} FROM movies WHERE status = ? ORDER BY id DESC`
		: `SELECT ${movieSelectFields} FROM movies ORDER BY id DESC`;
	const [rows] = await pool.query(sql, status ? [status] : []);
	await attachFormatsToMovies(pool, rows);
	sendJson(res, 200, { ok: true, data: rows });
}

async function getMovieById(req, res, { pool, pathname }) {
	const movieId = parseIdFromPath(pathname, "/api/movies");
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
	if (!rows.length) return sendJson(res, 404, { ok: false, message: "Không tìm thấy phim" });
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
	await attachFormatsToMovies(pool, rows);
	sendJson(res, 200, { ok: true, data: { ...rows[0], showtimes } });
}

async function getAllFormats(req, res, { pool }) {
	const [rows] = await pool.query("SELECT * FROM movie_formats ORDER BY name ASC");
	sendJson(res, 200, { ok: true, data: rows });
}

async function getAllTheaters(req, res, { pool }) {
	const [rows] = await pool.query("SELECT * FROM theaters ORDER BY id DESC");
	sendJson(res, 200, { ok: true, data: rows });
}

async function getShowtimes(req, res, { pool, requestUrl }) {
	const movieFilter = requestUrl.searchParams.get("movieId");
	const theaterFilter = requestUrl.searchParams.get("theaterId");
	const params = [];
	let sql = `SELECT s.*, m.title AS movieTitle, t.name AS theaterName, f.name AS formatName FROM showtimes s JOIN movies m ON m.id = s.movie_id JOIN theaters t ON t.id = s.theater_id LEFT JOIN movie_formats f ON f.id = s.format_id`;
	const cond = [];
	if (movieFilter) { cond.push("s.movie_id = ?"); params.push(movieFilter); }
	if (theaterFilter) { cond.push("s.theater_id = ?"); params.push(theaterFilter); }
	if (cond.length) sql += ` WHERE ${cond.join(" AND ")}`;
	sql += " ORDER BY s.start_time ASC";
	const [rows] = await pool.query(sql, params);
	sendJson(res, 200, { ok: true, data: rows });
}

async function getSeatsForShowtime(req, res, { pool, pathname }) {
	const showtimeId = Number(pathname.match(/^\/api\/showtimes\/(\d+)\/seats$/)[1]);
	const [rows] = await pool.query(`SELECT s.*, f.name AS formatName FROM showtimes s LEFT JOIN movie_formats f ON f.id = s.format_id WHERE s.id = ? LIMIT 1`, [showtimeId]);
	if (!rows.length) return sendJson(res, 404, { ok: false, message: "Không tìm thấy suất chiếu" });
	const formatName = rows[0].formatName || "2D";
	const allSeats = buildSeatMap(formatName, rows[0].total_seats);
	const lastRow = getLastRowCode(formatName, rows[0].total_seats);
	const taken = await getTakenSeats(pool, showtimeId);
	sendJson(res, 200, { ok: true, data: { showtimeId, seats: allSeats.map(label => ({ label, taken: taken.has(label), seatType: label.startsWith(lastRow) ? "couple" : isPremiumViewSeatLabel(label) ? "premium" : "standard" })) } });
}

module.exports = { getAllMovies, getMovieById, getAllFormats, getAllTheaters, getShowtimes, getSeatsForShowtime };
