const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Server } = require("socket.io");
const { getPool, testDatabaseConnection, initializeDatabase } = require("./db");

let ioInstance;

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const uploadDir = path.join(publicDir, "uploads");
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, file.fieldname + "-" + uniqueSuffix + ext);
	},
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Wrapper to use multer with native http
function runMulter(req, res, multerInstance) {
	return new Promise((resolve, reject) => {
		multerInstance(req, res, (err) => {
			if (err) {
				reject(err);
				return;
			}
			resolve();
		});
	});
}

const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || "change_me_in_production";

const mimeTypes = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
};

function sendJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(payload));
}

function sendBadRequest(res, message) {
	sendJson(res, 400, { ok: false, message });
}

function parseIdFromPath(pathname, basePath) {
	if (!pathname.startsWith(`${basePath}/`)) {
		return null;
	}

	const idPart = pathname.slice(basePath.length + 1);
	if (!/^\d+$/.test(idPart)) {
		return null;
	}

	return Number(idPart);
}

function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
			if (body.length > 1_000_000) {
				req.destroy();
				reject(new Error("Dữ liệu gửi lên quá lớn"));
			}
		});

		req.on("end", () => {
			if (!body.trim()) {
				resolve({});
				return;
			}

			try {
				resolve(JSON.parse(body));
			} catch {
				reject(new Error("JSON không hợp lệ"));
			}
		});

		req.on("error", reject);
	});
}

