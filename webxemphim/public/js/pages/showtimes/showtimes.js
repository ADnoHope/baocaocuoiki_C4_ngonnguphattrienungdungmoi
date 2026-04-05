const showtimeMovieFilter = document.getElementById("showtimeMovieFilter");
const showtimeTheaterFilter = document.getElementById("showtimeTheaterFilter");
const showtimeDateFilter = document.getElementById("showtimeDateFilter");
const showtimeList = document.getElementById("showtimeList");
const showtimeSummary = document.getElementById("showtimeSummary");
const showtimeFallback = document.getElementById("showtimeFallback");
const showtimeNoData = document.getElementById("showtimeNoData");
const showtimeErrorBox = document.getElementById("showtimeErrorBox");
const showtimeErrorText = document.getElementById("showtimeErrorText");
const showtimeGroupTemplate = document.getElementById("showtimeGroupTemplate");
const showtimeTimeTemplate = document.getElementById("showtimeTimeTemplate");

let allShowtimes = [];
let allMovies = [];
let allTheaters = [];

function selectedMovieFilter() {
  return Number(showtimeMovieFilter?.value || 0);
}

function selectedTheaterFilter() {
  return Number(showtimeTheaterFilter?.value || 0);
}

function selectedDateFilter() {
  return String(showtimeDateFilter?.value || "");
}

function hideStatusBoxes() {
  showtimeFallback?.classList.add("is-hidden");
  showtimeNoData?.classList.add("is-hidden");
  showtimeErrorBox?.classList.add("is-hidden");
}

