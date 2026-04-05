const movieController = require("../controllers/movieController");

async function handle(req, res, pathname, context) {
	if (pathname === "/api/movies" && req.method === "GET") return await movieController.getAllMovies(req, res, context), true;
	if (pathname.match(/^\/api\/movies\/\d+$/) && req.method === "GET") return await movieController.getMovieById(req, res, { ...context, pathname }), true;
	if (pathname === "/api/formats" && req.method === "GET") return await movieController.getAllFormats(req, res, context), true;
	if (pathname === "/api/theaters" && req.method === "GET") return await movieController.getAllTheaters(req, res, context), true;
	if (pathname === "/api/showtimes" && req.method === "GET") return await movieController.getShowtimes(req, res, context), true;
	if (pathname.match(/^\/api\/showtimes\/\d+\/seats$/) && req.method === "GET") return await movieController.getSeatsForShowtime(req, res, { ...context, pathname }), true;
	return false;
}

module.exports = { handle };
