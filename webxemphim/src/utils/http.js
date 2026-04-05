const fs = require("fs");
const path = require("path");

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

module.exports = {
	sendJson,
	sendBadRequest,
	parseIdFromPath,
	readJsonBody,
	toJsonArray,
	toNumberArray,
};
