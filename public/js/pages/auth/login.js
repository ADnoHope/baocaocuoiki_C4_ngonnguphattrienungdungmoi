const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginNotice = document.getElementById("loginNotice");
const registerNotice = document.getElementById("registerNotice");

function setNotice(element, message, type = "") {
  if (!element) {
    return;
  }

  element.textContent = message || "";
  element.classList.remove("is-success", "is-error");
  if (type === "success") {
    element.classList.add("is-success");
  }
  if (type === "error") {
    element.classList.add("is-error");
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const payload = await API.post("/api/auth/login", {
      email: formData.get("email"),
      password: formData.get("password"),
    });

    localStorage.setItem("token", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    setNotice(loginNotice, "Đăng nhập thành công. Đang chuyển trang...", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  } catch (error) {
    setNotice(loginNotice, error.message, "error");
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);

  try {
    const payload = await API.post("/api/auth/register", {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      password: formData.get("password"),
    });

    localStorage.setItem("token", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    setNotice(registerNotice, "Đăng ký thành công. Bạn đã được đăng nhập.", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  } catch (error) {
    setNotice(registerNotice, error.message, "error");
  }
});
