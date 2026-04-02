const adminIdentity = document.getElementById("adminIdentity");
const overview = document.getElementById("overview");
const adminNotice = document.getElementById("adminNotice");
const movieList = document.getElementById("movieList");
const theaterList = document.getElementById("theaterList");
const showtimeList = document.getElementById("showtimeList");
const comboList = document.getElementById("comboList");
const orderList = document.getElementById("orderList");
const formatList = document.getElementById("formatList");
const blogList = document.getElementById("blogList");
const movieForm = document.getElementById("movieForm");
const theaterForm = document.getElementById("theaterForm");
const showtimeForm = document.getElementById("showtimeForm");
const comboForm = document.getElementById("comboForm");
const formatForm = document.getElementById("formatForm");
const blogForm = document.getElementById("blogForm");
const logoutBtn = document.getElementById("logoutBtn");
const showtimeMovie = document.getElementById("showtimeMovie");
const showtimeTheater = document.getElementById("showtimeTheater");
const showtimeFormat = document.getElementById("showtimeFormat");
const showtimeTotalSeats = document.getElementById("showtimeTotalSeats");
const movieFormatCombo = document.getElementById("movieFormatCombo");
const movieFormatMenu = document.getElementById("movieFormatMenu");
const adminMenuItems = document.querySelectorAll("[data-admin-view]");
const adminPanels = document.querySelectorAll("[data-admin-panel]");
const adminEditModal = document.getElementById("adminEditModal");
const adminEditTitle = document.getElementById("adminEditTitle");
const adminEditForm = document.getElementById("adminEditForm");
const adminEditFields = document.getElementById("adminEditFields");
const adminEditError = document.getElementById("adminEditError");
const adminEditCancel = document.getElementById("adminEditCancel");
const adminEditClose = document.getElementById("adminEditClose");
const adminEditSave = document.getElementById("adminEditSave");

let movies = [];
let theaters = [];
let showtimes = [];
let combos = [];
let orders = [];
let formats = [];
let blogs = [];
let activeModalSubmit = null;

function getMovieFormatsByMovieId(movieId) {
  const movie = movies.find((item) => Number(item.id) === Number(movieId));
  if (!movie || !Array.isArray(movie.formatIds)) {
    return [];
  }

  const idSet = new Set(movie.formatIds.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0));
  return formats.filter((format) => idSet.has(Number(format.id)));
}

function defaultSeatsByFormatName(formatName) {
  const normalized = String(formatName || "").toUpperCase();
  if (normalized === "IMAX") return 240;
  if (normalized === "SVIP") return 64;
  if (normalized === "3D") return 140;
  if (normalized === "4D") return 100;
  return 120;
}

function defaultSeatsByFormatId(formatId) {
  const format = formats.find((item) => Number(item.id) === Number(formatId));
  return defaultSeatsByFormatName(format?.name || "2D");
}

function renderFormatSelectOptions(selectEl, movieId, selectedFormatId = 0) {
  if (!selectEl) {
    return;
  }

  const movieFormats = getMovieFormatsByMovieId(movieId);
  if (!movieFormats.length) {
    selectEl.innerHTML = '<option value="">Chưa có định dạng cho phim này</option>';
    selectEl.disabled = true;
    return;
  }

  selectEl.disabled = false;
  selectEl.innerHTML = movieFormats.map((format) => `<option value="${format.id}">${format.name}</option>`).join("");

  const hasSelected = movieFormats.some((format) => Number(format.id) === Number(selectedFormatId));
  selectEl.value = String(hasSelected ? selectedFormatId : movieFormats[0].id);

  if (selectEl === showtimeFormat && showtimeTotalSeats) {
    showtimeTotalSeats.value = String(defaultSeatsByFormatId(selectEl.value));
  }
}

function toNumberArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
  }
  const single = Number(value);
  return Number.isFinite(single) && single > 0 ? [single] : [];
}

