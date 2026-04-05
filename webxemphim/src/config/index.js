require("dotenv").config();
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const publicDir = path.join(rootDir, "public");
const uploadDir = path.join(publicDir, "uploads");

module.exports = {
	port: process.env.PORT || 3000,
	jwtSecret: process.env.JWT_SECRET || "change_me_in_production",
	jwtExpiresIn: "7d",
	paths: {
		rootDir,
		publicDir,
		uploadDir,
	},
	db: {
		host: process.env.DB_HOST || "localhost",
		user: process.env.DB_USER || "root",
		password: process.env.DB_PASSWORD || "",
		database: process.env.DB_NAME || "webxemphim",
	},
};
