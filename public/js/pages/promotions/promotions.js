const promoGrid = document.getElementById("promoGrid");
const promoNotice = document.getElementById("promoNotice");

function promoFallbackStyle(index) {
  const palettes = [
    "linear-gradient(145deg, #2c0b12 0%, #8d1120 55%, #d22637 100%)",
    "linear-gradient(145deg, #181f33 0%, #344878 50%, #d53a4a 100%)",
    "linear-gradient(145deg, #271e2f 0%, #57416f 55%, #ba1f2f 100%)",
    "linear-gradient(145deg, #1a2e2b 0%, #2f6a64 50%, #c6313e 100%)",
  ];
  return palettes[index % palettes.length];
}

function renderPromoCards(combos) {
  if (!promoGrid) {
    return;
  }

  if (!Array.isArray(combos) || !combos.length) {
    promoGrid.innerHTML = '<article class="promo-card-v2 is-empty">Hiện chưa có dữ liệu khuyến mãi combo.</article>';
    return;
  }

  promoGrid.innerHTML = combos
    .map((combo, index) => {
      const hasImage = Boolean(combo.imageUrl);
      const media = hasImage
        ? `<img src="${combo.imageUrl}" alt="${combo.name}" loading="lazy" referrerpolicy="no-referrer" />`
        : `<div class="promo-image-fallback" style="background:${promoFallbackStyle(index)}"></div>`;

      return `
        <article class="promo-card-v2">
          <div class="promo-media-v2">${media}</div>
          <div class="promo-body-v2">
            <div class="promo-tag">Combo ưu đãi</div>
            <h3>${combo.name}</h3>
            <p>${combo.description || "Combo đặc biệt dành cho khách đặt vé online."}</p>
            <div class="promo-foot-v2">
              <strong>${formatCurrency(combo.price)}</strong>
              <a href="movie-checkout.html">Đặt ngay</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function initPromotionsPage() {
  if (!promoGrid) {
    return;
  }

  try {
    const payload = await API.get("/api/combos");
    renderPromoCards(payload.data || []);
    if (promoNotice) {
      promoNotice.textContent = "";
    }
  } catch (error) {
    promoGrid.innerHTML = '<article class="promo-card-v2 is-empty">Không thể tải khuyến mãi. Vui lòng thử lại.</article>';
    if (promoNotice) {
      promoNotice.textContent = error.message;
    }
  }
}

initPromotionsPage();
