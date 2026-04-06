const detailTitle = document.getElementById("detailTitle");
const detailMeta = document.getElementById("detailMeta");
const detailDescription = document.getElementById("detailDescription");
const detailPoster = document.getElementById("detailPoster");
const bookNowBtn = document.getElementById("bookNowBtn");

function getMovieIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("id") || 0);
}

function safeText(value, fallback = "Đang cập nhật") {
  return value ? String(value) : fallback;
}

function formatNamesText(movie) {
  if (Array.isArray(movie?.formatNames) && movie.formatNames.length) {
    return movie.formatNames.join(", ");
  }

  if (Array.isArray(movie?.formats) && movie.formats.length) {
    return movie.formats.map((item) => item?.name).filter(Boolean).join(", ");
  }

  return "Đang cập nhật";
}

function formatRatedScore(value) {
  const score = Number(String(value ?? "").trim());
  if (Number.isInteger(score) && score >= 1 && score <= 10) {
    return `${score}/10`;
  }
  return value ? String(value) : "Đang cập nhật";
}

async function loadMovieDetail() {
  const movieId = getMovieIdFromQuery();
  if (!movieId) {
    detailTitle.textContent = "Không tìm thấy phim";
    detailDescription.textContent = "Liên kết không hợp lệ hoặc thiếu id phim.";
    return;
  }

  try {
    const payload = await API.get(`/api/movies/${movieId}`);
    const movie = payload?.data;
    if (!movie) {
      throw new Error("Không tìm thấy dữ liệu phim");
    }

    detailTitle.textContent = safeText(movie.title, "Phim");
    detailDescription.textContent = safeText(movie.description, "Chưa có mô tả phim.");

    detailMeta.innerHTML = `
      <p><strong>Đạo diễn:</strong> ${safeText(movie.director)}</p>
      <p><strong>Diễn viên:</strong> ${safeText(movie.castInfo)}</p>
      <p><strong>Thể loại:</strong> ${safeText(movie.genre)}</p>
      <p><strong>Định dạng:</strong> ${formatNamesText(movie)}</p>
      <p><strong>Thời lượng phim:</strong> ${movie.durationMinutes ? `${movie.durationMinutes} phút` : "Đang cập nhật"}</p>
      <p><strong>Khởi chiếu:</strong> ${movie.releaseDate ? formatDateTime(movie.releaseDate).split(",")[0] : "Đang cập nhật"}</p>
      <p><strong>Ngôn ngữ:</strong> ${safeText(movie.language)}</p>
      <p><strong>Đánh giá:</strong> ${formatRatedScore(movie.rated)}</p>
    `;

    if (movie.posterUrl) {
      detailPoster.style.backgroundImage = `url(${movie.posterUrl})`;
    }

    bookNowBtn.href = `movie.html?id=${movie.id}`;
  } catch (error) {
    detailTitle.textContent = "Không tải được chi tiết phim";
    detailDescription.textContent = error.message;
  }
}

loadMovieDetail();
