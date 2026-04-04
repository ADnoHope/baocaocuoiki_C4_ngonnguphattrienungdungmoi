const { toJsonArray, toNumberArray } = require("./utils");

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
		{ row: "A", max: 19 }, { row: "B", max: 23 }, { row: "C", max: 27 }, { row: "D", max: 31 },
		{ row: "E", max: 33 }, { row: "F", max: 33 }, { row: "G", max: 37 }, { row: "H", max: 37 },
		{ row: "J", max: 37 }, { row: "K", max: 37 }, { row: "L", max: 37 }, { row: "M", max: 37 },
		{ row: "N", max: 37 }, { row: "O", max: 37 }, { row: "P", max: 35 },
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
	if (normalized === "IMAX") return { totalSeats: 497, seatsPerRow: 37 };
	if (normalized === "SVIP") return { totalSeats: 64, seatsPerRow: 8 };
	if (normalized === "3D") return { totalSeats: 140, seatsPerRow: 10 };
	if (normalized === "4D") return { totalSeats: 100, seatsPerRow: 10 };
	return { totalSeats: 166, seatsPerRow: 14 };
}

function buildSeatMap(formatName, fallbackTotalSeats = 0) {
	const normalized = String(formatName || "").trim().toUpperCase();
	if (normalized === "IMAX") return buildIMAXSeatMap();
	if (!normalized || normalized === "2D") return build2DSeatMap();

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
	if (normalized === "IMAX") return "P";
	if (!normalized || normalized === "2D") return "L";

	const preset = getSeatLayoutPreset(formatName);
	const totalSeats = Number(fallbackTotalSeats) > 0 ? Number(fallbackTotalSeats) : preset.totalSeats;
	const rows = Math.ceil(totalSeats / preset.seatsPerRow);
	return String.fromCharCode(65 + Math.max(0, rows - 1));
}

function parseSeatLabel(label) {
	const match = /^([A-Z])(\d+)$/.exec(String(label || "").trim().toUpperCase());
	if (!match) return null;
	return { row: match[1], col: Number(match[2]) };
}

function isPremiumViewSeatLabel(label) {
	const parsed = parseSeatLabel(label);
	if (!parsed) return false;
	return parsed.row.charCodeAt(0) >= 69;
}

function getSeatPairLabel(label) {
	const parsed = parseSeatLabel(label);
	if (!parsed) return null;
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
		if (!parsed) continue;
		const baseCol = parsed.col % 2 === 0 ? parsed.col - 1 : parsed.col;
		pairKeys.add(`${parsed.row}-${baseCol}`);
	}

	return { ok: true, surcharge: pairKeys.size * 20000, couplePairs: pairKeys.size };
}

function calculatePremiumViewSurcharge(selectedSeats) {
	const normalizedSelected = [...new Set((selectedSeats || []).map((item) => normalizeSeatLabel(item)).filter(Boolean))];
	const premiumSeatCount = normalizedSelected.filter((seat) => isPremiumViewSeatLabel(seat)).length;
	return { surcharge: premiumSeatCount * 15000, premiumSeatCount };
}

async function attachFormatsToMovies(pool, movies) {
	if (!Array.isArray(movies) || !movies.length) return;
	const movieIds = movies.map((item) => Number(item.id)).filter((id) => Number.isFinite(id) && id > 0);
	if (!movieIds.length) return;

	const placeholders = movieIds.map(() => "?").join(",");
	const [rows] = await pool.query(
		`SELECT mm.movie_id AS movieId, f.id AS formatId, f.name AS formatName
		 FROM movie_format_mappings mm JOIN movie_formats f ON f.id = mm.format_id
		 WHERE mm.movie_id IN (${placeholders}) ORDER BY f.name ASC`,
		movieIds
	);

	const formatMap = new Map();
	for (const row of rows) {
		if (!formatMap.has(row.movieId)) formatMap.set(row.movieId, []);
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
	if (!formatId) return "2D";
	const [[row]] = await pool.query("SELECT name FROM movie_formats WHERE id = ? LIMIT 1", [formatId]);
	return row?.name || "2D";
}

async function setMovieFormatMappings(pool, movieId, formatIds) {
	await pool.query("DELETE FROM movie_format_mappings WHERE movie_id = ?", [movieId]);
	const cleanFormatIds = toNumberArray(formatIds);
	if (!cleanFormatIds.length) {
		const [[df]] = await pool.query("SELECT id FROM movie_formats WHERE name = '2D' LIMIT 1");
		if (df) await pool.query("INSERT INTO movie_format_mappings (movie_id, format_id) VALUES (?, ?)", [movieId, df.id]);
		return;
	}
	for (const fid of cleanFormatIds) {
		await pool.query("INSERT INTO movie_format_mappings (movie_id, format_id) VALUES (?, ?)", [movieId, fid]);
	}
}

module.exports = {
	normalizeSeatLabel,
	buildSeatMap,
	getLastRowCode,
	isPremiumViewSeatLabel,
	calculateCoupleSeatSurcharge,
	calculatePremiumViewSurcharge,
	attachFormatsToMovies,
	getTakenSeats,
	getFormatNameById,
	setMovieFormatMappings,
	getSeatLayoutPreset,
};