function getComboboxCheckedValues(container, inputName) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(`input[name="${inputName}"]:checked`)).map((input) => Number(input.value));
}

function updateComboboxLabel(combo, placeholder = "Chọn") {
  if (!combo) {
    return;
  }

  const trigger = combo.querySelector("[data-combobox-trigger]");
  const checkedLabels = Array.from(combo.querySelectorAll("input[type='checkbox']:checked")).map((input) => {
    const label = input.closest("label");
    return label ? label.textContent.trim() : input.value;
  });

  trigger.textContent = checkedLabels.length ? checkedLabels.join(", ") : placeholder;
}

function bindComboboxes(scope = document) {
  scope.querySelectorAll("[data-combobox]").forEach((combo) => {
    if (combo.dataset.bound === "1") {
      updateComboboxLabel(combo, combo.dataset.placeholder || "Chọn định dạng");
      return;
    }

    const trigger = combo.querySelector("[data-combobox-trigger]");
    const menu = combo.querySelector("[data-combobox-menu]");

    if (!trigger || !menu) {
      return;
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      combo.classList.toggle("is-open");
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    combo.addEventListener("change", () => {
      updateComboboxLabel(combo, combo.dataset.placeholder || "Chọn định dạng");
    });

    document.addEventListener("click", (event) => {
      if (!combo.contains(event.target)) {
        combo.classList.remove("is-open");
      }
    });

    combo.dataset.bound = "1";
    updateComboboxLabel(combo, combo.dataset.placeholder || "Chọn định dạng");
  });
}

function renderTable(headers, rows) {
  return `
    <table class="table">
      <thead><tr>${headers.map((item) => `<th>${item}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Chưa có dữ liệu</td></tr>`}
      </tbody>
    </table>
  `;
}

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  return String(value).replace(" ", "T").slice(0, 16);
}

function closeEditModal() {
  if (!adminEditModal) {
    return;
  }

  adminEditModal.classList.remove("is-open");
  adminEditModal.setAttribute("aria-hidden", "true");
  adminEditFields.innerHTML = "";
  adminEditError.textContent = "";
  activeModalSubmit = null;
}

function buildModalFields(fields, values) {
  adminEditFields.innerHTML = fields
    .map((field) => {
      const value = values[field.name] ?? "";
      const commonAttrs = `id="modal_${field.name}" name="${field.name}" title="${field.label}" ${field.required ? "required" : ""}`;

      if (field.type === "textarea") {
        return `
          <div class="field ${field.spanAll ? "grid-span-all" : ""}">
            <label for="modal_${field.name}">${field.label}</label>
            <textarea ${commonAttrs} rows="${field.rows || 4}">${value}</textarea>
          </div>
        `;
      }

      if (field.type === "select") {
        if (field.multiple) {
          const selectedValues = Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
          const options = (field.options || [])
            .map(
              (opt) => `
                <label class="multi-combobox-option">
                  <input type="checkbox" name="${field.name}" value="${opt.value}" ${selectedValues.includes(String(opt.value)) ? "checked" : ""} />
                  ${opt.label}
                </label>
              `
            )
            .join("");

          return `
            <div class="field ${field.spanAll ? "grid-span-all" : ""}">
              <label for="modal_${field.name}">${field.label}</label>
              <div class="multi-combobox" data-combobox data-placeholder="Chọn định dạng">
                <button id="modal_${field.name}" class="multi-combobox-trigger" type="button" data-combobox-trigger>Chọn định dạng</button>
                <div class="multi-combobox-menu" data-combobox-menu>${options}</div>
              </div>
            </div>
          `;
        }

        const selectedValues = Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
        const options = (field.options || [])
          .map((opt) => `<option value="${opt.value}" ${selectedValues.includes(String(opt.value)) ? "selected" : ""}>${opt.label}</option>`)
          .join("");

        return `
          <div class="field ${field.spanAll ? "grid-span-all" : ""}">
            <label for="modal_${field.name}">${field.label}</label>
            <select ${commonAttrs} ${field.multiple ? "multiple" : ""}>${options}</select>
          </div>
        `;
      }

      return `
        <div class="field ${field.spanAll ? "grid-span-all" : ""}">
          <label for="modal_${field.name}">${field.label}</label>
          <input ${commonAttrs} type="${field.type || "text"}" value="${String(value).replace(/"/g, "&quot;")}" />
        </div>
      `;
    })
    .join("");
}

