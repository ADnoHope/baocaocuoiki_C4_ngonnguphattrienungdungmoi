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
	momo: {
		apiUrl: process.env.MOMO_API_URL || "https://test-payment.momo.vn/v2/gateway/api/create",
		secretKey: process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz",
		accessKey: process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85",
		partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO",
		returnUrl: process.env.MOMO_RETURN_URL || "http://localhost:3000/api/checkout/momo_return",
		notifyUrl: process.env.MOMO_NOTIFY_URL || "http://localhost:3000/api/checkout/momo_notify",
	}
};
