function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function ensureTopbarActions(loginButton) {
  let actions = loginButton.closest(".topbar-actions");
  if (actions) {
    return actions;
  }

  actions = document.createElement("div");
  actions.className = "topbar-actions";
  loginButton.parentNode.insertBefore(actions, loginButton);
  actions.appendChild(loginButton);
  return actions;
}

function removeAuthActionButtons(loginButton) {
  const actions = ensureTopbarActions(loginButton);
  actions.querySelectorAll(".logout-btn, .history-btn").forEach((button) => button.remove());
}

function attachLoggedInActions(loginButton) {
  const actions = ensureTopbarActions(loginButton);

  let historyButton = actions.querySelector(".history-btn");
  if (!historyButton) {
    historyButton = document.createElement("a");
    historyButton.className = "history-btn";
    historyButton.href = "history.html";
    historyButton.textContent = "Vé của tôi";
    actions.appendChild(historyButton);
  }

  let logoutButton = actions.querySelector(".logout-btn");
  if (!logoutButton) {
    logoutButton = document.createElement("a");
    logoutButton.className = "logout-btn";
    logoutButton.href = "#";
    logoutButton.textContent = "Đăng xuất";
    actions.appendChild(logoutButton);
  }

  if (!logoutButton.dataset.bound) {
    logoutButton.addEventListener("click", (event) => {
      event.preventDefault();
      clearAuthSession();
      window.location.href = "index.html";
    });
    logoutButton.dataset.bound = "1";
  }
}

async function renderTopbarUser() {
  const loginButton = document.querySelector(".login-btn");
  if (!loginButton) {
    return;
  }

  const rawUser = localStorage.getItem("user");
  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      if (user?.fullName) {
        loginButton.href = user.role === "admin" ? "admin.html" : "index.html";
        loginButton.textContent = user.fullName;
        loginButton.title = user.role === "admin" ? "Đi tới trang quản trị" : `Đăng nhập với ${user.fullName}`;
        loginButton.classList.add("user-chip");
        attachLoggedInActions(loginButton);
      }
    } catch {
      localStorage.removeItem("user");
    }
  }

  const token = localStorage.getItem("token");
  if (!token) {
    loginButton.href = "login.html";
    loginButton.textContent = "Đăng Nhập";
    loginButton.title = "Đăng nhập";
    loginButton.classList.remove("user-chip");
    removeAuthActionButtons(loginButton);
    return;
  }

  try {
    const payload = await API.get("/api/auth/me");
    if (payload?.user?.fullName) {
      localStorage.setItem("user", JSON.stringify(payload.user));
      loginButton.href = payload.user.role === "admin" ? "admin.html" : "index.html";
      loginButton.textContent = payload.user.fullName;
      loginButton.title = payload.user.role === "admin" ? "Đi tới trang quản trị" : `Đăng nhập với ${payload.user.fullName}`;
      loginButton.classList.add("user-chip");
      attachLoggedInActions(loginButton);
      return;
    }
  } catch {
    clearAuthSession();
  }

  loginButton.href = "login.html";
  loginButton.textContent = "Đăng Nhập";
  loginButton.title = "Đăng nhập";
  loginButton.classList.remove("user-chip");
  removeAuthActionButtons(loginButton);
}

async function loadMovies() {
  const nowGrid = document.getElementById("nowShowingGrid");
  const comingGrid = document.getElementById("comingSoonGrid");

  if (!nowGrid || !comingGrid) {
    return;
  }

  try {
    const nowData = await API.get("/api/movies?status=now_showing");
    const comingData = await API.get("/api/movies?status=coming_soon");

    renderMovieCards(nowGrid, nowData.data, "poster-a");
    renderMovieCards(comingGrid, comingData.data, "poster-g");
  } catch (error) {
    nowGrid.innerHTML = `<p class=\"empty-note\">Không tải dữ liệu phim: ${error.message}</p>`;
    comingGrid.innerHTML = "";
  }
}

async function loadTheaters() {
  const theaterGrid = document.getElementById("theaterGrid");
  if (!theaterGrid) {
    return;
  }

  try {
    const payload = await API.get("/api/theaters");
    renderTheaters(theaterGrid, payload.data || []);
  } catch (error) {
    theaterGrid.innerHTML = `<p class="empty-note">Không tải dữ liệu rạp: ${error.message}</p>`;
  }
}

async function loadBlogs() {
  const blogGrid = document.getElementById("homeBlogGrid");
  if (!blogGrid) {
    return;
  }

  try {
    const payload = await API.get("/api/blogs");
    renderBlogCards(blogGrid, payload.data || []);
  } catch (error) {
    blogGrid.innerHTML = `<p class="empty-note">Không tải dữ liệu blog: ${error.message}</p>`;
  }
}

