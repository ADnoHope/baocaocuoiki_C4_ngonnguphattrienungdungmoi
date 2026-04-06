const FLOW_KEY = "bookingFlowV1";

const comboWrap = document.getElementById("comboWrap");
const paymentMethod = document.getElementById("paymentMethod");
const voucherCodeInput = document.getElementById("voucherCode");
const applyVoucherBtn = document.getElementById("applyVoucherBtn");
const voucherNotice = document.getElementById("voucherNotice");
const checkoutSummary = document.getElementById("checkoutSummary");
const checkoutNotice = document.getElementById("checkoutNotice");
const checkoutBtn = document.getElementById("checkoutBtn");
const confirmPaymentBtn = document.getElementById("confirmPaymentBtn");
const checkoutShowtimeMeta = document.getElementById("checkoutShowtimeMeta");
const ticketPanel = document.getElementById("ticketPanel");
const ticketCard = document.getElementById("ticketCard");

let showtimes = [];
let combos = [];
let flow = {};
let lastOrderId = null;
let currentVoucher = null;
const COUPLE_SURCHARGE_PER_PAIR = 20000;
const PREMIUM_SURCHARGE_PER_SEAT = 15000;

function getCheckoutQueryParams() {
  return new URLSearchParams(window.location.search);
}

function isVnpayReturnSuccess() {
  const params = getCheckoutQueryParams();
  return params.get("vnpay") === "success" && Number(params.get("orderId") || 0) > 0;
}

function getVnpayReturnUrl(orderId) {
  return `${window.location.origin}/movie-checkout.html?vnpay=success&orderId=${encodeURIComponent(orderId)}`;
}

function getVnpayDemoUrl(orderId, showtime, totalAmount) {
  const seats = Array.isArray(flow.selectedSeats) ? flow.selectedSeats.join(", ") : "";
  return `/vnpay.html?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(totalAmount)}&movieTitle=${encodeURIComponent(showtime?.movieTitle || "")}&theaterName=${encodeURIComponent(showtime?.theaterName || "")}&seats=${encodeURIComponent(seats)}&returnUrl=${encodeURIComponent(getVnpayReturnUrl(orderId))}`;
}

async function renderVnpaySuccess(orderId) {
  checkoutNotice.textContent = `Thanh toán VNPay thành công. Mã đơn: ${orderId}`;
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Đã thanh toán";
  confirmPaymentBtn.disabled = true;
  confirmPaymentBtn.classList.add("is-hidden");
  await loadTicketByOrderId(orderId);
  localStorage.removeItem(FLOW_KEY);
}