function openEditModal({ title, fields, values, onSubmit }) {
  if (!adminEditModal || !adminEditForm) {
    return;
  }

  adminEditTitle.textContent = title;
  adminEditError.textContent = "";
  buildModalFields(fields, values);
  bindComboboxes(adminEditForm);
  activeModalSubmit = onSubmit;
  adminEditModal.classList.add("is-open");
  adminEditModal.setAttribute("aria-hidden", "false");
}

async function checkAdmin() {
  try {
    const payload = await API.get("/api/auth/me");
    if (payload.user.role !== "admin") {
      adminIdentity.textContent = "Bạn không có quyền admin. Vui lòng đăng nhập tài khoản admin.";
      throw new Error("Admin access required");
    }

    adminIdentity.innerHTML = `<strong>Xin chào, ${payload.user.fullName}</strong>`;
    return true;
  } catch (error) {
    adminIdentity.textContent = `Không thể truy cập trang admin: ${error.message}`;
    return false;
  }
}

async function loadOverview() {
  const payload = await API.get("/api/admin/overview");
  overview.innerHTML = `
    <div class="summary-box"><strong>Phim</strong><div>${payload.data.movies}</div></div>
    <div class="summary-box"><strong>Rạp</strong><div>${payload.data.theaters}</div></div>
    <div class="summary-box"><strong>Suất chiếu</strong><div>${payload.data.showtimes}</div></div>
    <div class="summary-box"><strong>Đơn đặt</strong><div>${payload.data.orders}</div></div>
  `;
}

