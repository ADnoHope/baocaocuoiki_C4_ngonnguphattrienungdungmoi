const FLOW_KEY = "bookingFlowV1";

const movieSelect = document.getElementById("movieSelect");
const theaterSelect = document.getElementById("theaterSelect");
const showtimeSelect = document.getElementById("showtimeSelect");
const movieDetail = document.getElementById("movieDetail");
const showtimeMeta = document.getElementById("showtimeMeta");
const continueToSeatBtn = document.getElementById("continueToSeatBtn");
const checkoutNotice = document.getElementById("checkoutNotice");

let movies = [];
let theaters = [];
let showtimes = [];

function readFlow() {
  try {
    return JSON.parse(localStorage.getItem(FLOW_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeFlow(patch) {
  const current = readFlow();
  localStorage.setItem(
    FLOW_KEY,
    JSON.stringify({
      ...current,
      ...patch,
      selectedSeats: patch.selectedSeats || current.selectedSeats || [],
      combos: patch.combos || current.combos || [],
    })
  );
}

function selectedMovieId() {
  return Number(movieSelect.value || 0);
}

function selectedTheaterId() {
  return Number(theaterSelect.value || 0);
}

function selectedShowtimeId() {
  return Number(showtimeSelect.value || 0);
}

function renderMovieDetail() {
  const movie = movies.find((item) => item.id === selectedMovieId());
  if (!movie) {
    movieDetail.textContent = "Không tìm thấy phim.";
    return;
  }

  movieDetail.innerHTML = `
    <div><strong>${movie.title}</strong></div>
    <div>Đạo diễn: ${movie.director || "Đang cập nhật"}</div>
    <div>Diễn viên: ${movie.castInfo || "Đang cập nhật"}</div>
    <div>Ngôn ngữ: ${movie.language || "Đang cập nhật"}</div>
    <div>Rated: ${movie.rated || "Đang cập nhật"}</div>
    <div>Thể loại: ${movie.genre || "Đang cập nhật"}</div>
    <div>Thời lượng: ${movie.durationMinutes || "?"} phút</div>
    <div>Mô tả: ${movie.description || "Chưa có mô tả"}</div>
  `;
}

function renderTheaterOptionsForMovie() {
  const movieId = selectedMovieId();
  const previousTheaterId = selectedTheaterId();

  const theaterIdsWithShowtime = new Set(
    showtimes.filter((item) => !movieId || item.movieId === movieId).map((item) => item.theaterId)
  );

  const theaterOptions = ['<option value="">Tất cả rạp có suất</option>'].concat(
    theaters
      .filter((item) => theaterIdsWithShowtime.has(item.id))
      .map((item) => `<option value="${item.id}">${item.name} - ${item.city || ""}</option>`)
  );

  theaterSelect.innerHTML = theaterOptions.join("");

  if (previousTheaterId && theaterIdsWithShowtime.has(previousTheaterId)) {
    theaterSelect.value = String(previousTheaterId);
  } else {
    theaterSelect.value = "";
  }
}

function renderShowtimeMeta() {
  const showtime = showtimes.find((item) => item.id === selectedShowtimeId());
  if (!showtime) {
    showtimeMeta.textContent = "Chọn suất chiếu để hiển thị thông tin chi tiết.";
    return;
  }

  showtimeMeta.innerHTML = `
    <strong>${showtime.movieTitle}</strong> | ${showtime.theaterName}<br />
    Suất chiếu: ${formatDateTime(showtime.startTime)} | Giá: ${formatCurrency(showtime.price)}
  `;
}

function renderShowtimes() {
  const filtered = showtimes.filter(
    (item) => (!selectedMovieId() || item.movieId === selectedMovieId()) && (!selectedTheaterId() || item.theaterId === selectedTheaterId())
  );

  if (filtered.length === 0) {
    showtimeSelect.innerHTML = '<option value="">Chưa có suất chiếu phù hợp</option>';
    showtimeSelect.disabled = true;
    showtimeMeta.textContent = "Không có suất chiếu cho lựa chọn hiện tại. Thử đổi phim hoặc rạp.";
    return;
  }

  showtimeSelect.innerHTML = filtered
    .map((item) => `<option value="${item.id}">${item.movieTitle} - ${item.theaterName} - ${formatDateTime(item.startTime)} - ${formatCurrency(item.price)}</option>`)
    .join("");
  showtimeSelect.disabled = false;

  const flow = readFlow();
  if (flow.showtimeId && filtered.some((item) => item.id === Number(flow.showtimeId))) {
    showtimeSelect.value = String(flow.showtimeId);
  }

  renderShowtimeMeta();
}

function persistCurrentSelection() {
  const showtime = showtimes.find((item) => item.id === selectedShowtimeId());
  if (!showtime) {
    return;
  }

  writeFlow({
    movieId: showtime.movieId,
    theaterId: showtime.theaterId,
    showtimeId: showtime.id,
    selectedSeats: [],
    combos: [],
    paymentMethod: "cash",
    createdAt: Date.now(),
  });
}

function applyInitialSelection() {
  const params = new URLSearchParams(window.location.search);
  const movieParamId = Number(params.get("id") || 0);
  const flow = readFlow();

  const movieWithShowtimeIds = new Set(showtimes.map((item) => item.movieId));
  let initialMovieId = movieParamId || Number(flow.movieId || 0);
  if (!initialMovieId || !movieWithShowtimeIds.has(initialMovieId)) {
    initialMovieId = showtimes[0]?.movieId || movies[0]?.id || 0;
  }

  movieSelect.innerHTML = movies
    .map((item) => `<option value="${item.id}" ${initialMovieId === item.id ? "selected" : ""}>${item.title}</option>`)
    .join("");

  renderTheaterOptionsForMovie();

  if (flow.theaterId && Array.from(theaterSelect.options).some((option) => Number(option.value || 0) === Number(flow.theaterId))) {
    theaterSelect.value = String(flow.theaterId);
  }

  renderMovieDetail();
  renderShowtimes();
}

async function initPage() {
  try {
    const [moviesPayload, theatersPayload, showtimesPayload] = await Promise.all([
      API.get("/api/movies"),
      API.get("/api/theaters"),
      API.get("/api/showtimes"),
    ]);

    movies = moviesPayload.data || [];
    theaters = theatersPayload.data || [];
    showtimes = showtimesPayload.data || [];

    if (!movies.length || !showtimes.length) {
      checkoutNotice.textContent = "Hiện chưa có dữ liệu phim hoặc suất chiếu.";
      continueToSeatBtn.disabled = true;
      return;
    }

    applyInitialSelection();

    movieSelect.addEventListener("change", () => {
      renderMovieDetail();
      renderTheaterOptionsForMovie();
      renderShowtimes();
      persistCurrentSelection();
    });

    theaterSelect.addEventListener("change", () => {
      renderShowtimes();
      persistCurrentSelection();
    });

    showtimeSelect.addEventListener("change", () => {
      renderShowtimeMeta();
      persistCurrentSelection();
    });

    continueToSeatBtn.addEventListener("click", () => {
      const showtime = showtimes.find((item) => item.id === selectedShowtimeId());
      if (!showtime) {
        checkoutNotice.textContent = "Vui lòng chọn suất chiếu trước khi tiếp tục.";
        return;
      }

      persistCurrentSelection();
      window.location.href = `movie-seat.html?showtimeId=${showtime.id}`;
    });

    persistCurrentSelection();
  } catch (error) {
    checkoutNotice.textContent = error.message;
  }
}

initPage();
