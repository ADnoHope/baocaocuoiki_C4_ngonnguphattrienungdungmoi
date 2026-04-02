const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const baseConfig = {
	host: process.env.DB_HOST || "127.0.0.1",
	port: Number(process.env.DB_PORT || 3306),
	user: process.env.DB_USER || "root",
	password: process.env.DB_PASSWORD || "",
};

const dbName = process.env.DB_NAME || "webxemphim";

function createDbPool() {
	return mysql.createPool({
		...baseConfig,
		database: dbName,
		waitForConnections: true,
		connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
		queueLimit: 0,
	});
}

let pool = createDbPool();
let schemaReadyPromise;

async function ensureColumnExists(tableName, columnName, alterClause) {
	const [rows] = await pool.query(
		"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
		[dbName, tableName, columnName]
	);

	if (!rows.length) {
		await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${alterClause}`);
	}
}

async function ensureDatabaseExists() {
	const connection = await mysql.createConnection(baseConfig);
	await connection.query("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [dbName]);
	await connection.end();
}

async function testDatabaseConnection() {
	try {
		const [rows] = await pool.query("SELECT NOW() AS serverTime, DATABASE() AS databaseName");
		return rows[0];
	} catch (error) {
		if (error.code === "ER_BAD_DB_ERROR") {
			await ensureDatabaseExists();
			pool = createDbPool();
			const [rows] = await pool.query("SELECT NOW() AS serverTime, DATABASE() AS databaseName");
			return rows[0];
		}

		throw error;
	}
}

async function initializeDatabase() {
	if (schemaReadyPromise) {
		return schemaReadyPromise;
	}

	schemaReadyPromise = (async () => {
		await testDatabaseConnection();

		await pool.query(`
			CREATE TABLE IF NOT EXISTS users (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				full_name VARCHAR(120) NOT NULL,
				email VARCHAR(190) NOT NULL UNIQUE,
				password_hash VARCHAR(255) NULL,
				role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
				phone VARCHAR(20) NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await ensureColumnExists("users", "password_hash", "password_hash VARCHAR(255) NULL AFTER email");
		await ensureColumnExists("users", "role", "role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER password_hash");

		await pool.query(`
			CREATE TABLE IF NOT EXISTS movies (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				title VARCHAR(160) NOT NULL,
				description TEXT NULL,
				genre VARCHAR(80) NULL,
				duration_minutes INT UNSIGNED NULL,
				release_date DATE NULL,
				status ENUM('now_showing', 'coming_soon') NOT NULL DEFAULT 'coming_soon',
				poster_url VARCHAR(255) NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await ensureColumnExists("movies", "description", "description TEXT NULL AFTER title");
		await ensureColumnExists("movies", "director", "director VARCHAR(160) NULL AFTER genre");
		await ensureColumnExists("movies", "cast_info", "cast_info TEXT NULL AFTER director");
		await ensureColumnExists("movies", "language", "language VARCHAR(120) NULL AFTER cast_info");
		await ensureColumnExists("movies", "rated", "rated VARCHAR(50) NULL AFTER language");

		await pool.query(`
			CREATE TABLE IF NOT EXISTS movie_formats (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(40) NOT NULL UNIQUE,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS movie_format_mappings (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				movie_id INT UNSIGNED NOT NULL,
				format_id INT UNSIGNED NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				UNIQUE KEY uq_movie_format (movie_id, format_id),
				CONSTRAINT fk_movie_format_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
				CONSTRAINT fk_movie_format_format FOREIGN KEY (format_id) REFERENCES movie_formats(id) ON DELETE CASCADE
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS theaters (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(160) NOT NULL,
				city VARCHAR(120) NULL,
				address VARCHAR(255) NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS showtimes (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				movie_id INT UNSIGNED NOT NULL,
				theater_id INT UNSIGNED NOT NULL,
				format_id INT UNSIGNED NULL,
				start_time DATETIME NOT NULL,
				price DECIMAL(10, 2) NOT NULL,
				total_seats INT UNSIGNED NOT NULL DEFAULT 60,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT fk_showtimes_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
				CONSTRAINT fk_showtimes_theater FOREIGN KEY (theater_id) REFERENCES theaters(id) ON DELETE CASCADE,
				CONSTRAINT fk_showtimes_format FOREIGN KEY (format_id) REFERENCES movie_formats(id) ON DELETE SET NULL
			)
		`);

		await ensureColumnExists("showtimes", "format_id", "format_id INT UNSIGNED NULL AFTER theater_id");

		await pool.query(`
			CREATE TABLE IF NOT EXISTS combos (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(120) NOT NULL,
				description VARCHAR(255) NULL,
				image_url VARCHAR(255) NULL,
				price DECIMAL(10, 2) NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await ensureColumnExists("combos", "image_url", "image_url VARCHAR(255) NULL AFTER description");

		await pool.query(`
			CREATE TABLE IF NOT EXISTS blogs (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				title VARCHAR(220) NOT NULL,
				summary VARCHAR(320) NULL,
				content LONGTEXT NOT NULL,
				image_url VARCHAR(255) NULL,
				status ENUM('published', 'draft') NOT NULL DEFAULT 'published',
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
			)
		`);

		await ensureColumnExists("blogs", "summary", "summary VARCHAR(320) NULL AFTER title");
		await ensureColumnExists("blogs", "image_url", "image_url VARCHAR(255) NULL AFTER content");
		await ensureColumnExists("blogs", "status", "status ENUM('published', 'draft') NOT NULL DEFAULT 'published' AFTER image_url");

		await pool.query(`
			CREATE TABLE IF NOT EXISTS booking_orders (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				user_id INT UNSIGNED NOT NULL,
				showtime_id INT UNSIGNED NOT NULL,
				seat_list JSON NOT NULL,
				ticket_price DECIMAL(10, 2) NOT NULL,
				tickets_total DECIMAL(10, 2) NOT NULL,
				combos_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
				total_amount DECIMAL(10, 2) NOT NULL,
				payment_method ENUM('momo', 'zalopay', 'vnpay', 'cash') NOT NULL DEFAULT 'cash',
				payment_status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
				status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				CONSTRAINT fk_orders_showtime FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE CASCADE
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS booking_order_combos (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				order_id INT UNSIGNED NOT NULL,
				combo_id INT UNSIGNED NOT NULL,
				quantity INT UNSIGNED NOT NULL,
				unit_price DECIMAL(10, 2) NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT fk_order_combo_order FOREIGN KEY (order_id) REFERENCES booking_orders(id) ON DELETE CASCADE,
				CONSTRAINT fk_order_combo_combo FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS bookings (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				user_id INT UNSIGNED NOT NULL,
				movie_id INT UNSIGNED NOT NULL,
				show_time DATETIME NOT NULL,
				seat_label VARCHAR(20) NOT NULL,
				total_price DECIMAL(10, 2) NOT NULL,
				status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				CONSTRAINT fk_bookings_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
				CONSTRAINT uq_booking_seat UNIQUE (movie_id, show_time, seat_label)
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS reviews (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				user_id INT UNSIGNED NOT NULL,
				movie_id INT UNSIGNED NOT NULL,
				rating TINYINT UNSIGNED NOT NULL DEFAULT 5,
				comment TEXT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				CONSTRAINT fk_reviews_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS promotions (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				code VARCHAR(50) NOT NULL UNIQUE,
				discount_amount DECIMAL(10, 2) NOT NULL,
				min_order_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
				valid_from DATETIME NULL,
				valid_until DATETIME NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		const adminEmail = process.env.ADMIN_EMAIL || "admin@cinema.vn";
		const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
		const adminName = process.env.ADMIN_NAME || "Cinema Admin";

		const [adminRows] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [adminEmail]);
		if (!adminRows.length) {
			const passwordHash = await bcrypt.hash(adminPassword, 10);
			await pool.query(
				"INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
				[adminName, adminEmail, passwordHash]
			);
		}

		const [theaterRows] = await pool.query("SELECT COUNT(*) AS total FROM theaters");
		if (Number(theaterRows[0].total) === 0) {
			await pool.query(
				"INSERT INTO theaters (name, city, address) VALUES (?, ?, ?), (?, ?, ?)",
				[
					"Cinema Central",
					"Hồ Chí Minh",
					"12 Nguyễn Huệ, Quận 1",
					"Cinema Riverside",
					"Hồ Chí Minh",
					"85 Võ Văn Kiệt, Quận 5",
				]
			);
		}

		const [comboRows] = await pool.query("SELECT COUNT(*) AS total FROM combos");
		if (Number(comboRows[0].total) === 0) {
			await pool.query(
				"INSERT INTO combos (name, description, image_url, price) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
				[
					"Combo Solo",
					"1 bắp nhỏ + 1 nước ngọt",
					"https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=1200&q=80",
					79000,
					"Combo Couple",
					"1 bắp vừa + 2 nước",
					"https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=1200&q=80",
					129000,
					"Combo Family",
					"2 bắp vừa + 4 nước",
					"https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=1200&q=80",
					219000,
				]
			);
		}

		const [blogRows] = await pool.query("SELECT COUNT(*) AS total FROM blogs");
		if (Number(blogRows[0].total) === 0) {
			await pool.query(
				"INSERT INTO blogs (title, summary, content, image_url, status) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
				[
					"Bí kíp chọn ghế xem phim chuẩn trải nghiệm",
					"Hướng dẫn chọn ghế theo từng thể loại phim để có trải nghiệm tốt nhất.",
					"Chọn ghế không chỉ dựa vào thói quen mà còn nên dựa theo định dạng phòng chiếu. Với phim hành động hoặc IMAX, khu vực trung tâm từ hàng E đến H thường cho góc nhìn tốt nhất. Nếu đi theo cặp, ghế đôi ở hàng cuối vừa riêng tư vừa thoải mái. Với gia đình có trẻ nhỏ, bạn nên chọn gần lối đi để di chuyển thuận tiện hơn.",
					"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
					"published",
					"Mẹo săn combo bắp nước tiết kiệm khi đặt online",
					"Những cách tối ưu chi phí combo khi đặt vé online mà vẫn đủ đầy trải nghiệm.",
					"Bạn có thể tiết kiệm đáng kể nếu đặt combo theo nhóm thay vì mua lẻ tại quầy. Hãy theo dõi mục khuyến mãi vào khung giờ thấp điểm hoặc các ngày trong tuần để nhận ưu đãi tốt hơn. Khi đi 2-3 người, combo couple hoặc family thường có đơn giá tốt hơn. Đừng quên kiểm tra mã giảm giá trước bước thanh toán cuối cùng.",
					"https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=1200&q=80",
					"published",
					"Các định dạng phim phổ biến: 2D, 3D, IMAX, 4D",
					"Tìm hiểu khác biệt giữa các định dạng phim để chọn suất chiếu phù hợp.",
					"2D là lựa chọn phổ biến với chi phí hợp lý và hình ảnh quen thuộc. 3D tạo chiều sâu tốt cho phim phiêu lưu, hoạt hình. IMAX có màn hình lớn và âm thanh mạnh, phù hợp phim bom tấn. 4D tăng cảm giác nhập vai với hiệu ứng chuyển động, gió và rung, nhưng sẽ phù hợp với khán giả thích trải nghiệm mạnh.",
					"https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80",
					"published",
				]
			);
		}

		const [formatRows] = await pool.query("SELECT COUNT(*) AS total FROM movie_formats");
		if (Number(formatRows[0].total) === 0) {
			await pool.query("INSERT INTO movie_formats (name) VALUES (?), (?), (?), (?), (?)", ["IMAX", "3D", "4D", "2D", "SVIP"]);
		}

		const [movieRows] = await pool.query("SELECT COUNT(*) AS total FROM movies");
		if (Number(movieRows[0].total) === 0) {
			await pool.query(
				"INSERT INTO movies (title, description, genre, director, cast_info, language, rated, duration_minutes, release_date, status, poster_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				[
					"Primate",
					"Phim hành động giật gân, khởi đầu mùa hè.",
					"Action",
					"James Carter",
					"Liam Stone, Mia Harper",
					"Tiếng Anh - Phụ đề Tiếng Việt",
					"T13",
					125,
					"2026-03-10",
					"now_showing",
					null,
					"Silent Hill: New Dawn",
					"Phim kinh dị tâm lý với màn trở lại của thị trấn sương mù.",
					"Horror",
					"Ava Collins",
					"Noah Price, Emma Reid",
					"Tiếng Anh - Phụ đề Tiếng Việt",
					"T18",
					113,
					"2026-04-20",
					"coming_soon",
					null,
				]
			);
		}

		const [showtimeRows] = await pool.query("SELECT COUNT(*) AS total FROM showtimes");
		if (Number(showtimeRows[0].total) === 0) {
			const [movieList] = await pool.query("SELECT id FROM movies ORDER BY id ASC LIMIT 2");
			const [theaterList] = await pool.query("SELECT id FROM theaters ORDER BY id ASC LIMIT 2");
			const [[defaultFormat]] = await pool.query("SELECT id FROM movie_formats WHERE name = '2D' LIMIT 1");
			if (movieList.length && theaterList.length) {
				await pool.query(
					"INSERT INTO showtimes (movie_id, theater_id, format_id, start_time, price, total_seats) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 HOUR), ?, ?), (?, ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR), ?, ?), (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), ?, ?)",
					[
						movieList[0].id,
						theaterList[0].id,
						defaultFormat?.id || null,
						95000,
						60,
						movieList[0].id,
						theaterList[Math.min(1, theaterList.length - 1)].id,
						defaultFormat?.id || null,
						105000,
						60,
						movieList[Math.min(1, movieList.length - 1)].id,
						theaterList[0].id,
						defaultFormat?.id || null,
						99000,
						60,
					]
				);
			}
		}

		const [[defaultFormat]] = await pool.query("SELECT id FROM movie_formats WHERE name = '2D' LIMIT 1");
		if (defaultFormat?.id) {
			await pool.query(
				"INSERT IGNORE INTO movie_format_mappings (movie_id, format_id) SELECT m.id, ? FROM movies m LEFT JOIN movie_format_mappings mm ON mm.movie_id = m.id WHERE mm.id IS NULL",
				[defaultFormat.id]
			);

			await pool.query("UPDATE showtimes SET format_id = ? WHERE format_id IS NULL", [defaultFormat.id]);
		}
	})();

	return schemaReadyPromise;
}

function getPool() {
	return pool;
}

module.exports = {
	getPool,
	testDatabaseConnection,
	initializeDatabase,
};