async function loadData() {
  const [moviesPayload, theatersPayload, showtimesPayload, combosPayload, ordersPayload, formatsPayload, blogsPayload] = await Promise.all([
    API.get("/api/movies"),
    API.get("/api/theaters"),
    API.get("/api/showtimes"),
    API.get("/api/combos"),
    API.get("/api/admin/orders"),
    API.get("/api/admin/formats"),
    API.get("/api/blogs?includeDraft=1"),
  ]);

  movies = moviesPayload.data;
  theaters = theatersPayload.data;
  showtimes = showtimesPayload.data;
  combos = combosPayload.data;
  orders = ordersPayload.data;
  formats = formatsPayload.data;
  blogs = blogsPayload.data;

  showtimeMovie.innerHTML = movies.map((movie) => `<option value="${movie.id}">${movie.title}</option>`).join("");
  showtimeTheater.innerHTML = theaters.map((theater) => `<option value="${theater.id}">${theater.name}</option>`).join("");
  renderFormatSelectOptions(showtimeFormat, Number(showtimeMovie.value || movies[0]?.id || 0), Number(showtimeFormat.value || 0));
  movieFormatMenu.innerHTML = formats
    .map(
      (format) => `
        <label class="multi-combobox-option">
          <input type="checkbox" name="formatIds" value="${format.id}" ${format.name === "2D" ? "checked" : ""} />
          ${format.name}
        </label>
      `
    )
    .join("");
  movieFormatCombo.dataset.placeholder = "Chọn định dạng phim";
  bindComboboxes(document);

  movieList.innerHTML = renderTable(
    ["ID", "Tiêu đề", "Định dạng", "Đạo diễn", "Diễn viên", "Ngôn ngữ", "Thể loại", "Rated", "Trạng thái", "Thao tác"],
    movies.map((movie) => [
      movie.id,
      movie.title,
      Array.isArray(movie.formatNames) && movie.formatNames.length ? movie.formatNames.join(", ") : "2D",
      movie.director || "",
      movie.castInfo || "",
      movie.language || "",
      movie.genre || "",
      movie.rated || "",
      movie.status,
      `<div class=\"action-row\"><button class=\"btn btn-light\" data-edit-movie=\"${movie.id}\" type=\"button\">Sửa</button><button class=\"btn btn-danger\" data-delete-movie=\"${movie.id}\" type=\"button\">Xóa</button></div>`,
    ])
  );

  theaterList.innerHTML = renderTable(
    ["ID", "Tên rạp", "Thành phố", "Địa chỉ", "Thao tác"],
    theaters.map((theater) => [
      theater.id,
      theater.name,
      theater.city || "",
      theater.address || "",
      `<div class=\"action-row\"><button class=\"btn btn-light\" data-edit-theater=\"${theater.id}\" type=\"button\">Sửa</button><button class=\"btn btn-danger\" data-delete-theater=\"${theater.id}\" type=\"button\">Xóa</button></div>`,
    ])
  );

  showtimeList.innerHTML = renderTable(
    ["ID", "Phim", "Rạp", "Định dạng", "Bắt đầu", "Giá", "Thao tác"],
    showtimes.map((showtime) => [
      showtime.id,
      showtime.movieTitle,
      showtime.theaterName,
      showtime.formatName || "2D",
      formatDateTime(showtime.startTime),
      formatCurrency(showtime.price),
      `<div class=\"action-row\"><button class=\"btn btn-light\" data-edit-showtime=\"${showtime.id}\" type=\"button\">Sửa</button><button class=\"btn btn-danger\" data-delete-showtime=\"${showtime.id}\" type=\"button\">Xóa</button></div>`,
    ])
  );

  comboList.innerHTML = renderTable(
    ["ID", "Tên", "Hình ảnh", "Mô tả", "Giá", "Thao tác"],
    combos.map((combo) => [
      combo.id,
      combo.name,
      combo.imageUrl
        ? `<img src="${combo.imageUrl}" alt="${combo.name}" class="admin-combo-thumb" loading="lazy" referrerpolicy="no-referrer" />`
        : "",
      combo.description || "",
      formatCurrency(combo.price),
      `<div class=\"action-row\"><button class=\"btn btn-light\" data-edit-combo=\"${combo.id}\" type=\"button\">Sửa</button><button class=\"btn btn-danger\" data-delete-combo=\"${combo.id}\" type=\"button\">Xóa</button></div>`,
    ])
  );

  orderList.innerHTML = renderTable(
    ["ID", "Khách", "Phim", "Rạp", "Ghế", "Tổng tiền", "Thanh toán", "Trạng thái", "Thao tác"],
    orders.map((order) => [
      order.id,
      `${order.customerName}<br/>${order.email}`,
      order.movieTitle,
      `${order.theaterName}<br/>${formatDateTime(order.startTime)}`,
      Array.isArray(order.seatList) ? order.seatList.join(", ") : "",
      formatCurrency(order.totalAmount),
      order.paymentStatus,
      order.status,
      `<button class=\"btn btn-light\" data-edit-order=\"${order.id}\" type=\"button\">Sửa</button>`,
    ])
  );

  formatList.innerHTML = renderTable(
    ["ID", "Tên định dạng", "Thao tác"],
    formats.map((format) => [
      format.id,
      format.name,
      `<div class=\"action-row\"><button class=\"btn btn-light\" data-edit-format=\"${format.id}\" type=\"button\">Sửa</button><button class=\"btn btn-danger\" data-delete-format=\"${format.id}\" type=\"button\">Xóa</button></div>`,
    ])
  );

  blogList.innerHTML = renderTable(
    ["ID", "Tiêu đề", "Trạng thái", "Ảnh", "Tóm tắt", "Thao tác"],
    blogs.map((blog) => [
      blog.id,
      blog.title,
      blog.status || "published",
      blog.imageUrl
        ? `<img src="${blog.imageUrl}" alt="${blog.title}" class="admin-combo-thumb" loading="lazy" referrerpolicy="no-referrer" />`
        : "",
      blog.summary || "",
      `<div class=\"action-row\"><button class=\"btn btn-light\" data-edit-blog=\"${blog.id}\" type=\"button\">Sửa</button><button class=\"btn btn-danger\" data-delete-blog=\"${blog.id}\" type=\"button\">Xóa</button></div>`,
    ])
  );

  bindDeleteActions();
  bindEditActions();
}

