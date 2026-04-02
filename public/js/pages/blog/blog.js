const blogGrid = document.getElementById("blogGrid");
const blogNotice = document.getElementById("blogNotice");

function renderBlogList(blogs) {
  if (!Array.isArray(blogs) || !blogs.length) {
    blogGrid.innerHTML = '<p class="empty-note">Chưa có bài blog.</p>';
    return;
  }

  blogGrid.innerHTML = blogs
    .map((blog) => {
      const summary = String(blog.summary || "").trim() || String(blog.content || "").slice(0, 140);
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

async function initBlogPage() {
  try {
    const payload = await API.get("/api/blogs");
    renderBlogList(payload.data || []);
  } catch (error) {
    blogNotice.textContent = error.message;
  }
}

initBlogPage();
