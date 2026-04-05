const API = {
  async request(path, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || "Request failed");
    }

    return payload;
  },

  async get(path) {
    return this.request(path, { method: "GET" });
  },

  async post(path, data) {
    return this.request(path, { method: "POST", body: JSON.stringify(data) });
  },

  async put(path, data) {
    return this.request(path, { method: "PUT", body: JSON.stringify(data) });
  },

  async patch(path, data) {
    return this.request(path, { method: "PATCH", body: JSON.stringify(data) });
  },

  async delete(path) {
    return this.request(path, { method: "DELETE" });
  },
};

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value) || 0);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}
