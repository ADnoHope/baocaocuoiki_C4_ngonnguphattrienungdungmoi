(function () {
  const orderBox = document.getElementById("orderBox");
  const paymentStatus = document.getElementById("paymentStatus");
  const demoQr = document.getElementById("demoQr");
  const vnpayForm = document.getElementById("vnpayForm");
  const paySuccessBtn = document.getElementById("paySuccessBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const bankCode = document.getElementById("bankCode");
  const cardNumber = document.getElementById("cardNumber");
  const cardHolder = document.getElementById("cardHolder");
  const cardExpiry = document.getElementById("cardExpiry");
  const otpCode = document.getElementById("otpCode");
  const confirmAmount = document.getElementById("confirmAmount");

  const TEST_CARDS = {
    NCB: [
      { cardNumber: "9704198526191432198", cardHolder: "NGUYEN VAN A", cardExpiry: "07/15", otpCode: "123456" },
      { cardNumber: "9704195798459170488", cardHolder: "NGUYEN VAN A", cardExpiry: "07/15", otpCode: "123456" },
    ],
    BIDV: [{ cardNumber: "9704188357123456789", cardHolder: "NGUYEN VAN B", cardExpiry: "08/15", otpCode: "123456" }],
    VCB: [{ cardNumber: "9704361234567890123", cardHolder: "NGUYEN VAN C", cardExpiry: "09/25", otpCode: "123456" }],
    TCB: [{ cardNumber: "9704071234567890123", cardHolder: "NGUYEN VAN D", cardExpiry: "10/24", otpCode: "123456" }],
  };

  function parseQuery() {
    return new URLSearchParams(window.location.search);
  }

  function getParam(name) {
    return parseQuery().get(name) || "";
  }

  function money(value) {
    return formatCurrency ? formatCurrency(Number(value || 0)) : String(value || 0);
  }

  function normalize(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getAmount() {
    return Number(getParam("amount") || 0);
  }

  function syncAmountField() {
    if (confirmAmount) {
      confirmAmount.value = money(getAmount());
    }
  }

  function findTestCard() {
    const selectedBank = normalize(bankCode?.value);
    const enteredCard = normalize(cardNumber?.value).replace(/\s+/g, "");
    const enteredHolder = normalize(cardHolder?.value);
    const enteredExpiry = normalize(cardExpiry?.value);
    const enteredOtp = normalize(otpCode?.value);
    const candidates = TEST_CARDS[selectedBank] || [];

    return candidates.find((item) =>
      normalize(item.cardNumber) === enteredCard &&
      normalize(item.cardHolder) === enteredHolder &&
      normalize(item.cardExpiry) === enteredExpiry &&
      normalize(item.otpCode) === enteredOtp
    ) || null;
  }

  function safeText(value) {
    return value ? String(value) : "-";
  }

  function renderOrderBox() {
    const orderId = getParam("orderId");
    const amount = getParam("amount");
    const movieTitle = decodeURIComponent(getParam("movieTitle"));
    const theaterName = decodeURIComponent(getParam("theaterName"));
    const seats = decodeURIComponent(getParam("seats"));
    const returnUrl = getParam("returnUrl");

    const qrPayload = [
      `VNPAY|ORDER:${orderId}`,
      `AMOUNT:${amount}`,
      `MOVIE:${movieTitle}`,
      `THEATER:${theaterName}`,
      `SEATS:${seats}`,
    ].join("|");

    if (demoQr) {
      demoQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrPayload)}`;
    }

    if (orderBox) {
      orderBox.innerHTML = `
        <div class="vnpay-info-list">
          <div><span class="vnpay-label">Mã đơn</span><span class="vnpay-value">#${safeText(orderId)}</span></div>
          <div><span class="vnpay-label">Phim</span><span class="vnpay-value">${movieTitle || "-"}</span></div>
          <div><span class="vnpay-label">Rạp</span><span class="vnpay-value">${theaterName || "-"}</span></div>
          <div><span class="vnpay-label">Ghế</span><span class="vnpay-value">${seats || "-"}</span></div>
          <div><span class="vnpay-label">Số tiền</span><span class="vnpay-value">${money(amount)}</span></div>
          <div><span class="vnpay-label">Return URL</span><span class="vnpay-value">${returnUrl ? "Đã nhận" : "Thiếu"}</span></div>
        </div>
      `;
    }

    syncAmountField();
  }

  async function confirmAndReturn() {
    const orderId = getParam("orderId");
    const returnUrl = getParam("returnUrl");

    if (!orderId) {
      if (paymentStatus) paymentStatus.textContent = "Thiếu mã đơn hàng VNPay.";
      return;
    }

    try {
      paySuccessBtn.disabled = true;
      cancelBtn.disabled = true;
      document.body.classList.add("is-loading");

      const matchedCard = findTestCard();
      if (!matchedCard) {
        throw new Error("Thông tin thẻ test không hợp lệ hoặc không khớp sandbox VNPay.");
      }

      if (paymentStatus) paymentStatus.textContent = "Đang xác minh thẻ và xử lý thanh toán VNPay...";

      const payload = await API.post(`/api/payments/${orderId}/confirm`, {});
      if (paymentStatus) paymentStatus.textContent = payload.message || "Thanh toán thành công";

      const targetUrl = returnUrl ? decodeURIComponent(returnUrl) : "/movie-checkout.html?vnpay=success&orderId=" + encodeURIComponent(orderId);
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 900);
    } catch (error) {
      if (paymentStatus) paymentStatus.textContent = error.message;
      paySuccessBtn.disabled = false;
      cancelBtn.disabled = false;
      document.body.classList.remove("is-loading");
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    confirmAndReturn();
  }

  function cancelAndReturn() {
    const returnUrl = getParam("returnUrl");
    const targetUrl = returnUrl ? decodeURIComponent(returnUrl) : "/movie-checkout.html";
    window.location.href = targetUrl;
  }

  renderOrderBox();

  vnpayForm?.addEventListener("submit", handleFormSubmit);
  paySuccessBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    confirmAndReturn();
  });
  cancelBtn?.addEventListener("click", cancelAndReturn);
})();