function renderTheaters(container, theaters) {
  if (!Array.isArray(theaters) || !theaters.length) {
    container.innerHTML = '<p class="empty-note">Chưa có dữ liệu rạp.</p>';
    return;
  }

  const statsEl = document.getElementById("theaterStats");
  if (statsEl) {
    const cityCount = new Set(
      theaters
        .map((theater) => String(theater.city || "").trim())
        .filter(Boolean)
    ).size;

    statsEl.innerHTML = `
      <article class="theater-stat-v2">
        <p>Tổng số rạp</p>
        <strong>${theaters.length}</strong>
      </article>
      <article class="theater-stat-v2">
        <p>Khu vực</p>
        <strong>${cityCount || 1}</strong>
      </article>
      <article class="theater-stat-v2">
        <p>Trạng thái</p>
        <strong>Đang mở</strong>
      </article>
    `;
  }

  container.innerHTML = theaters
    .map(
      (theater) => `
        <article class="theater-card theater-card-v2">
          <div class="theater-card-top-v2">
            <h3>${theater.name || "Rạp"}</h3>
            <span class="theater-chip-v2">Hoạt động</span>
          </div>
          <p><strong>Thành phố:</strong> ${theater.city || "Đang cập nhật"}</p>
          <p><strong>Địa chỉ:</strong> ${theater.address || "Đang cập nhật"}</p>
          <a class="theater-link-v2" href="showtimes.html">Xem suất chiếu</a>
        </article>
      `
    )
    .join("");
}

function renderMovieCards(container, movies, fallbackClass) {
  if (!Array.isArray(movies) || !movies.length) {
    container.innerHTML = "<p class=\"empty-note\">Chưa có dữ liệu.</p>";
    return;
  }

  const posterClasses = [
    "poster-a",
    "poster-b",
    "poster-c",
    "poster-d",
    "poster-e",
    "poster-f",
    "poster-g",
    "poster-h",
    "poster-i",
    "poster-j",
    "poster-k",
    "poster-l",
  ];

  container.innerHTML = movies
    .map((movie, idx) => {
      const styleClass = posterClasses[idx % posterClasses.length] || fallbackClass;
      const posterUrl = String(movie.posterUrl || "").trim();
      const safePosterUrl = posterUrl ? encodeURI(posterUrl).replace(/"/g, "%22") : "";
      const safeTitle = String(movie.title || "Phim").replace(/"/g, "&quot;");
      const detailUrl = `movie-detail.html?id=${movie.id}`;
      const posterMarkup = safePosterUrl
        ? `<img class="card-poster" src="${safePosterUrl}" alt="Poster ${safeTitle}" loading="lazy" decoding="async" onerror="this.remove()" />`
        : "";
      return `
        <article class="card ${styleClass}" data-detail-url="${detailUrl}" tabindex="0" role="link" aria-label="Xem chi tiết phim ${safeTitle}">
          ${posterMarkup}
          <span>${movie.title}</span>
          <a class="card-link" href="${detailUrl}">Chi tiết</a>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll(".card[data-detail-url]").forEach((card) => {
    const detailUrl = card.dataset.detailUrl;
    if (!detailUrl || card.dataset.bound === "1") {
      return;
    }

    card.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLAnchorElement) {
        return;
      }
      window.location.href = detailUrl;
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = detailUrl;
      }
    });

    card.dataset.bound = "1";
  });
}

function renderBlogCards(container, blogs) {
  if (!Array.isArray(blogs) || !blogs.length) {
    container.innerHTML = '<p class="empty-note">Chưa có blog.</p>';
    return;
  }

  container.innerHTML = blogs
    .slice(0, 6)
    .map((blog) => {
      const summary = String(blog.summary || "").trim() || String(blog.content || "").slice(0, 130);
      const imageMarkup = blog.imageUrl ? `<img src="${blog.imageUrl}" alt="${blog.title}" loading="lazy" />` : "";
      return `
        <article class="blog-card">
          <div class="blog-card-media">${imageMarkup}</div>
          <div class="blog-card-body">
            <h3 class="blog-card-title">${blog.title || "Blog"}</h3>
            <p class="blog-card-summary">${summary}</p>
            <a class="blog-card-link" href="blog-detail.html?id=${blog.id}">Xem chi tiết</a>
          </div>
        </article>
      `;
    })
    .join("");
}

renderTopbarUser();
loadMovies();
loadTheaters();
loadBlogs();
