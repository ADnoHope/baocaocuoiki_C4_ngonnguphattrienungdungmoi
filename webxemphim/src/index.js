const http = require("http");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { Server } = require("socket.io");
const { getPool, initializeDatabase } = require("./db");
const { sendJson, sendBadRequest } = require("./utils");
const config = require("./config");
const { getAuthUser } = require("./middlewares/auth");

// Routes
const authRoutes = require("./routes/auth");
const movieRoutes = require("./routes/movies");
const checkoutRoutes = require("./routes/checkout");
const adminRoutes = require("./routes/admin");
const blogRoutes = require("./routes/blogs");
const comboRoutes = require("./routes/combos");
const promoRoutes = require("./routes/promotions");
const vnpayDir = path.join(__dirname, "..", "custom", "VNPay");

if (!fs.existsSync(config.paths.uploadDir)) {
	fs.mkdirSync(config.paths.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, config.paths.uploadDir),
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname || "").toLowerCase();
		const safeExt = ext || ".bin";
		cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (String(file.mimetype || "").startsWith("image/")) return cb(null, true);
		cb(new Error("Chỉ cho phép tải lên tệp hình ảnh"));
	},
});

const runMulter = (req, res, middleware) =>
	new Promise((resolve, reject) => {
		middleware(req, res, (error) => {
			if (error) return reject(error);
			resolve();
		});
	});

const htmlPathMap = {
	"/index.html": "/htmlcustom/TrangChu/index.html",
	"/login.html": "/htmlcustom/XacThuc/login.html",
	"/register.html": "/htmlcustom/XacThuc/register.html",
	"/movie.html": "/htmlcustom/QuanLyPhim/movie.html",
	"/movie-detail.html": "/htmlcustom/QuanLyPhim/movie-detail.html",
	"/showtimes.html": "/htmlcustom/QuanLyPhim/showtimes.html",
	"/theaters.html": "/htmlcustom/QuanLyPhim/theaters.html",
	"/movie-seat.html": "/htmlcustom/DatVeThanhToan/movie-seat.html",
	"/movie-checkout.html": "/htmlcustom/DatVeThanhToan/movie-checkout.html",
	"/history.html": "/htmlcustom/DatVeThanhToan/history.html",
	"/blog.html": "/htmlcustom/TinTucBlog/blog.html",
	"/blog-detail.html": "/htmlcustom/TinTucBlog/blog-detail.html",
	"/promotions.html": "/htmlcustom/KhuyenMai/promotions.html",
	"/admin.html": "/htmlcustom/QuanTriHeThong/admin.html",
	"/test-socket.html": "/htmlcustom/QuanTriHeThong/test-socket.html",
};

function serveCustomVnpayFile(res, fileName) {
	const filePath = path.join(vnpayDir, fileName);
	fs.readFile(filePath, (err, data) => {
		if (err) return (res.writeHead(404), res.end());
		const mime = {
			".html": "text/html",
			".js": "text/javascript",
			".css": "text/css",
		}[path.extname(filePath).toLowerCase()] || "application/octet-stream";
		res.writeHead(200, { "Content-Type": mime });
		res.end(data);
	});
}

let io;
const server = http.createServer(async (req, res) => {
	const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
	const pathname = requestUrl.pathname;

	if (pathname.startsWith("/api/")) {
		try {
			await initializeDatabase();
			const pool = getPool();
			const authUser = await getAuthUser(req, pool);
			const context = { pool, authUser, requestUrl, ioInstance: io, pathname, runMulter, upload };

			if (await authRoutes.handle(req, res, pathname, context)) return;
			if (await movieRoutes.handle(req, res, pathname, context)) return;
			if (await checkoutRoutes.handle(req, res, pathname, context)) return;
			if (await adminRoutes.handle(req, res, pathname, context)) return;
			if (await blogRoutes.handle(req, res, pathname, context)) return;
			if (await comboRoutes.handle(req, res, pathname, context)) return;
			if (await promoRoutes.handle(req, res, pathname, context)) return;

			return sendJson(res, 404, { ok: false, message: "API Not Found" });
		} catch (err) {
			console.error(err);
			sendJson(res, 500, { ok: false, message: "Internal Server Error" });
		}
		return;
	}

	// Static
	if (pathname === "/vnpay.html") return serveCustomVnpayFile(res, "index.html");
	if (pathname === "/vnpay.js") return serveCustomVnpayFile(res, "vnpay.js");

	const requestedPath = pathname === "/" ? "/index.html" : pathname;
	const mappedPath = htmlPathMap[requestedPath] || requestedPath;
	const safePath = path.normalize(mappedPath).replace(/^([.][.][/\\])+/, "");
	const filePath = path.join(config.paths.publicDir, safePath);
	if (!filePath.startsWith(config.paths.publicDir)) return (res.writeHead(403), res.end());

	fs.readFile(filePath, (err, data) => {
		if (err) return (res.writeHead(404), res.end());
		const mime = {
			".html": "text/html",
			".css": "text/css",
			".js": "text/javascript",
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".webp": "image/webp",
			".svg": "image/svg+xml",
		}[path.extname(filePath).toLowerCase()] || "application/octet-stream";
		res.writeHead(200, { "Content-Type": mime });
		res.end(data);
	});
});

io = new Server(server, { cors: { origin: "*" } });
server.listen(config.port, () => console.log(`Server on http://localhost:${config.port}`));