function createToken(user) {
	return jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

function parseAuthToken(req) {
	const authHeader = req.headers.authorization || "";
	if (!authHeader.startsWith("Bearer ")) {
		return null;
	}

	return authHeader.slice(7).trim();
}

async function getAuthUser(req, pool) {
	const token = parseAuthToken(req);
	if (!token) {
		return null;
	}

	let payload;
	try {
		payload = jwt.verify(token, jwtSecret);
	} catch {
		return null;
	}

	const [rows] = await pool.query("SELECT id, full_name AS fullName, email, role FROM users WHERE id = ? LIMIT 1", [payload.sub]);
	if (!rows.length) {
		return null;
	}

	return rows[0];
}

function normalizeSeatLabel(raw) {
	return String(raw || "").trim().toUpperCase();
}

function build2DSeatMap() {
	const seats = [];
	for (let rowCode = 65; rowCode <= 75; rowCode += 1) {
		const row = String.fromCharCode(rowCode);
		for (let col = 14; col >= 1; col -= 1) {
			seats.push(`${row}${col}`);
		}
	}

	for (let col = 12; col >= 1; col -= 1) {
		seats.push(`L${col}`);
	}

	return seats;
}

function buildIMAXSeatMap() {
	const rowConfigs = [
		{ row: "A", max: 19 },
		{ row: "B", max: 23 },
		{ row: "C", max: 27 },
		{ row: "D", max: 31 },
		{ row: "E", max: 33 },
		{ row: "F", max: 33 },
		{ row: "G", max: 37 },
		{ row: "H", max: 37 },
		{ row: "J", max: 37 },
		{ row: "K", max: 37 },
		{ row: "L", max: 37 },
		{ row: "M", max: 37 },
		{ row: "N", max: 37 },
		{ row: "O", max: 37 },
		{ row: "P", max: 35 },
	];

	const seats = [];
	for (const config of rowConfigs) {
		for (let col = config.max; col >= 1; col -= 1) {
			seats.push(`${config.row}${col}`);
		}
	}

	return seats;
}

function getSeatLayoutPreset(formatName) {
	const normalized = String(formatName || "").trim().toUpperCase();

	if (normalized === "IMAX") {
		return { totalSeats: 497, seatsPerRow: 37 };
	}

	if (normalized === "SVIP") {
		return { totalSeats: 64, seatsPerRow: 8 };
	}

	if (normalized === "3D") {
		return { totalSeats: 140, seatsPerRow: 10 };
	}

	if (normalized === "4D") {
		return { totalSeats: 100, seatsPerRow: 10 };
	}

	return { totalSeats: 166, seatsPerRow: 14 };
}

function buildSeatMap(formatName, fallbackTotalSeats = 0) {
	const normalized = String(formatName || "").trim().toUpperCase();
	if (normalized === "IMAX") {
		return buildIMAXSeatMap();
	}

	if (!normalized || normalized === "2D") {
		return build2DSeatMap();
	}

	const preset = getSeatLayoutPreset(formatName);
	const totalSeats = Number(fallbackTotalSeats) > 0 ? Number(fallbackTotalSeats) : preset.totalSeats;
	const seatsPerRow = preset.seatsPerRow;

	const seats = [];
	for (let i = 0; i < totalSeats; i += 1) {
		const row = String.fromCharCode(65 + Math.floor(i / seatsPerRow));
		const col = (i % seatsPerRow) + 1;
		seats.push(`${row}${col}`);
	}
	return seats;
}

function getLastRowCode(formatName, fallbackTotalSeats = 0) {
	const normalized = String(formatName || "").trim().toUpperCase();
	if (normalized === "IMAX") {
		return "P";
	}

	if (!normalized || normalized === "2D") {
		return "L";
	}

	const preset = getSeatLayoutPreset(formatName);
	const totalSeats = Number(fallbackTotalSeats) > 0 ? Number(fallbackTotalSeats) : preset.totalSeats;
	const rows = Math.ceil(totalSeats / preset.seatsPerRow);
	return String.fromCharCode(65 + Math.max(0, rows - 1));
}

function isPremiumViewSeatLabel(label) {
	const parsed = parseSeatLabel(label);
	if (!parsed) {
		return false;
	}

	return parsed.row.charCodeAt(0) >= 69;
}

function parseSeatLabel(label) {
	const match = /^([A-Z])(\d+)$/.exec(String(label || "").trim().toUpperCase());
	if (!match) {
		return null;
	}

	return {
		row: match[1],
		col: Number(match[2]),
	};
}

function getSeatPairLabel(label) {
	const parsed = parseSeatLabel(label);
	if (!parsed) {
		return null;
	}

	const pairedCol = parsed.col % 2 === 0 ? parsed.col - 1 : parsed.col + 1;
	return `${parsed.row}${pairedCol}`;
}

function calculateCoupleSeatSurcharge(formatName, totalSeats, selectedSeats) {
	const lastRowCode = getLastRowCode(formatName, totalSeats);
	const normalizedSelected = [...new Set((selectedSeats || []).map((item) => normalizeSeatLabel(item)).filter(Boolean))];
	const selectedSet = new Set(normalizedSelected);

	const lastRowSeats = normalizedSelected.filter((seat) => seat.startsWith(lastRowCode));
	for (const seat of lastRowSeats) {
		const pairSeat = getSeatPairLabel(seat);
		if (!pairSeat || !selectedSet.has(pairSeat)) {
			return { ok: false, message: `Ghế cặp đôi ${seat} phải chọn theo cặp liên tiếp`, surcharge: 0 };
		}
	}

	const pairKeys = new Set();
	for (const seat of lastRowSeats) {
		const parsed = parseSeatLabel(seat);
		if (!parsed) {
			continue;
		}
		const baseCol = parsed.col % 2 === 0 ? parsed.col - 1 : parsed.col;
		pairKeys.add(`${parsed.row}-${baseCol}`);
	}

	return {
		ok: true,
		surcharge: pairKeys.size * 20000,
		couplePairs: pairKeys.size,
	};
}

function calculatePremiumViewSurcharge(selectedSeats) {
	const normalizedSelected = [...new Set((selectedSeats || []).map((item) => normalizeSeatLabel(item)).filter(Boolean))];
	const premiumSeatCount = normalizedSelected.filter((seat) => isPremiumViewSeatLabel(seat)).length;

	return {
		surcharge: premiumSeatCount * 15000,
		premiumSeatCount,
	};
}

function toJsonArray(value) {
	if (!value) {
		return [];
	}

	if (Array.isArray(value)) {
		return value;
	}

	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function toNumberArray(values) {
	if (!Array.isArray(values)) {
		return [];
	}

	const unique = new Set();
	for (const raw of values) {
		const num = Number(raw);
		if (Number.isFinite(num) && num > 0) {
			unique.add(num);
		}
	}

	return [...unique];
}

async function getDefaultFormatId(pool) {
	const [[row]] = await pool.query("SELECT id FROM movie_formats WHERE name = '2D' LIMIT 1");
	return row?.id || null;
}

async function setMovieFormatMappings(pool, movieId, formatIds) {
	await pool.query("DELETE FROM movie_format_mappings WHERE movie_id = ?", [movieId]);

	const cleanFormatIds = toNumberArray(formatIds);
	if (!cleanFormatIds.length) {
		const defaultFormatId = await getDefaultFormatId(pool);
		if (defaultFormatId) {
			await pool.query("INSERT INTO movie_format_mappings (movie_id, format_id) VALUES (?, ?)", [movieId, defaultFormatId]);
		}
		return;
	}

	for (const formatId of cleanFormatIds) {
		await pool.query("INSERT INTO movie_format_mappings (movie_id, format_id) VALUES (?, ?)", [movieId, formatId]);
	}
}

async function attachFormatsToMovies(pool, movies) {
	if (!Array.isArray(movies) || !movies.length) {
		return;
	}

	const movieIds = movies.map((item) => Number(item.id)).filter((id) => Number.isFinite(id) && id > 0);
	if (!movieIds.length) {
		return;
	}

	const placeholders = movieIds.map(() => "?").join(",");
	const [rows] = await pool.query(
		`SELECT mm.movie_id AS movieId, f.id AS formatId, f.name AS formatName
		 FROM movie_format_mappings mm
		 JOIN movie_formats f ON f.id = mm.format_id
		 WHERE mm.movie_id IN (${placeholders})
		 ORDER BY f.name ASC`,
		movieIds
	);

	const formatMap = new Map();
	for (const row of rows) {
		if (!formatMap.has(row.movieId)) {
			formatMap.set(row.movieId, []);
		}
		formatMap.get(row.movieId).push({ id: row.formatId, name: row.formatName });
	}

	for (const movie of movies) {
		const formats = formatMap.get(Number(movie.id)) || [];
		movie.formats = formats;
		movie.formatIds = formats.map((item) => item.id);
		movie.formatNames = formats.map((item) => item.name);
	}
}

async function getTakenSeats(pool, showtimeId) {
	const [rows] = await pool.query(
		"SELECT seat_list AS seatList FROM booking_orders WHERE showtime_id = ? AND status IN ('pending', 'confirmed')",
		[showtimeId]
	);

	const taken = new Set();
	for (const row of rows) {
		for (const seat of toJsonArray(row.seatList)) {
			taken.add(normalizeSeatLabel(seat));
		}
	}

	return taken;
}

async function getFormatNameById(pool, formatId) {
	if (!formatId) {
		return "2D";
	}

	const [[row]] = await pool.query("SELECT name FROM movie_formats WHERE id = ? LIMIT 1", [formatId]);
	return row?.name || "2D";
}

const server = http.createServer(async (req, res) => {
	const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
	const pathname = requestUrl.pathname;

	if (pathname.startsWith("/api/")) {
		try {
			await initializeDatabase();
			const pool = getPool();
			const authUser = await getAuthUser(req, pool);

			if (pathname === "/api/db-test" && req.method === "GET") {
				const result = await testDatabaseConnection();
				sendJson(res, 200, {
					ok: true,
					message: "Kết nối XAMPP MySQL thành công",
					serverTime: result.serverTime,
					databaseName: result.databaseName,
				});
				return;
			}

			if (pathname === "/api/auth/register" && req.method === "POST") {
				const body = await readJsonBody(req);
				if (!body.fullName || !body.email || !body.password) {
					sendBadRequest(res, "Cần cung cấp fullName, email và password");
					return;
				}

				if (String(body.password).length < 6) {
					sendBadRequest(res, "Mật khẩu phải có ít nhất 6 ký tự");
					return;
				}

				const passwordHash = await bcrypt.hash(body.password, 10);
				const [result] = await pool.query(
					"INSERT INTO users (full_name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, 'user')",
					[body.fullName, body.email, passwordHash, body.phone || null]
				);

				const token = createToken({ id: result.insertId, email: body.email, role: "user" });
				sendJson(res, 201, {
					ok: true,
					message: "Đăng ký thành công",
					token,
					user: {
						id: result.insertId,
						fullName: body.fullName,
						email: body.email,
						role: "user",
					},
				});
				return;
			}

			if (pathname === "/api/auth/login" && req.method === "POST") {
				const body = await readJsonBody(req);
				if (!body.email || !body.password) {
					sendBadRequest(res, "Cần cung cấp email và password");
					return;
				}

				const [rows] = await pool.query(
					"SELECT id, full_name AS fullName, email, password_hash AS passwordHash, role FROM users WHERE email = ? LIMIT 1",
					[body.email]
				);
				if (!rows.length || !rows[0].passwordHash) {
					sendJson(res, 401, { ok: false, message: "Email hoặc mật khẩu không đúng" });
					return;
				}

				const valid = await bcrypt.compare(body.password, rows[0].passwordHash);
				if (!valid) {
					sendJson(res, 401, { ok: false, message: "Email hoặc mật khẩu không đúng" });
					return;
				}

				const token = createToken(rows[0]);
				sendJson(res, 200, {
					ok: true,
					message: "Đăng nhập thành công",
					token,
					user: {
						id: rows[0].id,
						fullName: rows[0].fullName,
						email: rows[0].email,
						role: rows[0].role,
					},
				});
				return;
			}

			if (pathname === "/api/auth/me" && req.method === "GET") {
				if (!authUser) {
					sendJson(res, 401, { ok: false, message: "Chưa đăng nhập" });
					return;
				}
				sendJson(res, 200, { ok: true, user: authUser });
				return;
			}

			if (pathname === "/api/movies" && req.method === "GET") {
				const status = requestUrl.searchParams.get("status");
				if (status) {
					const [rows] = await pool.query(
						"SELECT id, title, description, genre, director, cast_info AS castInfo, language, rated, duration_minutes AS durationMinutes, release_date AS releaseDate, status, poster_url AS posterUrl, created_at AS createdAt FROM movies WHERE status = ? ORDER BY id DESC",
						[status]
					);
					await attachFormatsToMovies(pool, rows);
					sendJson(res, 200, { ok: true, data: rows });
					return;
				}

				const [rows] = await pool.query(
					"SELECT id, title, description, genre, director, cast_info AS castInfo, language, rated, duration_minutes AS durationMinutes, release_date AS releaseDate, status, poster_url AS posterUrl, created_at AS createdAt FROM movies ORDER BY id DESC"
				);
				await attachFormatsToMovies(pool, rows);
				sendJson(res, 200, { ok: true, data: rows });
				return;
			}

			const movieId = parseIdFromPath(pathname, "/api/movies");
			if (movieId && req.method === "GET") {
				const [movieRows] = await pool.query(
					"SELECT id, title, description, genre, director, cast_info AS castInfo, language, rated, duration_minutes AS durationMinutes, release_date AS releaseDate, status, poster_url AS posterUrl, created_at AS createdAt FROM movies WHERE id = ? LIMIT 1",
					[movieId]
				);
				if (!movieRows.length) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy phim" });
					return;
				}

				const [showtimeRows] = await pool.query(
					`SELECT s.id, s.start_time AS startTime, s.price, s.total_seats AS totalSeats,
						s.format_id AS formatId, f.name AS formatName,
						t.id AS theaterId, t.name AS theaterName, t.city, t.address
					 FROM showtimes s
					 JOIN theaters t ON t.id = s.theater_id
					 LEFT JOIN movie_formats f ON f.id = s.format_id
					 WHERE s.movie_id = ?
					 ORDER BY s.start_time ASC`,
					[movieId]
				);

				await attachFormatsToMovies(pool, movieRows);

				sendJson(res, 200, {
					ok: true,
					data: {
						...movieRows[0],
						showtimes: showtimeRows,
					},
				});
				return;
			}

			if (pathname === "/api/formats" && req.method === "GET") {
				const [rows] = await pool.query("SELECT id, name, created_at AS createdAt FROM movie_formats ORDER BY name ASC");
				sendJson(res, 200, { ok: true, data: rows });
				return;
			}

			if (pathname === "/api/theaters" && req.method === "GET") {
				const [rows] = await pool.query("SELECT id, name, city, address, created_at AS createdAt FROM theaters ORDER BY id DESC");
				sendJson(res, 200, { ok: true, data: rows });
				return;
			}

			if (pathname === "/api/showtimes" && req.method === "GET") {
				const movieFilter = requestUrl.searchParams.get("movieId");
				const theaterFilter = requestUrl.searchParams.get("theaterId");
				const params = [];
				let sql = `SELECT s.id, s.movie_id AS movieId, m.title AS movieTitle,
					s.theater_id AS theaterId, t.name AS theaterName,
					s.format_id AS formatId, f.name AS formatName,
					s.start_time AS startTime, s.price, s.total_seats AS totalSeats
					FROM showtimes s
					JOIN movies m ON m.id = s.movie_id
					JOIN theaters t ON t.id = s.theater_id
					LEFT JOIN movie_formats f ON f.id = s.format_id`;

				const conditions = [];
				if (movieFilter) {
					conditions.push("s.movie_id = ?");
					params.push(movieFilter);
				}
				if (theaterFilter) {
					conditions.push("s.theater_id = ?");
					params.push(theaterFilter);
				}

				if (conditions.length) {
					sql += ` WHERE ${conditions.join(" AND ")}`;
				}
				sql += " ORDER BY s.start_time ASC";

				const [rows] = await pool.query(sql, params);
				sendJson(res, 200, { ok: true, data: rows });
				return;
			}

			const showtimeSeatsMatch = pathname.match(/^\/api\/showtimes\/(\d+)\/seats$/);
			if (showtimeSeatsMatch && req.method === "GET") {
				const showtimeId = Number(showtimeSeatsMatch[1]);
				const [rows] = await pool.query(
					`SELECT s.id, s.total_seats AS totalSeats, s.format_id AS formatId, f.name AS formatName
					 FROM showtimes s
					 LEFT JOIN movie_formats f ON f.id = s.format_id
					 WHERE s.id = ? LIMIT 1`,
					[showtimeId]
				);
				if (!rows.length) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy suất chiếu" });
					return;
				}

				const formatName = rows[0].formatName || "2D";
				const totalSeats = Number(rows[0].totalSeats);
				const allSeats = buildSeatMap(formatName, totalSeats);
				const lastRowCode = getLastRowCode(formatName, totalSeats);
				const takenSet = await getTakenSeats(pool, showtimeId);
				sendJson(res, 200, {
					ok: true,
					data: {
						showtimeId,
						totalSeats: allSeats.length,
						formatName,
						seats: allSeats.map((label) => ({
							label,
							taken: takenSet.has(label),
							seatType:
								String(label || "").charAt(0).toUpperCase() === lastRowCode
									? "couple"
									: isPremiumViewSeatLabel(label)
										? "premium"
										: "standard",
						})),
					},
				});
				return;
			}

			if (pathname === "/api/combos" && req.method === "GET") {
				const [rows] = await pool.query("SELECT id, name, description, image_url AS imageUrl, price, created_at AS createdAt FROM combos ORDER BY id DESC");
				sendJson(res, 200, { ok: true, data: rows });
				return;
			}

			if (pathname === "/api/blogs" && req.method === "GET") {
				const includeDraft = requestUrl.searchParams.get("includeDraft") === "1";
				let sql =
					"SELECT id, title, summary, content, image_url AS imageUrl, status, created_at AS createdAt, updated_at AS updatedAt FROM blogs";
				const params = [];
				if (!includeDraft) {
					sql += " WHERE status = 'published'";
				}
				sql += " ORDER BY created_at DESC";
				const [rows] = await pool.query(sql, params);
				sendJson(res, 200, { ok: true, data: rows });
				return;
			}

			const blogId = parseIdFromPath(pathname, "/api/blogs");
			if (blogId && req.method === "GET") {
				const [[row]] = await pool.query(
					"SELECT id, title, summary, content, image_url AS imageUrl, status, created_at AS createdAt, updated_at AS updatedAt FROM blogs WHERE id = ? LIMIT 1",
					[blogId]
				);
				if (!row) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy blog" });
					return;
				}
				if (row.status !== "published" && (!authUser || authUser.role !== "admin")) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy blog" });
					return;
				}
				sendJson(res, 200, { ok: true, data: row });
				return;
			}

			if (pathname === "/api/checkout" && req.method === "POST") {
				if (!authUser) {
					sendJson(res, 401, { ok: false, message: "Vui lòng đăng nhập trước" });
					return;
				}

				const body = await readJsonBody(req);
				if (!body.showtimeId || !Array.isArray(body.seats) || body.seats.length === 0) {
					sendBadRequest(res, "Cần cung cấp showtimeId và danh sách ghế");
					return;
				}

				const [showtimeRows] = await pool.query(
					`SELECT s.id, s.price, s.total_seats AS totalSeats, s.format_id AS formatId, f.name AS formatName
					 FROM showtimes s
					 LEFT JOIN movie_formats f ON f.id = s.format_id
					 WHERE s.id = ? LIMIT 1`,
					[body.showtimeId]
				);
				if (!showtimeRows.length) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy suất chiếu" });
					return;
				}

				const formatName = showtimeRows[0].formatName || "2D";
				const totalSeats = Number(showtimeRows[0].totalSeats);
				const allowedSeats = new Set(buildSeatMap(formatName, totalSeats));
				const selectedSeats = [...new Set(body.seats.map((item) => normalizeSeatLabel(item)).filter(Boolean))];
				if (!selectedSeats.length) {
					sendBadRequest(res, "Danh sách ghế không hợp lệ");
					return;
				}

				for (const seat of selectedSeats) {
					if (!allowedSeats.has(seat)) {
						sendBadRequest(res, `Ghế ${seat} không tồn tại`);
						return;
					}
				}

				const takenSet = await getTakenSeats(pool, body.showtimeId);
				for (const seat of selectedSeats) {
					if (takenSet.has(seat)) {
						sendJson(res, 409, { ok: false, message: `Ghế ${seat} đã được đặt` });
						return;
					}
				}

				const coupleSurchargeResult = calculateCoupleSeatSurcharge(formatName, totalSeats, selectedSeats);
				if (!coupleSurchargeResult.ok) {
					sendBadRequest(res, coupleSurchargeResult.message || "Ghế cặp đôi không hợp lệ");
					return;
				}
				const premiumViewResult = calculatePremiumViewSurcharge(selectedSeats);

				const ticketPrice = Number(showtimeRows[0].price);
				const ticketsTotal =
					ticketPrice * selectedSeats.length + coupleSurchargeResult.surcharge + premiumViewResult.surcharge;
				let combosTotal = 0;
				const combos = Array.isArray(body.combos) ? body.combos : [];
				const comboRowsToInsert = [];

				for (const comboRequest of combos) {
					if (!comboRequest.comboId || !comboRequest.quantity) {
						continue;
					}

					const [comboRows] = await pool.query("SELECT id, price FROM combos WHERE id = ? LIMIT 1", [comboRequest.comboId]);
					if (!comboRows.length) {
						continue;
					}

					const quantity = Number(comboRequest.quantity);
					if (!Number.isFinite(quantity) || quantity <= 0) {
						continue;
					}

					const unitPrice = Number(comboRows[0].price);
					combosTotal += unitPrice * quantity;
					comboRowsToInsert.push({
						comboId: comboRows[0].id,
						quantity,
						unitPrice,
					});
				}

				const totalAmount = ticketsTotal + combosTotal;
				const paymentMethod = body.paymentMethod || "cash";

				const connection = await pool.getConnection();
				await connection.beginTransaction();

				try {
					const [orderResult] = await connection.query(
						"INSERT INTO booking_orders (user_id, showtime_id, seat_list, ticket_price, tickets_total, combos_total, total_amount, payment_method, payment_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')",
						[
							authUser.id,
							body.showtimeId,
							JSON.stringify(selectedSeats),
							ticketPrice,
							ticketsTotal,
							combosTotal,
							totalAmount,
							paymentMethod,
						]
					);

					for (const comboItem of comboRowsToInsert) {
						await connection.query(
							"INSERT INTO booking_order_combos (order_id, combo_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
							[orderResult.insertId, comboItem.comboId, comboItem.quantity, comboItem.unitPrice]
						);
					}

					await connection.commit();

					if (ioInstance) {
						ioInstance.emit("seats_updated", {
							showtimeId: body.showtimeId,
							seats: selectedSeats
						});
					}

					sendJson(res, 201, {
						ok: true,
						message: "Tạo đơn thành công. Vui lòng xác nhận thanh toán",
						data: {
							orderId: orderResult.insertId,
							ticketPrice,
							ticketsTotal,
							premiumSurcharge: premiumViewResult.surcharge,
							premiumSeatCount: premiumViewResult.premiumSeatCount,
							coupleSurcharge: coupleSurchargeResult.surcharge,
							couplePairs: coupleSurchargeResult.couplePairs || 0,
							combosTotal,
							totalAmount,
							paymentMethod,
						},
					});
					return;
				} catch (error) {
					await connection.rollback();
					console.error("Lỗi khi tạo đơn hàng:", error);
					sendJson(res, 500, { ok: false, message: "Lỗi hệ thống khi tạo đơn hàng (Transaction Rollback)" });
					return;
				} finally {
					connection.release();
				}
			}

			const paymentMatch = pathname.match(/^\/api\/payments\/(\d+)\/confirm$/);
			if (paymentMatch && req.method === "POST") {
				if (!authUser) {
					sendJson(res, 401, { ok: false, message: "Chưa đăng nhập" });
					return;
				}

				const orderId = Number(paymentMatch[1]);
				const [rows] = await pool.query(
					"SELECT id, user_id AS userId, payment_status AS paymentStatus, status FROM booking_orders WHERE id = ? LIMIT 1",
					[orderId]
				);
				if (!rows.length) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy đơn hàng" });
					return;
				}

				if (authUser.role !== "admin" && Number(rows[0].userId) !== Number(authUser.id)) {
					sendJson(res, 403, { ok: false, message: "Không có quyền truy cập" });
					return;
				}

				if (rows[0].paymentStatus === "paid") {
					sendJson(res, 200, { ok: true, message: "Thanh toán đã được xác nhận trước đó" });
					return;
				}

				await pool.query("UPDATE booking_orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ?", [orderId]);
				sendJson(res, 200, { ok: true, message: "Xác nhận thanh toán thành công" });
				return;
			}

			if (pathname === "/api/orders/me" && req.method === "GET") {
				if (!authUser) {
					sendJson(res, 401, { ok: false, message: "Chưa đăng nhập" });
					return;
				}

				const [rows] = await pool.query(
					`SELECT o.id, o.showtime_id AS showtimeId, m.title AS movieTitle,
						t.name AS theaterName, s.start_time AS startTime,
						o.seat_list AS seatList, o.total_amount AS totalAmount,
						o.payment_method AS paymentMethod, o.payment_status AS paymentStatus,
						o.status, o.created_at AS createdAt
					FROM booking_orders o
					JOIN showtimes s ON s.id = o.showtime_id
					JOIN movies m ON m.id = s.movie_id
					JOIN theaters t ON t.id = s.theater_id
					WHERE o.user_id = ?
					ORDER BY o.id DESC`,
					[authUser.id]
				);

				sendJson(res, 200, {
					ok: true,
					data: rows.map((row) => ({
						...row,
						seatList: toJsonArray(row.seatList),
					})),
				});
				return;
			}

			if (pathname.startsWith("/api/admin/")) {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}

				if (pathname === "/api/admin/upload" && req.method === "POST") {
					try {
						await runMulter(req, res, upload.single("file"));
						if (!req.file) {
							sendBadRequest(res, "Không có file nào được tải lên");
							return;
						}
						const fileUrl = `/uploads/${req.file.filename}`;
						sendJson(res, 201, { ok: true, message: "Tải file thành công", url: fileUrl });
						return;
					} catch (error) {
						sendJson(res, 500, { ok: false, message: "Lỗi tải file", error: error.message });
						return;
					}
				}

				if (pathname === "/api/admin/overview" && req.method === "GET") {
					const [[movieCount]] = await pool.query("SELECT COUNT(*) AS total FROM movies");
					const [[theaterCount]] = await pool.query("SELECT COUNT(*) AS total FROM theaters");
					const [[showtimeCount]] = await pool.query("SELECT COUNT(*) AS total FROM showtimes");
					const [[orderCount]] = await pool.query("SELECT COUNT(*) AS total FROM booking_orders");
					sendJson(res, 200, {
						ok: true,
						data: {
							movies: Number(movieCount.total),
							theaters: Number(theaterCount.total),
							showtimes: Number(showtimeCount.total),
							orders: Number(orderCount.total),
						},
					});
					return;
				}

				if (pathname === "/api/admin/orders" && req.method === "GET") {
					const [rows] = await pool.query(
						`SELECT o.id, u.full_name AS customerName, u.email,
							m.title AS movieTitle, t.name AS theaterName,
							s.start_time AS startTime, o.seat_list AS seatList,
							o.total_amount AS totalAmount, o.payment_status AS paymentStatus,
							o.status, o.created_at AS createdAt
						FROM booking_orders o
						JOIN users u ON u.id = o.user_id
						JOIN showtimes s ON s.id = o.showtime_id
						JOIN movies m ON m.id = s.movie_id
						JOIN theaters t ON t.id = s.theater_id
						ORDER BY o.id DESC`
					);
					sendJson(res, 200, {
						ok: true,
						data: rows.map((row) => ({
							...row,
							seatList: toJsonArray(row.seatList),
						})),
					});
					return;
				}

				if (pathname === "/api/admin/formats" && req.method === "GET") {
					const [rows] = await pool.query("SELECT id, name, created_at AS createdAt FROM movie_formats ORDER BY name ASC");
					sendJson(res, 200, { ok: true, data: rows });
					return;
				}

				if (pathname === "/api/admin/formats" && req.method === "POST") {
					const body = await readJsonBody(req);
					const formatName = String(body.name || "").trim().toUpperCase();
					if (!formatName) {
						sendBadRequest(res, "Cần cung cấp tên định dạng");
						return;
					}

					const [result] = await pool.query("INSERT INTO movie_formats (name) VALUES (?)", [formatName]);
					sendJson(res, 201, { ok: true, message: "Tạo định dạng thành công", id: result.insertId });
					return;
				}

				const adminFormatId = parseIdFromPath(pathname, "/api/admin/formats");
				if (adminFormatId && req.method === "PUT") {
					const body = await readJsonBody(req);
					const formatName = String(body.name || "").trim().toUpperCase();
					if (!formatName) {
						sendBadRequest(res, "Cần cung cấp tên định dạng");
						return;
					}

					const [result] = await pool.query("UPDATE movie_formats SET name = ? WHERE id = ?", [formatName, adminFormatId]);
					if (!result.affectedRows) {
						sendJson(res, 404, { ok: false, message: "Không tìm thấy định dạng" });
						return;
					}
					sendJson(res, 200, { ok: true, message: "Cập nhật định dạng thành công" });
					return;
				}

				if (adminFormatId && req.method === "DELETE") {
					const [result] = await pool.query("DELETE FROM movie_formats WHERE id = ?", [adminFormatId]);
					if (!result.affectedRows) {
						sendJson(res, 404, { ok: false, message: "Không tìm thấy định dạng" });
						return;
					}
					sendJson(res, 200, { ok: true, message: "Xóa định dạng thành công" });
					return;
				}
			}

			if (pathname === "/api/admin/movies" && req.method === "POST") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}

				const body = await readJsonBody(req);
				if (!body.title) {
					sendBadRequest(res, "Cần cung cấp tiêu đề phim");
					return;
				}

				const [result] = await pool.query(
					"INSERT INTO movies (title, description, genre, director, cast_info, language, rated, duration_minutes, release_date, status, poster_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					[
						body.title,
						body.description || null,
						body.genre || null,
						body.director || null,
						body.castInfo || null,
						body.language || null,
						body.rated || null,
						body.durationMinutes || null,
						body.releaseDate || null,
						body.status || "coming_soon",
						body.posterUrl || null,
					]
				);

				await setMovieFormatMappings(pool, result.insertId, body.formatIds);
				sendJson(res, 201, { ok: true, message: "Tạo phim thành công", id: result.insertId });
				return;
			}

			const adminMovieId = parseIdFromPath(pathname, "/api/admin/movies");
			if (adminMovieId && req.method === "PUT") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}

				const body = await readJsonBody(req);
				if (!body.title) {
					sendBadRequest(res, "Cần cung cấp tiêu đề phim");
					return;
				}

				const [result] = await pool.query(
					"UPDATE movies SET title = ?, description = ?, genre = ?, director = ?, cast_info = ?, language = ?, rated = ?, duration_minutes = ?, release_date = ?, status = ?, poster_url = ? WHERE id = ?",
					[
						body.title,
						body.description || null,
						body.genre || null,
						body.director || null,
						body.castInfo || null,
						body.language || null,
						body.rated || null,
						body.durationMinutes || null,
						body.releaseDate || null,
						body.status || "coming_soon",
						body.posterUrl || null,
						adminMovieId,
					]
				);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy phim" });
					return;
				}
				await setMovieFormatMappings(pool, adminMovieId, body.formatIds);
				sendJson(res, 200, { ok: true, message: "Cập nhật phim thành công" });
				return;
			}

			if (adminMovieId && req.method === "DELETE") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const [result] = await pool.query("DELETE FROM movies WHERE id = ?", [adminMovieId]);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy phim" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Xóa phim thành công" });
				return;
			}

			if (pathname === "/api/admin/theaters" && req.method === "POST") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.name) {
					sendBadRequest(res, "Cần cung cấp tên rạp");
					return;
				}
				const [result] = await pool.query("INSERT INTO theaters (name, city, address) VALUES (?, ?, ?)", [
					body.name,
					body.city || null,
					body.address || null,
				]);
				sendJson(res, 201, { ok: true, message: "Tạo rạp thành công", id: result.insertId });
				return;
			}

			const adminTheaterId = parseIdFromPath(pathname, "/api/admin/theaters");
			if (adminTheaterId && req.method === "PUT") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.name) {
					sendBadRequest(res, "Cần cung cấp tên rạp");
					return;
				}
				const [result] = await pool.query("UPDATE theaters SET name = ?, city = ?, address = ? WHERE id = ?", [
					body.name,
					body.city || null,
					body.address || null,
					adminTheaterId,
				]);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy rạp" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Cập nhật rạp thành công" });
				return;
			}

			if (adminTheaterId && req.method === "DELETE") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const [result] = await pool.query("DELETE FROM theaters WHERE id = ?", [adminTheaterId]);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy rạp" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Xóa rạp thành công" });
				return;
			}

			if (pathname === "/api/admin/showtimes" && req.method === "POST") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.movieId || !body.theaterId || !body.formatId || !body.startTime || !body.price) {
					sendBadRequest(res, "Cần cung cấp movieId, theaterId, formatId, startTime và price");
					return;
				}
				const formatName = await getFormatNameById(pool, body.formatId);
				const layoutPreset = getSeatLayoutPreset(formatName);
				const [result] = await pool.query(
					"INSERT INTO showtimes (movie_id, theater_id, format_id, start_time, price, total_seats) VALUES (?, ?, ?, ?, ?, ?)",
					[body.movieId, body.theaterId, body.formatId, body.startTime, body.price, layoutPreset.totalSeats]
				);
				sendJson(res, 201, { ok: true, message: "Tạo suất chiếu thành công", id: result.insertId });
				return;
			}

			const adminShowtimeId = parseIdFromPath(pathname, "/api/admin/showtimes");
			if (adminShowtimeId && req.method === "PUT") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.movieId || !body.theaterId || !body.formatId || !body.startTime || !body.price) {
					sendBadRequest(res, "Cần cung cấp movieId, theaterId, formatId, startTime và price");
					return;
				}
				const formatName = await getFormatNameById(pool, body.formatId);
				const layoutPreset = getSeatLayoutPreset(formatName);
				const [result] = await pool.query(
					"UPDATE showtimes SET movie_id = ?, theater_id = ?, format_id = ?, start_time = ?, price = ?, total_seats = ? WHERE id = ?",
					[
						body.movieId,
						body.theaterId,
						body.formatId,
						body.startTime,
						body.price,
						layoutPreset.totalSeats,
						adminShowtimeId,
					]
				);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy suất chiếu" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Cập nhật suất chiếu thành công" });
				return;
			}

			if (adminShowtimeId && req.method === "DELETE") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const [result] = await pool.query("DELETE FROM showtimes WHERE id = ?", [adminShowtimeId]);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy suất chiếu" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Xóa suất chiếu thành công" });
				return;
			}

			if (pathname === "/api/admin/combos" && req.method === "POST") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.name || !body.price) {
					sendBadRequest(res, "Cần cung cấp tên combo và giá");
					return;
				}
				const [result] = await pool.query("INSERT INTO combos (name, description, image_url, price) VALUES (?, ?, ?, ?)", [
					body.name,
					body.description || null,
					body.imageUrl || null,
					body.price,
				]);
				sendJson(res, 201, { ok: true, message: "Tạo combo thành công", id: result.insertId });
				return;
			}

			if (pathname === "/api/admin/blogs" && req.method === "POST") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.title || !body.content) {
					sendBadRequest(res, "Cần cung cấp tiêu đề và nội dung blog");
					return;
				}
				const blogStatus = body.status === "draft" ? "draft" : "published";
				const [result] = await pool.query(
					"INSERT INTO blogs (title, summary, content, image_url, status) VALUES (?, ?, ?, ?, ?)",
					[body.title, body.summary || null, body.content, body.imageUrl || null, blogStatus]
				);
				sendJson(res, 201, { ok: true, message: "Tạo blog thành công", id: result.insertId });
				return;
			}

			const adminComboId = parseIdFromPath(pathname, "/api/admin/combos");
			const adminBlogId = parseIdFromPath(pathname, "/api/admin/blogs");
			const adminOrderId = parseIdFromPath(pathname, "/api/admin/orders");
			if (adminOrderId && req.method === "PUT") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}

				const body = await readJsonBody(req);
				const status = body.status || "pending";
				const paymentStatus = body.paymentStatus || "pending";
				const allowedStatus = ["pending", "confirmed", "cancelled"];
				const allowedPayment = ["pending", "paid", "failed"];

				if (!allowedStatus.includes(status) || !allowedPayment.includes(paymentStatus)) {
					sendBadRequest(res, "Trạng thái đơn hoặc thanh toán không hợp lệ");
					return;
				}

				const [result] = await pool.query(
					"UPDATE booking_orders SET status = ?, payment_status = ? WHERE id = ?",
					[status, paymentStatus, adminOrderId]
				);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy đơn hàng" });
					return;
				}

				sendJson(res, 200, { ok: true, message: "Cập nhật đơn hàng thành công" });
				return;
			}

			if (adminComboId && req.method === "PUT") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.name || !body.price) {
					sendBadRequest(res, "Cần cung cấp tên combo và giá");
					return;
				}
				const [result] = await pool.query("UPDATE combos SET name = ?, description = ?, image_url = ?, price = ? WHERE id = ?", [
					body.name,
					body.description || null,
					body.imageUrl || null,
					body.price,
					adminComboId,
				]);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy combo" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Cập nhật combo thành công" });
				return;
			}

			if (adminComboId && req.method === "DELETE") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const [result] = await pool.query("DELETE FROM combos WHERE id = ?", [adminComboId]);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy combo" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Xóa combo thành công" });
				return;
			}

			if (adminBlogId && req.method === "PUT") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const body = await readJsonBody(req);
				if (!body.title || !body.content) {
					sendBadRequest(res, "Cần cung cấp tiêu đề và nội dung blog");
					return;
				}
				const blogStatus = body.status === "draft" ? "draft" : "published";
				const [result] = await pool.query(
					"UPDATE blogs SET title = ?, summary = ?, content = ?, image_url = ?, status = ? WHERE id = ?",
					[body.title, body.summary || null, body.content, body.imageUrl || null, blogStatus, adminBlogId]
				);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy blog" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Cập nhật blog thành công" });
				return;
			}

			if (adminBlogId && req.method === "DELETE") {
				if (!authUser || authUser.role !== "admin") {
					sendJson(res, 403, { ok: false, message: "Cần quyền admin" });
					return;
				}
				const [result] = await pool.query("DELETE FROM blogs WHERE id = ?", [adminBlogId]);
				if (!result.affectedRows) {
					sendJson(res, 404, { ok: false, message: "Không tìm thấy blog" });
					return;
				}
				sendJson(res, 200, { ok: true, message: "Xóa blog thành công" });
				return;
			}

			sendJson(res, 404, { ok: false, message: "Không tìm thấy API" });
			return;
		} catch (error) {
			if (error.code === "ER_DUP_ENTRY") {
				sendJson(res, 409, { ok: false, message: "Dữ liệu bị trùng", error: error.message });
				return;
			}

			if (error.message === "JSON không hợp lệ" || error.message === "Dữ liệu gửi lên quá lớn") {
				sendBadRequest(res, error.message);
				return;
			}

			sendJson(res, 500, {
				ok: false,
				message: "Lỗi máy chủ nội bộ",
				error: error.message,
			});
			return;
		}
	}

	const requestPath = pathname === "/" ? "/index.html" : pathname;
	const safePath = path.normalize(requestPath).replace(/^([.][.][/\\])+/, "");
	const filePath = path.join(publicDir, safePath);

	if (!filePath.startsWith(publicDir)) {
		res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
		res.end("Forbidden");
		return;
	}

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Not found");
			return;
		}

		const ext = path.extname(filePath).toLowerCase();
		const contentType = mimeTypes[ext] || "application/octet-stream";
		res.writeHead(200, { "Content-Type": contentType });
		res.end(data);
	});
});

ioInstance = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST", "PUT", "DELETE"]
	}
});

ioInstance.on("connection", (socket) => {
	console.log("WebSocket client connected:", socket.id);
	socket.on("disconnect", () => {
		console.log("WebSocket client disconnected:", socket.id);
	});
});

server.listen(port, () => {
	console.log(`Cinema home is running at http://localhost:${port}`);
	console.log(`Socket.IO realtime server attached.`);
});
