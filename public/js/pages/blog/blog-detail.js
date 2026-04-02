const blogDetailTitle = document.getElementById("blogDetailTitle");
const blogDetailDate = document.getElementById("blogDetailDate");
const blogDetailImage = document.getElementById("blogDetailImage");
const blogDetailSummary = document.getElementById("blogDetailSummary");
const blogDetailContent = document.getElementById("blogDetailContent");

function getBlogIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("id") || 0);
}

async function initBlogDetailPage() {
  const blogId = getBlogIdFromQuery();
  if (!blogId) {
    blogDetailTitle.textContent = "Không tìm thấy blog";
    return;
  }

  try {
    const payload = await API.get(`/api/blogs/${blogId}`);
    const blog = payload.data;
    blogDetailTitle.textContent = blog.title || "Blog";
    blogDetailDate.textContent = `Cập nhật: ${formatDateTime(blog.updatedAt || blog.createdAt)}`;
    blogDetailSummary.textContent = blog.summary || "";
    blogDetailContent.innerHTML = String(blog.content || "").replace(/\n/g, "<br />");
    blogDetailImage.innerHTML = blog.imageUrl ? `<img src="${blog.imageUrl}" alt="${blog.title}" loading="lazy" />` : "";
  } catch (error) {
    blogDetailTitle.textContent = "Không tải được chi tiết blog";
    blogDetailDate.textContent = error.message;
  }
}

initBlogDetailPage();
