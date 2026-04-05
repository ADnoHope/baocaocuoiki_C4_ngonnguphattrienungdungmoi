const http = require("./http");
const movie = require("./movie");

module.exports = {
	...http,
	...movie,
};
