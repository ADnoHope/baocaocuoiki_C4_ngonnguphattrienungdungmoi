const historyList = document.getElementById("historyList");
const historyNotice = document.getElementById("historyNotice");
const statTotalOrders = document.getElementById("statTotalOrders");
const statPaidOrders = document.getElementById("statPaidOrders");
const statTotalSpent = document.getElementById("statTotalSpent");

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

function paymentLabel(value) {
  if (value === "paid") return "Đã thanh toán";
  if (value === "failed") return "Thanh toán lỗi";
  return "Chờ thanh toán";
}

function orderStatusLabel(value) {
  if (value === "confirmed") return "Đã xác nhận";
  if (value === "cancelled") return "Đã hủy";
  return "Đang xử lý";
}

function statusClass(prefix, value) {
  return `${prefix} ${prefix}--${value || "pending"}`;
}

function renderStats(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const total = list.length;
  const paid = list.filter((item) => item.paymentStatus === "paid").length;
  const totalAmount = list.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  if (statTotalOrders) statTotalOrders.textContent = String(total);
  if (statPaidOrders) statPaidOrders.textContent = String(paid);
  if (statTotalSpent) statTotalSpent.textContent = formatCurrency(totalAmount);
}

function renderOrders(orders) {
  renderStats(orders);

  if (!Array.isArray(orders) || !orders.length) {
    historyList.innerHTML = '<p class="empty-note">Bạn chưa có đơn đặt vé nào.</p>';
    return;
  }

  historyList.innerHTML = orders
    .map(
      (order) => `
        <article class="history-ticket">
          <div class="history-ticket-main">
            <div class="history-ticket-head">
              <h3>${order.movieTitle}</h3>
              <div class="history-ticket-badges">
                <span class="${statusClass("payment-badge", order.paymentStatus)}">${paymentLabel(order.paymentStatus)}</span>
                <span class="${statusClass("order-badge", order.status)}">${orderStatusLabel(order.status)}</span>
              </div>
            </div>

            <div class="history-ticket-meta">
              <p><strong>Mã đơn</strong><span>#${order.id}</span></p>
              <p><strong>Rạp</strong><span>${order.theaterName}</span></p>
              <p><strong>Suất chiếu</strong><span>${formatDateTime(order.startTime)}</span></p>
              <p><strong>Ghế</strong><span>${Array.isArray(order.seatList) ? order.seatList.join(", ") : "-"}</span></p>
              <p><strong>Tổng tiền</strong><span>${formatCurrency(order.totalAmount)}</span></p>
            </div>

            <div class="action-row mt-10">
              <a class="btn btn-light" href="movie.html?id=${order.movieId || ""}">Đặt lại phim này</a>
              <a class="btn" href="showtimes.html">Xem suất khác</a>
            </div>
          </div>

          <div class="history-ticket-qr">
            <img class="ticket-qr" src="${buildTicketQrUrl(order)}" alt="QR vé #${order.id}" />
            <small>Quét QR tại cổng soát vé</small>
          </div>
        </article>
      `
    )
    .join("");
}

async function initHistoryPage() {
  const token = localStorage.getItem("token");
  if (!token) {
    renderStats([]);
    historyNotice.innerHTML = 'Bạn chưa đăng nhập. <a href="login.html">Đăng nhập ngay</a> để xem lịch sử đặt vé.';
    historyList.innerHTML = "";
    return;
  }

  try {
    const payload = await API.get("/api/orders/me");
    renderOrders(payload.data || []);
  } catch (error) {
    historyNotice.textContent = error.message;
  }
}

initHistoryPage();
