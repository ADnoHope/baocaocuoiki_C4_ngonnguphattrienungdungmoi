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
  { title: "Tom & Jerry Forever", description: "Hoạt hình vui nhộn cho gia đình.", genre: "Animation", director: "Anthony Lee", castInfo: "Tom, Jerry", language: "Lồng tiếng Việt", rated: "P", duration: 98, releaseDate: "2026-03-18", status: "now_showing", formats: ["2D", "3D"] },
  { title: "The Housemaid Returns", description: "Tâm lý kinh dị với tình tiết bất ngờ.", genre: "Thriller", director: "Lê Thanh Sơn", castInfo: "Lan Ngọc, Quốc Trường", language: "Tiếng Việt", rated: "T16", duration: 110, releaseDate: "2026-04-05", status: "now_showing", formats: ["2D", "SVIP"] },
  { title: "Grand Prix Legends", description: "Đua xe tốc độ cao và kịch tính.", genre: "Sport", director: "Martin Shaw", castInfo: "Chris Miles, Daniel Park", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 105, releaseDate: "2026-03-22", status: "now_showing", formats: ["2D", "4D"] },
  { title: "Dino Family 2", description: "Hoạt hình gia đình đáng yêu.", genre: "Animation", director: "Henry Woods", castInfo: "Dino Kids Cast", language: "Lồng tiếng Việt", rated: "P", duration: 96, releaseDate: "2026-03-30", status: "now_showing", formats: ["2D"] },
  { title: "Boong Bắp Siêu Hời", description: "Hài hước học đường nhẹ nhàng.", genre: "Comedy", director: "Nguyễn Quang Dũng", castInfo: "Thu Trang, Tiến Luật", language: "Tiếng Việt", rated: "K", duration: 102, releaseDate: "2026-04-01", status: "now_showing", formats: ["2D", "SVIP"] },
  { title: "The Last Emperor", description: "Lịch sử Trung Hoa đầy bi kịch.", genre: "Drama", director: "Bernardo Bertolucci", castInfo: "John Lone, Joan Chen", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 163, releaseDate: "2026-03-15", status: "now_showing", formats: ["2D", "IMAX"] },
  { title: "Jurassic World Dominion", description: "Khủng long quay trở lại.", genre: "Action", director: "Colin Trevorrow", castInfo: "Chris Pratt, Bryce Dallas Howard", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 147, releaseDate: "2026-03-20", status: "now_showing", formats: ["3D", "IMAX"] },
  { title: "Spider-Man: No Way Home", description: "Người nhện đa vũ trụ.", genre: "Action", director: "Jon Watts", castInfo: "Tom Holland, Zendaya", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 148, releaseDate: "2026-03-25", status: "now_showing", formats: ["2D", "3D", "IMAX"] },
  { title: "The Batman", description: "Siêu anh hùng bóng đêm.", genre: "Action", director: "Matt Reeves", castInfo: "Robert Pattinson, Zoë Kravitz", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T18", duration: 176, releaseDate: "2026-03-28", status: "now_showing", formats: ["2D", "IMAX"] },
  { title: "Doctor Strange in the Multiverse of Madness", description: "Phù thủy tối thượng.", genre: "Fantasy", director: "Sam Raimi", castInfo: "Benedict Cumberbatch, Elizabeth Olsen", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 126, releaseDate: "2026-04-02", status: "now_showing", formats: ["2D", "3D"] },
  { title: "Top Gun: Maverick", description: "Phi công siêu đẳng.", genre: "Action", director: "Joseph Kosinski", castInfo: "Tom Cruise, Miles Teller", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 130, releaseDate: "2026-04-03", status: "now_showing", formats: ["2D", "IMAX"] },
  { title: "Black Panther: Wakanda Forever", description: "Vương quốc Wakanda.", genre: "Action", director: "Ryan Coogler", castInfo: "Letitia Wright, Lupita Nyong'o", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 161, releaseDate: "2026-04-04", status: "now_showing", formats: ["2D", "3D", "IMAX"] },
  { title: "Avatar: The Way of Water", description: "Hành tinh Pandora.", genre: "Sci-Fi", director: "James Cameron", castInfo: "Sam Worthington, Zoe Saldana", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 192, releaseDate: "2026-04-05", status: "now_showing", formats: ["3D", "IMAX"] },
  { title: "Oppenheimer", description: "Bom nguyên tử.", genre: "Drama", director: "Christopher Nolan", castInfo: "Cillian Murphy, Emily Blunt", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T18", duration: 180, releaseDate: "2026-04-06", status: "now_showing", formats: ["2D", "IMAX"] },
  { title: "Barbie", description: "Búp bê Barbie.", genre: "Comedy", director: "Greta Gerwig", castInfo: "Margot Robbie, Ryan Gosling", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 114, releaseDate: "2026-04-07", status: "now_showing", formats: ["2D", "3D"] },
  { title: "Dune: Part Two", description: "Sa mạc Arrakis.", genre: "Sci-Fi", director: "Denis Villeneuve", castInfo: "Timothée Chalamet, Zendaya", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 166, releaseDate: "2026-04-08", status: "now_showing", formats: ["2D", "3D", "IMAX"] },
  { title: "Guardians of the Galaxy Vol. 3", description: "Vệ binh dải Ngân hà.", genre: "Action", director: "James Gunn", castInfo: "Chris Pratt, Zoe Saldana", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 150, releaseDate: "2026-04-09", status: "now_showing", formats: ["2D", "3D", "IMAX"] },
  { title: "The Super Mario Bros. Movie", description: "Game Mario.", genre: "Animation", director: "Aaron Horvath", castInfo: "Chris Pratt, Anya Taylor-Joy", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "P", duration: 92, releaseDate: "2026-04-10", status: "now_showing", formats: ["2D", "3D"] },
  { title: "John Wick: Chapter 4", description: "Sát thủ huyền thoại.", genre: "Action", director: "Chad Stahelski", castInfo: "Keanu Reeves, Laurence Fishburne", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T18", duration: 169, releaseDate: "2026-04-11", status: "now_showing", formats: ["2D", "IMAX"] },
  { title: "Guardians of the Galaxy Vol. 4", description: "Hành trình mới của nhóm vệ binh.", genre: "Action", director: "James Gunn", castInfo: "Chris Pratt, Pom Klementieff", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 145, releaseDate: "2026-04-18", status: "coming_soon", formats: ["2D", "3D", "IMAX"] },
  { title: "Mission: Impossible – Dead Reckoning Part Two", description: "Ethan Hunt đối đầu thử thách mới.", genre: "Action", director: "Christopher McQuarrie", castInfo: "Tom Cruise, Hayley Atwell", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 150, releaseDate: "2026-04-16", status: "coming_soon", formats: ["2D", "IMAX"] },
  { title: "Wonka", description: "Chuyến phiêu lưu kỳ ảo của chú Willy Wonka.", genre: "Fantasy", director: "Paul King", castInfo: "Timothée Chalamet, Olivia Colman", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "P", duration: 115, releaseDate: "2026-04-17", status: "coming_soon", formats: ["2D"] },
  { title: "Fast X", description: "Tốc độ và gia đình trên đường đua.", genre: "Action", director: "Louis Leterrier", castInfo: "Vin Diesel, Michelle Rodriguez", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T16", duration: 140, releaseDate: "2026-04-20", status: "coming_soon", formats: ["2D", "4D"] },
  { title: "The Marvels", description: "Ba siêu anh hùng hợp lực bảo vệ vũ trụ.", genre: "Action", director: "Nia DaCosta", castInfo: "Brie Larson, Iman Vellani", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 135, releaseDate: "2026-04-22", status: "coming_soon", formats: ["2D", "3D"] },
  { title: "Spider-Verse 2", description: "Lần đầu tiên các Spider-Person gặp nhau.", genre: "Animation", director: "Joaquim Dos Santos", castInfo: "Shameik Moore, Hailee Steinfeld", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "P", duration: 120, releaseDate: "2026-04-24", status: "coming_soon", formats: ["2D", "3D"] },
  { title: "Transformers: Rise of the Beasts", description: "Cuộc chiến máy móc mới khởi động.", genre: "Sci-Fi", director: "Steven Caple Jr.", castInfo: "Anthony Ramos, Dominique Fishback", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 130, releaseDate: "2026-04-25", status: "coming_soon", formats: ["2D", "IMAX"] },
  { title: "Indiana Jones and the Dial of Destiny", description: "Hành trình cuối cùng của Indiana Jones.", genre: "Adventure", director: "James Mangold", castInfo: "Harrison Ford, Phoebe Waller-Bridge", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T13", duration: 125, releaseDate: "2026-04-28", status: "coming_soon", formats: ["2D", "IMAX"] },
  { title: "Napoleon", description: "Bi kịch và tham vọng của vị hoàng đế vĩ đại.", genre: "Historical", director: "Ridley Scott", castInfo: "Joaquin Phoenix, Vanessa Kirby", language: "Tiếng Anh - Phụ đề Tiếng Việt", rated: "T16", duration: 155, releaseDate: "2026-04-30", status: "coming_soon", formats: ["2D", "IMAX"] },
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

  // Generate showtimes for all now_showing movies in all theaters from 2026-04-06 to 2026-04-10
  const times = ["10:00:00", "12:30:00", "15:00:00", "17:30:00", "20:00:00"];
  const prices = { "2D": 85000, "3D": 95000, "IMAX": 120000, "4D": 110000, "SVIP": 150000 };

  for (let day = 6; day <= 10; day++) {
    const date = `2026-04-${day.toString().padStart(2, '0')}`;
    for (let movieIndex = 0; movieIndex < movieIds.length; movieIndex++) {
      const movie = movies[movieIndex];
      if (movie.status !== "now_showing") continue;
      for (let theaterIndex = 0; theaterIndex < theaterIds.length; theaterIndex++) {
        for (const time of times) {
          const format = movie.formats[Math.floor(Math.random() * movie.formats.length)] || "2D";
          const price = prices[format] || 85000;
          const totalSeats = format === "SVIP" ? 50 : format === "IMAX" ? 80 : 60;
          await pool.query(
            "INSERT INTO showtimes (movie_id, theater_id, format_id, start_time, price, total_seats) VALUES (?, ?, ?, ?, ?, ?)",
            [
              movieIds[movieIndex],
              theaterIds[theaterIndex],
              formatIdsByName[format] || formatIdsByName["2D"],
              `${date} ${time}`,
              price,
              totalSeats,
            ]
          );
        }
      }
    }
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
