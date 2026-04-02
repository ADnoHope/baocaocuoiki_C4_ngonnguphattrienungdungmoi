const { initializeDatabase, getPool } = require("./db");

const theaters = [
  { name: "CineStar Quận 1", city: "Hồ Chí Minh", address: "12 Lê Lợi, Quận 1" },
  { name: "Galaxy Tân Bình", city: "Hồ Chí Minh", address: "246 Cộng Hòa, Tân Bình" },
  { name: "BHD Bitexco", city: "Hồ Chí Minh", address: "2 Hải Triều, Quận 1" },
  { name: "CGV Vincom Thủ Đức", city: "Hồ Chí Minh", address: "216 Võ Văn Ngân, Thủ Đức" },
  { name: "Lotte Gò Vấp", city: "Hồ Chí Minh", address: "242 Nguyễn Văn Lượng, Gò Vấp" },
];

const movieFormats = ["IMAX", "3D", "4D", "2D", "SVIP"];

const movies = [
  { title: "Primate", description: "Phim hành động giật gân.", genre: "Action", director: "James Carter", castInfo: "Liam Stone, Mia Harper", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 125, releaseDate: "2026-03-10", status: "now_showing", formats: ["2D", "IMAX"] },
  { title: "Silent Hill: New Dawn", description: "Kinh dị tâm lý với thị trấn sương mù.", genre: "Horror", director: "Ava Collins", castInfo: "Noah Price, Emma Reid", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T18", duration: 113, releaseDate: "2026-04-20", status: "coming_soon", formats: ["2D", "4D"] },
  { title: "Tom & Jerry Forever", description: "Hoạt hình vui nhộn cho gia đình.", genre: "Animation", director: "Anthony Lee", castInfo: "Tom, Jerry", language: "Lồng tiếng Việt", rated: "P", duration: 98, releaseDate: "2026-03-18", status: "now_showing", formats: ["2D", "3D"] },
  { title: "Avatar: Reborn", description: "Phiêu lưu khoa học viễn tưởng quy mô lớn.", genre: "Sci-Fi", director: "James Cameron", castInfo: "Giovanni Ribisi, Kate Winslet, Zoe Saldana", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 142, releaseDate: "2026-05-10", status: "coming_soon", formats: ["3D", "IMAX", "SVIP"] },
  { title: "The Housemaid Returns", description: "Tâm lý kinh dị với tình tiết bất ngờ.", genre: "Thriller", director: "Lê Thanh Sơn", castInfo: "Lan Ngọc, Quốc Trường", language: "Tiếng Việt", rated: "T16", duration: 110, releaseDate: "2026-04-05", status: "now_showing", formats: ["2D", "SVIP"] },
  { title: "Grand Prix Legends", description: "Đua xe tốc độ cao và kịch tính.", genre: "Sport", director: "Martin Shaw", castInfo: "Chris Miles, Daniel Park", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 105, releaseDate: "2026-03-22", status: "now_showing", formats: ["2D", "4D"] },
  { title: "Suzume Winds", description: "Anime phiêu lưu tình cảm đầy cảm xúc.", genre: "Anime", director: "Makoto Shinkai", castInfo: "Nanoka Hara, Hokuto Matsumura", language: "Tiếng Nhật - Phụ đề Tiếng Việt", rated: "K", duration: 121, releaseDate: "2026-04-12", status: "coming_soon", formats: ["2D", "3D"] },
  { title: "Dino Family 2", description: "Hoạt hình gia đình đáng yêu.", genre: "Animation", director: "Henry Woods", castInfo: "Dino Kids Cast", language: "Lồng tiếng Việt", rated: "P", duration: 96, releaseDate: "2026-03-30", status: "now_showing", formats: ["2D"] },
  { title: "Boong Bắp Siêu Hời", description: "Hài hước học đường nhẹ nhàng.", genre: "Comedy", director: "Nguyễn Quang Dũng", castInfo: "Thu Trang, Tiến Luật", language: "Tiếng Việt", rated: "K", duration: 102, releaseDate: "2026-04-01", status: "now_showing", formats: ["2D", "SVIP"] },
  { title: "Last Night in Saigon", description: "Tội phạm điều tra hồi hộp.", genre: "Crime", director: "Victor Tran", castInfo: "Lê Bình, Trần Nam", language: "Tiếng Việt", rated: "T16", duration: 118, releaseDate: "2026-05-01", status: "coming_soon", formats: ["2D", "IMAX"] },
];

const combos = [
  { name: "Combo Solo", description: "1 bắp nhỏ + 1 nước ngọt", imageUrl: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=1200&q=80", price: 79000 },
  { name: "Combo Couple", description: "1 bắp vừa + 2 nước", imageUrl: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=1200&q=80", price: 129000 },
  { name: "Combo Family", description: "2 bắp vừa + 4 nước", imageUrl: "https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=1200&q=80", price: 219000 },
  { name: "Combo Teen", description: "1 bắp caramel + 1 trà đào", imageUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80", price: 89000 },
  { name: "Combo Premium", description: "1 bắp phô mai + 2 nước lớn", imageUrl: "https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&w=1200&q=80", price: 149000 },
  { name: "Combo Kids", description: "1 bắp mini + 1 sữa tươi", imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80", price: 69000 },
];

const blogs = [
  {
    title: "Bí kíp chọn ghế xem phim chuẩn trải nghiệm",
    summary: "Hướng dẫn chọn ghế theo từng thể loại phim để có trải nghiệm tốt nhất.",
    content:
      "Chọn ghế không chỉ dựa vào thói quen mà còn nên dựa theo định dạng phòng chiếu. Với phim hành động hoặc IMAX, khu vực trung tâm từ hàng E đến H thường cho góc nhìn tốt nhất. Nếu đi theo cặp, ghế đôi ở hàng cuối vừa riêng tư vừa thoải mái. Với gia đình có trẻ nhỏ, bạn nên chọn gần lối đi để di chuyển thuận tiện hơn.",
    imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
    status: "published",
  },
  {
    title: "Mẹo săn combo bắp nước tiết kiệm khi đặt online",
    summary: "Những cách tối ưu chi phí combo khi đặt vé online mà vẫn đủ đầy trải nghiệm.",
    content:
      "Bạn có thể tiết kiệm đáng kể nếu đặt combo theo nhóm thay vì mua lẻ tại quầy. Hãy theo dõi mục khuyến mãi vào khung giờ thấp điểm hoặc các ngày trong tuần để nhận ưu đãi tốt hơn. Khi đi 2-3 người, combo couple hoặc family thường có đơn giá tốt hơn. Đừng quên kiểm tra mã giảm giá trước bước thanh toán cuối cùng.",
    imageUrl: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=1200&q=80",
    status: "published",
  },
  {
    title: "Các định dạng phim phổ biến: 2D, 3D, IMAX, 4D",
    summary: "Tìm hiểu khác biệt giữa các định dạng phim để chọn suất chiếu phù hợp.",
    content:
      "2D là lựa chọn phổ biến với chi phí hợp lý và hình ảnh quen thuộc. 3D tạo chiều sâu tốt cho phim phiêu lưu, hoạt hình. IMAX có màn hình lớn và âm thanh mạnh, phù hợp phim bom tấn. 4D tăng cảm giác nhập vai với hiệu ứng chuyển động, gió và rung, nhưng sẽ phù hợp với khán giả thích trải nghiệm mạnh.",
    imageUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80",
    status: "published",
  },
];

const showtimes = [
  { movieIndex: 0, theaterIndex: 0, format: "IMAX", startTime: "2026-04-02 18:30:00", price: 95000, totalSeats: 60 },
  { movieIndex: 2, theaterIndex: 1, format: "3D", startTime: "2026-04-02 20:45:00", price: 90000, totalSeats: 60 },
  { movieIndex: 4, theaterIndex: 2, format: "SVIP", startTime: "2026-04-03 19:00:00", price: 105000, totalSeats: 70 },
  { movieIndex: 5, theaterIndex: 3, format: "4D", startTime: "2026-04-03 21:15:00", price: 99000, totalSeats: 60 },
  { movieIndex: 8, theaterIndex: 4, format: "2D", startTime: "2026-04-04 17:45:00", price: 89000, totalSeats: 55 },
];

async function seed() {
  await initializeDatabase();
  const pool = getPool();

  await pool.query("DELETE FROM booking_order_combos");
  await pool.query("DELETE FROM booking_orders");
  await pool.query("DELETE FROM bookings");
  await pool.query("DELETE FROM movie_format_mappings");
  await pool.query("DELETE FROM showtimes");
  await pool.query("DELETE FROM movie_formats");
  await pool.query("DELETE FROM combos");
  await pool.query("DELETE FROM blogs");
  await pool.query("DELETE FROM movies");
  await pool.query("DELETE FROM theaters");

  const formatIdsByName = {};
  for (const formatName of movieFormats) {
    const [result] = await pool.query("INSERT INTO movie_formats (name) VALUES (?)", [formatName]);
    formatIdsByName[formatName] = result.insertId;
  }

  const theaterIds = [];
  for (const theater of theaters) {
    const [result] = await pool.query("INSERT INTO theaters (name, city, address) VALUES (?, ?, ?)", [
      theater.name,
      theater.city,
      theater.address,
    ]);
    theaterIds.push(result.insertId);
  }

  const movieIds = [];
  for (let index = 0; index < movies.length; index += 1) {
    const movie = movies[index];
    const [result] = await pool.query(
      "INSERT INTO movies (title, description, genre, director, cast_info, language, rated, duration_minutes, release_date, status, poster_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        movie.title,
        movie.description,
        movie.genre,
        movie.director,
        movie.castInfo,
        movie.language,
        movie.rated,
        movie.duration,
        movie.releaseDate,
        movie.status,
        null,
      ]
    );
    movieIds.push(result.insertId);

    const movieFormatsToAssign = Array.isArray(movie.formats) && movie.formats.length ? movie.formats : ["2D"];
    for (const formatName of movieFormatsToAssign) {
      if (formatIdsByName[formatName]) {
        await pool.query("INSERT INTO movie_format_mappings (movie_id, format_id) VALUES (?, ?)", [result.insertId, formatIdsByName[formatName]]);
      }
    }
  }

  for (const combo of combos) {
    await pool.query("INSERT INTO combos (name, description, image_url, price) VALUES (?, ?, ?, ?)", [combo.name, combo.description, combo.imageUrl || null, combo.price]);
  }

  for (const blog of blogs) {
    await pool.query("INSERT INTO blogs (title, summary, content, image_url, status) VALUES (?, ?, ?, ?, ?)", [
      blog.title,
      blog.summary || null,
      blog.content,
      blog.imageUrl || null,
      blog.status || "published",
    ]);
  }

  for (const showtime of showtimes) {
    await pool.query(
      "INSERT INTO showtimes (movie_id, theater_id, format_id, start_time, price, total_seats) VALUES (?, ?, ?, ?, ?, ?)",
      [
        movieIds[showtime.movieIndex],
        theaterIds[showtime.theaterIndex],
        formatIdsByName[showtime.format] || formatIdsByName["2D"],
        showtime.startTime,
        showtime.price,
        showtime.totalSeats,
      ]
    );
  }

  const [[movieCount]] = await pool.query("SELECT COUNT(*) AS total FROM movies");
  const [[theaterCount]] = await pool.query("SELECT COUNT(*) AS total FROM theaters");
  const [[showtimeCount]] = await pool.query("SELECT COUNT(*) AS total FROM showtimes");
  const [[comboCount]] = await pool.query("SELECT COUNT(*) AS total FROM combos");
  const [[blogCount]] = await pool.query("SELECT COUNT(*) AS total FROM blogs");

  console.log("Seed completed:");
  console.log(`- movies: ${movieCount.total}`);
  console.log(`- theaters: ${theaterCount.total}`);
  console.log(`- showtimes: ${showtimeCount.total}`);
  console.log(`- combos: ${comboCount.total}`);
  console.log(`- blogs: ${blogCount.total}`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exit(1);
  });
