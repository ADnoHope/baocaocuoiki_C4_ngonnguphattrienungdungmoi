const {
	buildSeatMap,
	normalizeSeatLabel,
	getTakenSeats,
	calculateCoupleSeatSurcharge,
	calculatePremiumViewSurcharge,
} = require("../utils/movie");

async function createBookingOrder(pool, { authUser, body, ioInstance }) {
	const [showtimeRows] = await pool.query(
		`SELECT s.id, s.price, s.total_seats AS totalSeats, s.format_id AS formatId, f.name AS formatName
		 FROM showtimes s LEFT JOIN movie_formats f ON f.id = s.format_id
		 WHERE s.id = ? LIMIT 1`,
		[body.showtimeId]
	);
	if (!showtimeRows.length) throw new Error("Không tìm thấy suất chiếu");

	const formatName = showtimeRows[0].formatName || "2D";
	const totalSeats = Number(showtimeRows[0].totalSeats);
	const allowedSeats = new Set(buildSeatMap(formatName, totalSeats));
	const selectedSeats = [...new Set(body.seats.map((item) => normalizeSeatLabel(item)).filter(Boolean))];

	for (const seat of selectedSeats) {
		if (!allowedSeats.has(seat)) throw new Error(`Ghế ${seat} không tồn tại`);
	}

	const takenSet = await getTakenSeats(pool, body.showtimeId);
	for (const seat of selectedSeats) {
		if (takenSet.has(seat)) throw new Error(`Ghế ${seat} đã được đặt`);
	}

	const coupleSurchargeResult = calculateCoupleSeatSurcharge(formatName, totalSeats, selectedSeats);
	if (!coupleSurchargeResult.ok) throw new Error(coupleSurchargeResult.message || "Ghế cặp đôi không hợp lệ");

	const premiumViewResult = calculatePremiumViewSurcharge(selectedSeats);
	const ticketPrice = Number(showtimeRows[0].price);
	const ticketsTotal = ticketPrice * selectedSeats.length + coupleSurchargeResult.surcharge + premiumViewResult.surcharge;

	let combosTotal = 0;
	const combos = Array.isArray(body.combos) ? body.combos : [];
	const comboRowsToInsert = [];
	for (const comboRequest of combos) {
		if (!comboRequest.comboId || !comboRequest.quantity) continue;
		const [comboRows] = await pool.query("SELECT id, price FROM combos WHERE id = ? LIMIT 1", [comboRequest.comboId]);
		if (!comboRows.length) continue;
		const quantity = Number(comboRequest.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0) continue;
		combosTotal += Number(comboRows[0].price) * quantity;
		comboRowsToInsert.push({ comboId: comboRows[0].id, quantity, unitPrice: Number(comboRows[0].price) });
	}

	let totalAmount = ticketsTotal + combosTotal;
	if (body.voucherCode) {
		const [voucherRows] = await pool.query("SELECT discount_amount, min_order_value FROM promotions WHERE code = ? LIMIT 1", [body.voucherCode]);
		if (voucherRows.length && totalAmount >= Number(voucherRows[0].min_order_value)) {
			totalAmount = Math.max(0, totalAmount - Number(voucherRows[0].discount_amount));
		}
	}

	const connection = await pool.getConnection();
	await connection.beginTransaction();
	try {
		const [orderResult] = await connection.query(
			"INSERT INTO booking_orders (user_id, showtime_id, seat_list, ticket_price, tickets_total, combos_total, total_amount, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
			[authUser.id, body.showtimeId, JSON.stringify(selectedSeats), ticketPrice, ticketsTotal, combosTotal, totalAmount, body.paymentMethod || "cash"]
		);
		for (const comboItem of comboRowsToInsert) {
			await connection.query("INSERT INTO booking_order_combos (order_id, combo_id, quantity, unit_price) VALUES (?, ?, ?, ?)", [orderResult.insertId, comboItem.comboId, comboItem.quantity, comboItem.unitPrice]);
		}
		await connection.commit();
		if (ioInstance) ioInstance.emit("seats_updated", { showtimeId: body.showtimeId, seats: selectedSeats });
		return { orderId: orderResult.insertId, ticketsTotal, combosTotal, totalAmount, premiumSurcharge: premiumViewResult.surcharge, coupleSurcharge: coupleSurchargeResult.surcharge };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

module.exports = { createBookingOrder };