function toDateObject(value) {
  const normalized = String(value || "").replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(value) {
  const date = toDateObject(value);
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toShortTime(value) {
  const date = toDateObject(value);
  if (!date) {
    return "--:--";
  }

  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDisplayDate(dateKey) {
  const date = toDateObject(`${dateKey}T00:00:00`);
  if (!date) {
    return dateKey;
  }
  return date.toLocaleDateString("vi-VN");
}

function getActiveMode(movieId, theaterId) {
  if (theaterId) {
    return "theater";
  }
  if (movieId) {
    return "movie";
  }
  return "none";
}

function buildTimeChip(showtime) {
  const node = showtimeTimeTemplate.content.firstElementChild.cloneNode(true);
  const timeNode = node.querySelector(".time");
  const priceNode = node.querySelector(".price");
  timeNode.textContent = toShortTime(showtime.startTime);
  priceNode.textContent = formatCurrency(showtime.price);
  node.href = `movie.html?id=${showtime.movieId}`;
  return node;
}

function buildGroupCard({ title, sub, showtimes }) {
  const node = showtimeGroupTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".showtime-group-title").textContent = title;
  node.querySelector(".showtime-group-sub").textContent = sub;

  const timeGrid = node.querySelector(".showtime-time-grid");
  const empty = node.querySelector(".showtime-empty");

  if (!showtimes.length) {
    timeGrid.classList.add("is-hidden");
    empty.classList.remove("is-hidden");
    return node;
  }

  empty.classList.add("is-hidden");
  showtimes
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .forEach((showtime) => {
      timeGrid.appendChild(buildTimeChip(showtime));
    });

  return node;
}

function renderShowtimeList() {
  const movieId = selectedMovieFilter();
  const theaterId = selectedTheaterFilter();
  const dateKey = selectedDateFilter();
  const mode = getActiveMode(movieId, theaterId);
  hideStatusBoxes();

  if (mode === "none") {
    showtimeSummary.innerHTML = "<strong>Chưa chọn bộ lọc chính.</strong> Hãy chọn rạp hoặc phim để bắt đầu.";
    showtimeFallback.classList.remove("is-hidden");
    showtimeList.innerHTML = "";
    return;
  }

  const source = allShowtimes.filter((item) => toDateKey(item.startTime) === dateKey);
  const narrowed = source.filter((item) => {
    if (mode === "theater") {
      return item.theaterId === theaterId && (!movieId || item.movieId === movieId);
    }
    return item.movieId === movieId && (!theaterId || item.theaterId === theaterId);
  });

  if (!narrowed.length) {
    const selectedName = mode === "theater"
      ? allTheaters.find((item) => item.id === theaterId)?.name || "rạp đã chọn"
      : allMovies.find((item) => item.id === movieId)?.title || "phim đã chọn";

    showtimeSummary.innerHTML = `<strong>Không có suất chiếu.</strong> Không tìm thấy dữ liệu cho ${selectedName} vào ngày ${formatDisplayDate(dateKey)}.`;
    showtimeNoData.classList.remove("is-hidden");
    showtimeList.innerHTML = "";
    return;
  }

  const groupsMap = new Map();
  narrowed.forEach((item) => {
    const key = mode === "theater" ? String(item.movieId) : String(item.theaterId);
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key).push(item);
  });

  const groupNodes = [];
  if (mode === "theater") {
    const theaterName = allTheaters.find((item) => item.id === theaterId)?.name || "Rạp";
    showtimeSummary.innerHTML = `<strong>${theaterName}</strong> - ${formatDisplayDate(dateKey)}. Chọn phim và khung giờ để đặt vé.`;

    [...groupsMap.entries()].forEach(([key, showtimes]) => {
      const movie = allMovies.find((item) => String(item.id) === key);
      const movieName = movie?.title || showtimes[0]?.movieTitle || `Phim #${key}`;
      groupNodes.push(
        buildGroupCard({
          title: movieName,
          sub: `${showtimes.length} suất chiếu trong ngày`,
          showtimes,
        })
      );
    });
  } else {
    const movieName = allMovies.find((item) => item.id === movieId)?.title || "Phim";
    showtimeSummary.innerHTML = `<strong>${movieName}</strong> - ${formatDisplayDate(dateKey)}. Chọn rạp và khung giờ phù hợp.`;

    [...groupsMap.entries()].forEach(([key, showtimes]) => {
      const theater = allTheaters.find((item) => String(item.id) === key);
      const theaterName = theater?.name || showtimes[0]?.theaterName || `Rạp #${key}`;
      groupNodes.push(
        buildGroupCard({
          title: theaterName,
          sub: `${showtimes.length} suất chiếu trong ngày`,
          showtimes,
        })
      );
    });
  }

  showtimeList.innerHTML = "";
  groupNodes.forEach((node) => showtimeList.appendChild(node));
}

function renderFilterOptions() {
  showtimeMovieFilter.innerHTML = [
    '<option value="">-- Chưa chọn phim --</option>',
    ...allMovies.map((item) => `<option value="${item.id}">${item.title}</option>`),
  ].join("");

  showtimeTheaterFilter.innerHTML = [
    '<option value="">-- Chưa chọn rạp --</option>',
    ...allTheaters.map((item) => `<option value="${item.id}">${item.name}</option>`),
  ].join("");
}

function initDateFilter() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${year}-${month}-${day}`;

  const availableDates = [...new Set(allShowtimes.map((item) => toDateKey(item.startTime)).filter(Boolean))].sort();
  const preferredDate = availableDates.includes(defaultDate) ? defaultDate : availableDates[0] || defaultDate;

  showtimeDateFilter.value = preferredDate;
}

async function initShowtimesPage() {
  if (!showtimeList) {
    return;
  }

  try {
    const [showtimesPayload, moviesPayload, theatersPayload] = await Promise.all([
      API.get("/api/showtimes"),
      API.get("/api/movies"),
      API.get("/api/theaters"),
    ]);

    allShowtimes = showtimesPayload.data || [];
    allMovies = moviesPayload.data || [];
    allTheaters = theatersPayload.data || [];

    renderFilterOptions();
    initDateFilter();
    renderShowtimeList();

    showtimeMovieFilter.addEventListener("change", () => {
      if (selectedMovieFilter()) {
        showtimeTheaterFilter.value = "";
      }
      renderShowtimeList();
    });
    showtimeTheaterFilter.addEventListener("change", () => {
      if (selectedTheaterFilter()) {
        showtimeMovieFilter.value = "";
      }
      renderShowtimeList();
    });
    showtimeDateFilter.addEventListener("change", renderShowtimeList);
  } catch (error) {
    hideStatusBoxes();
    showtimeSummary.textContent = "";
    showtimeList.innerHTML = "";
    showtimeErrorText.textContent = `Không tải dữ liệu lịch chiếu: ${error.message}`;
    showtimeErrorBox.classList.remove("is-hidden");
  }
}

initShowtimesPage();
