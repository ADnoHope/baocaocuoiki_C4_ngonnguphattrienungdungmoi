const http = require("http");
const fs = require("fs");
const path = require("path");
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

let io;
const server = http.createServer(async (req, res) => {
	const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
	const pathname = requestUrl.pathname;

	if (pathname.startsWith("/api/")) {
		try {
			await initializeDatabase();
			const pool = getPool();
			const authUser = await getAuthUser(req, pool);
			const context = { pool, authUser, requestUrl, ioInstance: io, pathname };

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
	const safePath = path.normalize(pathname === "/" ? "/index.html" : pathname).replace(/^([.][.][/\\])+/, "");
	const filePath = path.join(config.paths.publicDir, safePath);
	if (!filePath.startsWith(config.paths.publicDir)) return (res.writeHead(403), res.end());

	fs.readFile(filePath, (err, data) => {
		if (err) return (res.writeHead(404), res.end());
		const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png" }[path.extname(filePath)] || "application/octet-stream";
		res.writeHead(200, { "Content-Type": mime });
		res.end(data);
	});
});

io = new Server(server, { cors: { origin: "*" } });
server.listen(config.port, () => console.log(`Server on http://localhost:${config.port}`));