function bindDeleteActions() {
  document.querySelectorAll("[data-delete-movie]").forEach((button) => {
    button.addEventListener("click", async () => {
      await API.delete(`/api/admin/movies/${button.dataset.deleteMovie}`);
      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete-theater]").forEach((button) => {
    button.addEventListener("click", async () => {
      await API.delete(`/api/admin/theaters/${button.dataset.deleteTheater}`);
      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete-showtime]").forEach((button) => {
    button.addEventListener("click", async () => {
      await API.delete(`/api/admin/showtimes/${button.dataset.deleteShowtime}`);
      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete-combo]").forEach((button) => {
    button.addEventListener("click", async () => {
      await API.delete(`/api/admin/combos/${button.dataset.deleteCombo}`);
      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete-format]").forEach((button) => {
    button.addEventListener("click", async () => {
      await API.delete(`/api/admin/formats/${button.dataset.deleteFormat}`);
      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete-blog]").forEach((button) => {
    button.addEventListener("click", async () => {
      await API.delete(`/api/admin/blogs/${button.dataset.deleteBlog}`);
      await refreshAll();
    });
  });
}

function bindEditActions() {
  document.querySelectorAll("[data-edit-movie]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.editMovie);
      const movie = movies.find((item) => Number(item.id) === id);
      if (!movie) {
        return;
      }

      openEditModal({
        title: `Sửa phim #${id}`,
        fields: [
          { name: "title", label: "Tiêu đề", required: true },
          { name: "genre", label: "Thể loại" },
          { name: "director", label: "Đạo diễn" },
          { name: "castInfo", label: "Diễn viên" },
          { name: "language", label: "Ngôn ngữ" },
          { name: "rated", label: "Rated" },
          {
            name: "formatIds",
            label: "Định dạng",
            type: "select",
            multiple: true,
            options: formats.map((format) => ({ value: String(format.id), label: format.name })),
          },
          { name: "durationMinutes", label: "Thời lượng (phút)", type: "number" },
          { name: "releaseDate", label: "Ngày khởi chiếu", type: "date" },
          {
            name: "status",
            label: "Trạng thái",
            type: "select",
            options: [
              { label: "Đang chiếu", value: "now_showing" },
              { label: "Sắp chiếu", value: "coming_soon" },
            ],
          },
          { name: "posterUrl", label: "Poster URL" },
          { name: "description", label: "Nội dung phim", type: "textarea", spanAll: true, rows: 5 },
        ],
        values: {
          title: movie.title,
          genre: movie.genre || "",
          director: movie.director || "",
          castInfo: movie.castInfo || "",
          language: movie.language || "",
          rated: movie.rated || "",
          formatIds: Array.isArray(movie.formatIds) && movie.formatIds.length ? movie.formatIds.map((item) => String(item)) : [String(formats[0]?.id || "")],
          durationMinutes: movie.durationMinutes || "",
          releaseDate: movie.releaseDate ? String(movie.releaseDate).slice(0, 10) : "",
          status: movie.status || "coming_soon",
          posterUrl: movie.posterUrl || "",
          description: movie.description || "",
        },
        onSubmit: async (payload) => {
          await API.put(`/api/admin/movies/${id}`, {
            ...payload,
            durationMinutes: payload.durationMinutes ? Number(payload.durationMinutes) : null,
            genre: payload.genre || null,
            director: payload.director || null,
            castInfo: payload.castInfo || null,
            language: payload.language || null,
            rated: payload.rated || null,
            formatIds: toNumberArray(payload.formatIds),
            releaseDate: payload.releaseDate || null,
            posterUrl: payload.posterUrl || null,
            description: payload.description || null,
          });
        },
      });
    });
  });

  document.querySelectorAll("[data-edit-theater]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.editTheater);
      const theater = theaters.find((item) => Number(item.id) === id);
      if (!theater) {
        return;
      }

      openEditModal({
        title: `Sửa rạp #${id}`,
        fields: [
          { name: "name", label: "Tên rạp", required: true },
          { name: "city", label: "Thành phố" },
          { name: "address", label: "Địa chỉ", spanAll: true },
        ],
        values: {
          name: theater.name,
          city: theater.city || "",
          address: theater.address || "",
        },
        onSubmit: async (payload) => {
          await API.put(`/api/admin/theaters/${id}`, {
            name: payload.name,
            city: payload.city || null,
            address: payload.address || null,
          });
        },
      });
    });
  });

  document.querySelectorAll("[data-edit-showtime]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.editShowtime);
      const showtime = showtimes.find((item) => Number(item.id) === id);
      if (!showtime) {
        return;
      }

      openEditModal({
        title: `Sửa suất chiếu #${id}`,
        fields: [
          {
            name: "movieId",
            label: "Phim",
            type: "select",
            options: movies.map((movie) => ({ value: String(movie.id), label: `${movie.id} - ${movie.title}` })),
          },
          {
            name: "theaterId",
            label: "Rạp",
            type: "select",
            options: theaters.map((theater) => ({ value: String(theater.id), label: `${theater.id} - ${theater.name}` })),
          },
          {
            name: "formatId",
            label: "Định dạng",
            type: "select",
            options: getMovieFormatsByMovieId(showtime.movieId).map((format) => ({ value: String(format.id), label: format.name })),
          },
          { name: "startTime", label: "Bắt đầu", type: "datetime-local", required: true },
          { name: "price", label: "Giá vé", type: "number", required: true },
          { name: "totalSeats", label: "Tổng ghế", type: "number", required: true },
        ],
        values: {
          movieId: String(showtime.movieId),
          theaterId: String(showtime.theaterId),
          formatId: String(showtime.formatId || formats[0]?.id || ""),
          startTime: toDateTimeLocal(showtime.startTime),
          price: showtime.price,
          totalSeats: showtime.totalSeats || 60,
        },
        onSubmit: async (payload) => {
          await API.put(`/api/admin/showtimes/${id}`, {
            movieId: Number(payload.movieId),
            theaterId: Number(payload.theaterId),
            formatId: Number(payload.formatId),
            startTime: `${payload.startTime.replace("T", " ")}:00`,
            price: Number(payload.price),
            totalSeats: Number(payload.totalSeats || 60),
          });
        },
      });

      const modalMovieSelect = document.getElementById("modal_movieId");
      const modalFormatSelect = document.getElementById("modal_formatId");
      const modalTotalSeatsInput = document.getElementById("modal_totalSeats");
      if (modalTotalSeatsInput) {
        modalTotalSeatsInput.readOnly = true;
        modalTotalSeatsInput.value = String(defaultSeatsByFormatId(modalFormatSelect?.value || showtime.formatId));
      }
      if (modalMovieSelect && modalFormatSelect) {
        modalMovieSelect.addEventListener("change", () => {
          renderFormatSelectOptions(modalFormatSelect, Number(modalMovieSelect.value || 0), 0);
          if (modalTotalSeatsInput) {
            modalTotalSeatsInput.value = String(defaultSeatsByFormatId(modalFormatSelect.value));
          }
        });

        modalFormatSelect.addEventListener("change", () => {
          if (modalTotalSeatsInput) {
            modalTotalSeatsInput.value = String(defaultSeatsByFormatId(modalFormatSelect.value));
          }
        });
      }
    });
  });

  document.querySelectorAll("[data-edit-format]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.editFormat);
      const format = formats.find((item) => Number(item.id) === id);
      if (!format) {
        return;
      }

      openEditModal({
        title: `Sửa định dạng #${id}`,
        fields: [{ name: "name", label: "Tên định dạng", required: true }],
        values: { name: format.name },
        onSubmit: async (payload) => {
          await API.put(`/api/admin/formats/${id}`, {
            name: payload.name,
          });
        },
      });
    });
  });

  document.querySelectorAll("[data-edit-combo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.editCombo);
      const combo = combos.find((item) => Number(item.id) === id);
      if (!combo) {
        return;
      }

      openEditModal({
        title: `Sửa combo #${id}`,
        fields: [
          { name: "name", label: "Tên combo", required: true },
          { name: "imageUrl", label: "URL hình ảnh" },
          { name: "price", label: "Giá", type: "number", required: true },
          { name: "description", label: "Mô tả", type: "textarea", spanAll: true, rows: 4 },
        ],
        values: {
          name: combo.name,
          imageUrl: combo.imageUrl || "",
          price: combo.price,
          description: combo.description || "",
        },
        onSubmit: async (payload) => {
          await API.put(`/api/admin/combos/${id}`, {
            name: payload.name,
            imageUrl: payload.imageUrl || null,
            description: payload.description || null,
            price: Number(payload.price),
          });
        },
      });
    });
  });

  document.querySelectorAll("[data-edit-order]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.editOrder);
      const order = orders.find((item) => Number(item.id) === id);
      if (!order) {
        return;
      }

      openEditModal({
        title: `Sửa đơn đặt #${id}`,
        fields: [
          {
            name: "paymentStatus",
            label: "Thanh toán",
            type: "select",
            options: [
              { label: "Chờ thanh toán", value: "pending" },
              { label: "Đã thanh toán", value: "paid" },
              { label: "Thanh toán lỗi", value: "failed" },
            ],
          },
          {
            name: "status",
            label: "Trạng thái đơn",
            type: "select",
            options: [
              { label: "Chờ xử lý", value: "pending" },
              { label: "Đã xác nhận", value: "confirmed" },
              { label: "Đã hủy", value: "cancelled" },
            ],
          },
        ],
        values: {
          paymentStatus: order.paymentStatus || "pending",
          status: order.status || "pending",
        },
        onSubmit: async (payload) => {
          await API.put(`/api/admin/orders/${id}`, {
            paymentStatus: payload.paymentStatus,
            status: payload.status,
          });
        },
      });
    });
  });

  document.querySelectorAll("[data-edit-blog]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.editBlog);
      const blog = blogs.find((item) => Number(item.id) === id);
      if (!blog) {
        return;
      }

      openEditModal({
        title: `Sửa blog #${id}`,
        fields: [
          { name: "title", label: "Tiêu đề", required: true, spanAll: true },
          { name: "summary", label: "Tóm tắt", spanAll: true },
          { name: "imageUrl", label: "URL hình ảnh", spanAll: true },
          {
            name: "status",
            label: "Trạng thái",
            type: "select",
            options: [
              { label: "Published", value: "published" },
              { label: "Draft", value: "draft" },
            ],
          },
          { name: "content", label: "Nội dung", type: "textarea", spanAll: true, rows: 10, required: true },
        ],
        values: {
          title: blog.title || "",
          summary: blog.summary || "",
          imageUrl: blog.imageUrl || "",
          status: blog.status || "published",
          content: blog.content || "",
        },
        onSubmit: async (payload) => {
          await API.put(`/api/admin/blogs/${id}`, {
            title: payload.title,
            summary: payload.summary || null,
            imageUrl: payload.imageUrl || null,
            status: payload.status === "draft" ? "draft" : "published",
            content: payload.content,
          });
        },
      });
    });
  });
}