function readFlow() {
  try {
    return JSON.parse(localStorage.getItem(FLOW_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeFlow(patch) {
  const current = readFlow();
  localStorage.setItem(FLOW_KEY, JSON.stringify({ ...current, ...patch }));
}

function buildTicketQrUrl(order) {
  const payload = [
    `ORDER:${order.id}`,
    `MOVIE:${order.movieTitle}`,
    `THEATER:${order.theaterName}`,
    `TIME:${order.startTime}`,
    `SEATS:${Array.isArray(order.seatList) ? order.seatList.join(",") : ""}`,
    `TOTAL:${order.totalAmount}`,
  ].join("|");

  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
}

function renderTicket(order) {
  if (!ticketPanel || !ticketCard || !order) {
    return;
  }

  ticketPanel.classList.remove("is-hidden");
  ticketCard.innerHTML = `
    <article class="ticket-view">
      <div class="ticket-info">
        <h3>${order.movieTitle}</h3>
        <p><strong>Mã đơn:</strong> #${order.id}</p>
        <p><strong>Rạp:</strong> ${order.theaterName}</p>
        <p><strong>Suất chiếu:</strong> ${formatDateTime(order.startTime)}</p>
        <p><strong>Ghế:</strong> ${Array.isArray(order.seatList) ? order.seatList.join(", ") : "-"}</p>
        <p><strong>Tổng tiền:</strong> ${formatCurrency(order.totalAmount)}</p>
        <p><strong>Trạng thái:</strong> ${order.paymentStatus === "paid" ? "Đã thanh toán" : "Chờ thanh toán"}</p>
      </div>
      <div class="ticket-qr-wrap">
        <img class="ticket-qr" src="${buildTicketQrUrl(order)}" alt="QR vé #${order.id}" />
        <small>Đưa mã QR này cho nhân viên để quét khi vào rạp.</small>
      </div>
    </article>
  `;
}

async function loadTicketByOrderId(orderId) {
  const payload = await API.get("/api/orders/me");
  const order = (payload.data || []).find((item) => Number(item.id) === Number(orderId));
  if (order) {
    renderTicket(order);
  }
}

function getSelectedCombos() {
  return Array.from(comboWrap.querySelectorAll("[data-combo-id]"))
    .map((input) => ({
      comboId: Number(input.dataset.comboId),
      quantity: Number(input.value || 0),
    }))
    .filter((item) => item.quantity > 0);
}

function parseSeatLabel(label) {
  const match = /^([A-Z])(\d+)$/i.exec(String(label || "").trim());
  if (!match) {
    return null;
  }

  return {
    row: match[1].toUpperCase(),
    col: Number(match[2]),
  };
}

function getLastRowCode(totalSeats, formatName) {
  const normalizedFormat = String(formatName || "2D").toUpperCase();
  if (normalizedFormat === "IMAX") {
    return "P";
  }

  const layoutByFormat = {
    SVIP: { seatsPerRow: 8, totalSeats: 64 },
    "4D": { seatsPerRow: 10, totalSeats: 100 },
    "3D": { seatsPerRow: 10, totalSeats: 140 },
    "2D": { seatsPerRow: 14, totalSeats: 166 },
  };

  const key = normalizedFormat;
  const preset = layoutByFormat[key] || layoutByFormat["2D"];
  const seatsCount = Number(totalSeats) > 0 ? Number(totalSeats) : preset.totalSeats;
  const rows = Math.ceil(seatsCount / preset.seatsPerRow);
  return String.fromCharCode(65 + Math.max(0, rows - 1));
}

function getCouplePairCount(seats, showtime) {
  if (!Array.isArray(seats) || !showtime) {
    return 0;
  }

  const lastRowCode = getLastRowCode(showtime.totalSeats, showtime.formatName);
  const selectedSet = new Set(seats.map((item) => String(item || "").trim().toUpperCase()));
  const pairKeys = new Set();

  selectedSet.forEach((label) => {
    const parsed = parseSeatLabel(label);
    if (!parsed || parsed.row !== lastRowCode) {
      return;
    }

    const baseCol = parsed.col % 2 === 0 ? parsed.col - 1 : parsed.col;
    if (selectedSet.has(`${parsed.row}${baseCol}`) && selectedSet.has(`${parsed.row}${baseCol + 1}`)) {
      pairKeys.add(`${parsed.row}-${baseCol}`);
    }
  });

  return pairKeys.size;
}

function getPremiumSeatCount(seats) {
  if (!Array.isArray(seats)) {
    return 0;
  }

  return seats.reduce((count, label) => {
    const parsed = parseSeatLabel(label);
    if (!parsed) {
      return count;
    }

    return parsed.row.charCodeAt(0) >= 69 ? count + 1 : count;
  }, 0);
}

function renderSummary() {
  const showtime = showtimes.find((item) => item.id === Number(flow.showtimeId));
  const seats = Array.isArray(flow.selectedSeats) ? flow.selectedSeats : [];
  const ticketPrice = Number(showtime?.price || 0);
  const premiumSeatCount = getPremiumSeatCount(seats);
  const premiumSurcharge = premiumSeatCount * PREMIUM_SURCHARGE_PER_SEAT;
  const couplePairs = getCouplePairCount(seats, showtime);
  const coupleSurcharge = couplePairs * COUPLE_SURCHARGE_PER_PAIR;
  const ticketsTotal = ticketPrice * seats.length + premiumSurcharge + coupleSurcharge;

  const selectedCombos = getSelectedCombos();

  let combosTotal = 0;
  for (const comboItem of selectedCombos) {
    const combo = combos.find((item) => item.id === comboItem.comboId);
    combosTotal += Number(combo?.price || 0) * comboItem.quantity;
  }

  let totalAmount = ticketsTotal + combosTotal;
  let discountHtml = "";
  if (currentVoucher && totalAmount >= Number(currentVoucher.minOrderValue)) {
    const discountValue = Number(currentVoucher.discountAmount);
    totalAmount = Math.max(0, totalAmount - discountValue);
    discountHtml = `<div style="color:red">Khuyến mãi (${currentVoucher.code}): -${formatCurrency(discountValue)}</div>`;
  }

  checkoutSummary.innerHTML = `
    <div><strong>Ghế:</strong> ${seats.join(", ") || "Chưa chọn"}</div>
    <div>Giá vé: ${formatCurrency(ticketPrice)} x ${seats.length}</div>
    <div>Phụ thu vị trí đẹp (từ hàng E): ${formatCurrency(premiumSurcharge)} (${premiumSeatCount} ghế)</div>
    <div>Phụ thu ghế cặp đôi: ${formatCurrency(coupleSurcharge)} (${couplePairs} cặp)</div>
    <div>Combo: ${formatCurrency(combosTotal)}</div>
    ${discountHtml}
    <div class="summary-total"><strong>Tổng cộng: ${formatCurrency(totalAmount)}</strong></div>
  `;

  writeFlow({ combos: selectedCombos, paymentMethod: paymentMethod.value });
}

function renderShowtimeMeta() {
  const showtime = showtimes.find((item) => item.id === Number(flow.showtimeId));
  if (!showtime) {
    checkoutShowtimeMeta.textContent = "Thiếu thông tin suất chiếu. Vui lòng quay lại bước 1.";
    checkoutBtn.disabled = true;
    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.classList.add("is-hidden");
    return;
  }

  checkoutShowtimeMeta.innerHTML = `
    <strong>${showtime.movieTitle}</strong> | ${showtime.theaterName}<br />
    Suất chiếu: ${formatDateTime(showtime.startTime)} | Giá vé: ${formatCurrency(showtime.price)}<br />
    Ghế đã chọn: ${(flow.selectedSeats || []).join(", ")}
  `;
}

async function initCheckoutPage() {
  flow = readFlow();
  const checkoutParams = getCheckoutQueryParams();
  const vnpaySuccessOrderId = Number(checkoutParams.get("orderId") || 0);
  const isVnpaySuccess = isVnpayReturnSuccess() && vnpaySuccessOrderId > 0;
  confirmPaymentBtn.classList.add("is-hidden");
  confirmPaymentBtn.disabled = true;

  if (isVnpaySuccess) {
    try {
      await renderVnpaySuccess(vnpaySuccessOrderId);
      return;
    } catch (error) {
      checkoutNotice.textContent = error.message;
    }
  }

  if (!flow.showtimeId || !Array.isArray(flow.selectedSeats) || !flow.selectedSeats.length) {
    checkoutNotice.textContent = "Bạn chưa hoàn tất bước chọn suất/ghế. Vui lòng quay lại bước trước.";
    checkoutBtn.disabled = true;
    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.classList.add("is-hidden");
    return;
  }

  try {
    const [showtimesPayload, combosPayload] = await Promise.all([API.get("/api/showtimes"), API.get("/api/combos")]);
    showtimes = showtimesPayload.data || [];
    combos = combosPayload.data || [];

    renderShowtimeMeta();

    const flowComboMap = new Map((flow.combos || []).map((item) => [Number(item.comboId), Number(item.quantity || 0)]));

    comboWrap.innerHTML = combos
      .map(
        (combo) => `
        <div class="summary-box checkout-combo-card">
          <div><strong>${combo.name}</strong></div>
          <div>${combo.description || ""}</div>
          <div class="checkout-combo-price">${formatCurrency(combo.price)}</div>
          <div class="field mt-10">
            <label>Số lượng</label>
            <input type="number" min="0" step="1" value="${flowComboMap.get(combo.id) || 0}" data-combo-id="${combo.id}" />
          </div>
        </div>
      `
      )
      .join("");

    comboWrap.querySelectorAll("[data-combo-id]").forEach((input) => {
      input.addEventListener("input", renderSummary);
    });

    paymentMethod.value = flow.paymentMethod || "cash";
    paymentMethod.addEventListener("change", renderSummary);

    const refreshCheckoutButtonLabel = () => {
      checkoutBtn.textContent = paymentMethod.value === "vnpay" ? "Tạo đơn & chuyển VNPay" : "Tạo đơn đặt vé";
    };

    refreshCheckoutButtonLabel();
    paymentMethod.addEventListener("change", refreshCheckoutButtonLabel);

    if (applyVoucherBtn && voucherCodeInput) {
      applyVoucherBtn.addEventListener("click", async () => {
        const code = voucherCodeInput.value.trim();
        if (!code) return;
        try {
          voucherNotice.textContent = "Đang kiểm tra...";
          voucherNotice.style.color = "#333";
          const res = await API.get("/api/promotions/check?code=" + encodeURIComponent(code));
          currentVoucher = res.data;
          voucherNotice.textContent = "Áp dụng voucher thành công!";
          voucherNotice.style.color = "green";
          renderSummary();
        } catch (error) {
          currentVoucher = null;
          voucherNotice.textContent = error.message;
          voucherNotice.style.color = "red";
          renderSummary();
        }
      });
    }

    checkoutBtn.addEventListener("click", async () => {
      try {
        checkoutBtn.disabled = true;
        checkoutNotice.textContent = "Đang tạo đơn đặt vé...";
        const payload = await API.post("/api/checkout", {
          showtimeId: Number(flow.showtimeId),
          seats: flow.selectedSeats,
          combos: getSelectedCombos(),
          paymentMethod: paymentMethod.value,
          voucherCode: currentVoucher ? currentVoucher.code : undefined
        });

        lastOrderId = payload.data.orderId;
        if (paymentMethod.value === "vnpay") {
          checkoutNotice.textContent = `Đã tạo đơn #${lastOrderId}. Đang chuyển sang cổng thanh toán VNPay...`;
          confirmPaymentBtn.classList.add("is-hidden");
          const showtime = showtimes.find((item) => item.id === Number(flow.showtimeId));
          const vnpayUrl = getVnpayDemoUrl(lastOrderId, showtime, payload.data.totalAmount);
          setTimeout(() => {
            window.location.href = vnpayUrl;
          }, 800);
          return;
        }

        checkoutNotice.textContent = `Tạo đơn thành công. Mã đơn: ${lastOrderId}`;
        confirmPaymentBtn.disabled = false;
        confirmPaymentBtn.classList.remove("is-hidden");
        checkoutBtn.textContent = "Đã tạo đơn";
      } catch (error) {
        checkoutBtn.disabled = false;
        checkoutNotice.textContent = error.message;
        confirmPaymentBtn.classList.add("is-hidden");
        confirmPaymentBtn.disabled = true;
      }
    });

    confirmPaymentBtn.addEventListener("click", async () => {
      if (!lastOrderId) {
        return;
      }

      try {
        const payload = await API.post(`/api/payments/${lastOrderId}/confirm`, {});
        checkoutNotice.textContent = payload.message;
        confirmPaymentBtn.disabled = true;
        await loadTicketByOrderId(lastOrderId);
        localStorage.removeItem(FLOW_KEY);
      } catch (error) {
        checkoutNotice.textContent = error.message;
      }
    });

    renderSummary();
  } catch (error) {
    checkoutNotice.textContent = error.message;
  }
}

initCheckoutPage();
