const crypto = require("crypto");
const https = require("https"); // or fetch if Node>18, we can use built-in fetch
const config = require("../config");

function computeHmacSha256(message, secretKey) {
	return crypto.createHmac("sha256", secretKey).update(message).digest("hex");
}

async function createPaymentAsync(model) {
	const orderId = model.OrderId + "_" + Date.now(); // append timestamp to avoid duplicate order id if retry
	const requestId = orderId;
	const orderInfo = model.OrderInfo;
	const amount = String(model.Amount);

	const rawData =
		"accessKey=" + config.momo.accessKey +
		"&amount=" + amount +
		"&extraData=" +
		"&ipnUrl=" + config.momo.notifyUrl +
		"&orderId=" + orderId +
		"&orderInfo=" + orderInfo +
		"&partnerCode=" + config.momo.partnerCode +
		"&redirectUrl=" + config.momo.returnUrl +
		"&requestId=" + requestId +
		"&requestType=captureWallet";

	const signature = computeHmacSha256(rawData, config.momo.secretKey);

	const requestBody = JSON.stringify({
		partnerCode: config.momo.partnerCode,
		partnerName: "Test",
		storeId: "MomoTestStore",
		requestId: requestId,
		amount: amount,
		orderId: orderId,
		orderInfo: orderInfo,
		redirectUrl: config.momo.returnUrl,
		ipnUrl: config.momo.notifyUrl,
		lang: "vi",
		requestType: "captureWallet",
		autoCapture: true,
		extraData: "",
		signature: signature,
	});

	try {
        // use fetch api (available in node 18+)
		const response = await fetch(config.momo.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
			},
			body: requestBody,
		});
		
		const momoResponse = await response.json();
		return momoResponse;
	} catch (error) {
		console.error("MOMO Payment Error: ", error);
		throw error;
	}
}

function verifySignature(ipnData) {
	const rawData =
		"accessKey=" + config.momo.accessKey +
		"&amount=" + ipnData.amount +
		"&extraData=" + ipnData.extraData +
		"&message=" + ipnData.message +
		"&orderId=" + ipnData.orderId +
		"&orderInfo=" + ipnData.orderInfo +
		"&orderType=" + ipnData.orderType +
		"&partnerCode=" + ipnData.partnerCode +
		"&payType=" + ipnData.payType +
		"&requestId=" + ipnData.requestId +
		"&responseTime=" + ipnData.responseTime +
		"&resultCode=" + ipnData.resultCode +
		"&transId=" + ipnData.transId;

	const signature = computeHmacSha256(rawData, config.momo.secretKey);
	return signature === ipnData.signature;
}

module.exports = {
	createPaymentAsync,
	verifySignature,
};