function switchAdminView(viewKey) {
  adminMenuItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.adminView === viewKey);
  });

  adminPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.adminPanel === viewKey);
  });
}

function bindAdminMenu() {
  if (!adminMenuItems.length || !adminPanels.length) {
    return;
  }

  adminMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
      switchAdminView(item.dataset.adminView);
    });
  });
}

adminEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeModalSubmit) {
    return;
  }

  const formData = new FormData(adminEditForm);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      if (!Array.isArray(payload[key])) {
        payload[key] = [payload[key]];
      }
      payload[key].push(value);
      continue;
    }
    payload[key] = value;
  }
  try {
    adminEditSave.disabled = true;
    adminEditError.textContent = "";
    await activeModalSubmit(payload);
    closeEditModal();
    await refreshAll();
  } catch (error) {
    adminEditError.textContent = error.message;
  } finally {
    adminEditSave.disabled = false;
  }
});

adminEditCancel?.addEventListener("click", closeEditModal);
adminEditClose?.addEventListener("click", closeEditModal);
adminEditModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.modalClose === "true") {
    closeEditModal();
  }
});

movieForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(movieForm).entries());
  const selectedFormatIds = getComboboxCheckedValues(movieFormatMenu, "formatIds");

  await API.post("/api/admin/movies", {
    ...data,
    director: data.director || null,
    castInfo: data.castInfo || null,
    language: data.language || null,
    rated: data.rated || null,
    formatIds: selectedFormatIds,
    durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
  });
  movieForm.reset();
  if (movieFormatMenu) {
    movieFormatMenu.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = false;
    });
  }
  updateComboboxLabel(movieFormatCombo, "Chọn định dạng phim");
  await refreshAll();
});

theaterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(theaterForm).entries());
  await API.post("/api/admin/theaters", data);
  theaterForm.reset();
  await refreshAll();
});

showtimeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(showtimeForm).entries());
  await API.post("/api/admin/showtimes", {
    ...data,
    movieId: Number(data.movieId),
    theaterId: Number(data.theaterId),
    formatId: Number(data.formatId),
    price: Number(data.price),
    totalSeats: defaultSeatsByFormatId(data.formatId),
    startTime: data.startTime.replace("T", " ") + ":00",
  });
  showtimeForm.reset();
  await refreshAll();
});

if (showtimeMovie) {
  showtimeMovie.addEventListener("change", () => {
    renderFormatSelectOptions(showtimeFormat, Number(showtimeMovie.value || 0), 0);
  });
}

if (showtimeFormat) {
  showtimeFormat.addEventListener("change", () => {
    if (showtimeTotalSeats) {
      showtimeTotalSeats.value = String(defaultSeatsByFormatId(showtimeFormat.value));
    }
  });
}

formatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(formatForm).entries());
  await API.post("/api/admin/formats", {
    name: data.name,
  });
  formatForm.reset();
  await refreshAll();
});

comboForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(comboForm).entries());
  await API.post("/api/admin/combos", {
    ...data,
    imageUrl: data.imageUrl || null,
    price: Number(data.price),
  });
  comboForm.reset();
  await refreshAll();
});

blogForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(blogForm).entries());
  await API.post("/api/admin/blogs", {
    title: data.title,
    summary: data.summary || null,
    imageUrl: data.imageUrl || null,
    status: data.status === "draft" ? "draft" : "published",
    content: data.content,
  });
  blogForm.reset();
  const blogStatus = document.getElementById("blogStatus");
  if (blogStatus) {
    blogStatus.value = "published";
  }
  await refreshAll();
});

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
});

async function refreshAll() {
  try {
    await Promise.all([loadOverview(), loadData()]);
    adminNotice.textContent = "";
  } catch (error) {
    adminNotice.textContent = error.message;
  }
}

(async () => {
  bindAdminMenu();
  const isAdmin = await checkAdmin();
  if (!isAdmin) {
    return;
  }
  await refreshAll();
})();
