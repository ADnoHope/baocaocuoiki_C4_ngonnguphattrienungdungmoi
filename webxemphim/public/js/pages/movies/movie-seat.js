const FLOW_KEY = "bookingFlowV1";

const seatGrid = document.getElementById("seatGrid");
const seatShowtimeMeta = document.getElementById("seatShowtimeMeta");
const seatSummary = document.getElementById("seatSummary");
const seatNotice = document.getElementById("seatNotice");
const continueToCheckoutBtn = document.getElementById("continueToCheckoutBtn");

let showtimes = [];
let seatState = [];
let selectedSeats = new Set();
const COUPLE_SURCHARGE_PER_PAIR = 20000;
const PREMIUM_SURCHARGE_PER_SEAT = 15000;

function currentFormatName() {
  const showtime = showtimes.find((item) => item.id === getShowtimeId());
  return String(showtime?.formatName || "2D").toUpperCase();
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

function getLastRowCode() {
  const rows = seatState
    .map((seat) => parseSeatLabel(seat.label)?.row)
    .filter(Boolean)
    .sort();

  return rows.length ? rows[rows.length - 1] : null;
}

function isCoupleSeatLabel(label) {
  const parsed = parseSeatLabel(label);
  const lastRow = getLastRowCode();
  return Boolean(parsed && lastRow && parsed.row === lastRow);
}

function isPremiumSeatLabel(label) {
  const parsed = parseSeatLabel(label);
  if (!parsed) {
    return false;
  }

  return parsed.row.charCodeAt(0) >= 69;
}

function getPairSeatLabel(label) {
  const parsed = parseSeatLabel(label);
  if (!parsed) {
    return null;
  }

  const pairedCol = parsed.col % 2 === 0 ? parsed.col - 1 : parsed.col + 1;
  return `${parsed.row}${pairedCol}`;
}

function calculateCouplePairCount() {
  const lastRow = getLastRowCode();
  if (!lastRow) {
    return 0;
  }

  const pairKeys = new Set();
  selectedSeats.forEach((label) => {
    const parsed = parseSeatLabel(label);
    if (!parsed || parsed.row !== lastRow) {
      return;
    }

    const pairBase = parsed.col % 2 === 0 ? parsed.col - 1 : parsed.col;
    if (selectedSeats.has(`${parsed.row}${pairBase}`) && selectedSeats.has(`${parsed.row}${pairBase + 1}`)) {
      pairKeys.add(`${parsed.row}-${pairBase}`);
    }
  });

  return pairKeys.size;
}

function calculatePremiumSeatCount() {
  let count = 0;
  selectedSeats.forEach((label) => {
    if (isPremiumSeatLabel(label)) {
      count += 1;
    }
  });
  return count;
}

function normalizeCoupleSelection() {
  const allowedSeatSet = new Set(seatState.filter((seat) => !seat.taken).map((seat) => seat.label));
  const nextSelection = new Set();

  selectedSeats.forEach((label) => {
    if (!allowedSeatSet.has(label)) {
      return;
    }

    if (!isCoupleSeatLabel(label)) {
      nextSelection.add(label);
      return;
    }

    const pair = getPairSeatLabel(label);
    if (pair && allowedSeatSet.has(pair)) {
      nextSelection.add(label);
      nextSelection.add(pair);
    }
  });

  selectedSeats = nextSelection;
}

function seatClassByFormat(label) {
  if (isCoupleSeatLabel(label)) {
    return "seat-couple";
  }

  if (isPremiumSeatLabel(label)) {
    return "seat-premium-view";
  }

  const formatName = currentFormatName();
  const rowCode = String(label || "").charAt(0);

  if (formatName === "IMAX") {
    if (["R", "S", "T"].includes(rowCode)) {
      return "seat-imax-premium";
    }
    return "seat-imax-standard";
  }

  if (formatName === "SVIP") {
    if (["F", "G", "H"].includes(rowCode)) {
      return "seat-svip-lux";
    }
    return "seat-svip-standard";
  }

  if (formatName === "4D") {
    return "seat-4d";
  }

  if (formatName === "3D") {
    return "seat-3d";
  }

  return "seat-single";
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

function getShowtimeId() {
  const params = new URLSearchParams(window.location.search);
  const idFromQuery = Number(params.get("showtimeId") || 0);
  if (idFromQuery) {
    return idFromQuery;
  }

  return Number(readFlow().showtimeId || 0);
}

function renderSeatSummary() {
  const showtime = showtimes.find((item) => item.id === getShowtimeId());
  const price = Number(showtime?.price || 0);
  const seats = Array.from(selectedSeats);
  const premiumSeatCount = calculatePremiumSeatCount();
  const premiumSurcharge = premiumSeatCount * PREMIUM_SURCHARGE_PER_SEAT;
  const couplePairCount = calculateCouplePairCount();
  const coupleSurcharge = couplePairCount * COUPLE_SURCHARGE_PER_PAIR;
  const subtotal = price * seats.length + premiumSurcharge + coupleSurcharge;

  seatSummary.innerHTML = `
    <div><strong>Ghế đang chọn:</strong> ${seats.join(", ") || "Chưa chọn"}</div>
    <div><strong>Số lượng:</strong> ${seats.length}</div>
    <div>Phụ thu vị trí đẹp (từ hàng E): ${formatCurrency(premiumSurcharge)} (${premiumSeatCount} ghế)</div>
    <div>Phụ thu ghế cặp đôi: ${formatCurrency(coupleSurcharge)} (${couplePairCount} cặp)</div>
    <div><strong>Tạm tính:</strong> ${formatCurrency(subtotal)}</div>
  `;
}

function renderSeatGrid() {
  const formatName = currentFormatName();
  const isIMAX = formatName === "IMAX";
  seatGrid.className = `seat-grid cinema-seat-grid format-${formatName.toLowerCase()} ${isIMAX ? "imax-layout" : ""}`;

  const renderSeatButton = (seat) => {
    const selected = selectedSeats.has(seat.label);
    const seatFormatClass = seatClassByFormat(seat.label);
    const klass = ["seat", seatFormatClass, seat.taken ? "taken" : "", selected ? "selected" : ""].join(" ").trim();
    return `<button type=\"button\" class=\"${klass}\" data-seat=\"${seat.label}\" ${seat.taken ? "disabled" : ""}>${seat.label}</button>`;
  };

  if (isIMAX) {
    const rowMap = new Map();
    seatState.forEach((seat) => {
      const parsed = parseSeatLabel(seat.label);
      if (!parsed) {
        return;
      }

      if (!rowMap.has(parsed.row)) {
        rowMap.set(parsed.row, []);
      }
      rowMap.get(parsed.row).push({ ...seat, col: parsed.col });
    });

    const orderedRows = Array.from(rowMap.keys()).sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
    seatGrid.innerHTML = orderedRows
      .map((row) => {
        const rowSeats = rowMap.get(row).sort((a, b) => b.col - a.col);
        const seatCount = rowSeats.length;
        const leftCount = Math.ceil(seatCount * 0.34);
        const rightCount = Math.ceil(seatCount * 0.34);
        const centerCount = Math.max(0, seatCount - leftCount - rightCount);

        const leftSeats = rowSeats.slice(0, leftCount);
        const centerSeats = rowSeats.slice(leftCount, leftCount + centerCount);
        const rightSeats = rowSeats.slice(leftCount + centerCount);

        return `
          <div class=\"imax-seat-row\">
            <div class=\"imax-seat-block\">${leftSeats.map((seat) => renderSeatButton(seat)).join("")}</div>
            <div class=\"imax-seat-block\">${centerSeats.map((seat) => renderSeatButton(seat)).join("")}</div>
            <div class=\"imax-seat-block\">${rightSeats.map((seat) => renderSeatButton(seat)).join("")}</div>
          </div>
        `;
      })
      .join("");
  } else {
    seatGrid.innerHTML = seatState.map((seat) => renderSeatButton(seat)).join("");
  }

  seatGrid.querySelectorAll("[data-seat]").forEach((button) => {
    button.addEventListener("click", () => {
      const seat = button.dataset.seat;
      const seatInfo = seatState.find((item) => item.label === seat);
      const pairSeat = getPairSeatLabel(seat);
      const pairInfo = pairSeat ? seatState.find((item) => item.label === pairSeat) : null;

      seatNotice.textContent = "";
      if (seatInfo?.taken) {
        return;
      }

      if (isCoupleSeatLabel(seat)) {
        if (!pairInfo || pairInfo.taken) {
          seatNotice.textContent = `Ghế ${seat} là ghế cặp đôi, nhưng ghế đi kèm đã được bán.`;
          return;
        }

        const isSelected = selectedSeats.has(seat) || selectedSeats.has(pairSeat);
        if (isSelected) {
          selectedSeats.delete(seat);
          selectedSeats.delete(pairSeat);
        } else {
          selectedSeats.add(seat);
          selectedSeats.add(pairSeat);
        }
      } else if (selectedSeats.has(seat)) {
        selectedSeats.delete(seat);
      } else {
        selectedSeats.add(seat);
      }

      normalizeCoupleSelection();
      renderSeatGrid();
      renderSeatSummary();
    });
  });
}

function renderShowtimeMeta() {
  const showtime = showtimes.find((item) => item.id === getShowtimeId());
  if (!showtime) {
    seatShowtimeMeta.textContent = "Không tìm thấy suất chiếu. Vui lòng quay lại bước 1.";
    continueToCheckoutBtn.disabled = true;
    return;
  }

  seatShowtimeMeta.innerHTML = `
    <strong>${showtime.movieTitle}</strong> | ${showtime.theaterName}<br />
    Suất chiếu: ${formatDateTime(showtime.startTime)} | Định dạng: ${showtime.formatName || "2D"} | Giá vé: ${formatCurrency(showtime.price)}
  `;
}

async function initSeatPage() {
  const showtimeId = getShowtimeId();
  if (!showtimeId) {
    seatNotice.textContent = "Thiếu thông tin suất chiếu. Vui lòng quay lại bước 1.";
    continueToCheckoutBtn.disabled = true;
    return;
  }

  try {
    const [showtimesPayload, seatsPayload] = await Promise.all([
      API.get("/api/showtimes"),
      API.get(`/api/showtimes/${showtimeId}/seats`),
    ]);

    showtimes = showtimesPayload.data || [];
    seatState = seatsPayload?.data?.seats || [];

    renderShowtimeMeta();

    const flow = readFlow();
    selectedSeats = new Set(Array.isArray(flow.selectedSeats) ? flow.selectedSeats : []);

    const allowedSeatSet = new Set(seatState.filter((seat) => !seat.taken).map((seat) => seat.label));
    selectedSeats = new Set(Array.from(selectedSeats).filter((label) => allowedSeatSet.has(label)));
    normalizeCoupleSelection();

    renderSeatGrid();
    renderSeatSummary();

    continueToCheckoutBtn.addEventListener("click", () => {
      if (!selectedSeats.size) {
        seatNotice.textContent = "Vui lòng chọn ít nhất 1 ghế trước khi sang bước thanh toán.";
        return;
      }

      writeFlow({
        showtimeId,
        selectedSeats: Array.from(selectedSeats),
      });

      window.location.href = "movie-checkout.html";
    });
  } catch (error) {
    seatNotice.textContent = error.message;
  }
}

initSeatPage();
