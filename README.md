# webxemphim

JavaScript starter project (Node.js).

## Setup database (XAMPP)

1. Copy `.env.example` to `.env`.
2. Update DB values in `.env`.
3. Start MySQL in XAMPP Control Panel.
4. Create database with the same name as `DB_NAME` (default: `webxemphim`).

## Chuc nang da co

- Dang ky / Dang nhap (JWT)
- Trang chi tiet phim va dat ve
- Chon rap, chon suat chieu, chon ghe
- Chon combo bap nuoc
- Thanh toan mo phong (confirm payment)
- Trang admin quan ly phim, rap, suat chieu, combo, don dat

## Run

```bash
npm start
```

## Dev mode (auto reload)

```bash
npm run dev
```

## Cấu trúc thư mục

```text
webxemphim/
	public/        # Toàn bộ giao diện HTML/CSS/JS phía client
	src/           # API server + database init/seed
	.env.example
	package.json
```

## Test database connection

Run the app, then open:

http://localhost:3000/api/db-test

## Cac trang giao dien

- Home: http://localhost:3000/
- Dang nhap / Dang ky: http://localhost:3000/login.html
- Dat ve phim: http://localhost:3000/movie.html
- Admin: http://localhost:3000/admin.html

## Tai khoan admin mac dinh

- Email: admin@cinema.vn
- Password: admin123

Co the doi trong file `.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

## CRUD API

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Movies

- `GET /api/movies`
- `GET /api/movies/:id`

### Theaters, showtimes, seats, combos

- `GET /api/theaters`
- `GET /api/showtimes?movieId=&theaterId=`
- `GET /api/showtimes/:id/seats`
- `GET /api/combos`

### Checkout + payment

- `POST /api/checkout`
- `POST /api/payments/:id/confirm`
- `GET /api/orders/me`

### Admin APIs

- `GET /api/admin/overview`
- `GET /api/admin/orders`
- `POST /api/admin/movies`
- `PUT /api/admin/movies/:id`
- `DELETE /api/admin/movies/:id`
- `POST /api/admin/theaters`
- `DELETE /api/admin/theaters/:id`
- `POST /api/admin/showtimes`
- `DELETE /api/admin/showtimes/:id`
- `POST /api/admin/combos`
- `PUT /api/admin/combos/:id`
- `DELETE /api/admin/combos/:id`

Example body:

```json
{
	"title": "Avengers: Secret Wars",
	"genre": "Action",
	"durationMinutes": 145,
	"releaseDate": "2026-05-01",
	"status": "coming_soon",
	"posterUrl": "https://example.com/poster.jpg"
}
```
