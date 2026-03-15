# Hướng dẫn chạy Document AI Processing System

## 1. Kết quả đọc project (tóm tắt)

- **Tên dự án:** Document AI Processing System  
- **Mục đích:** Nền tảng xử lý tài liệu thông minh: upload tài liệu, tạo template đầu ra (text/JSON/Excel), dùng **Google Gemini** để trích xuất dữ liệu có cấu trúc.
- **Stack:**  
  - Frontend: React 18 + TypeScript + Vite + Tailwind (thư mục gốc `src/`)  
  - Backend: Python FastAPI (thư mục `backend/`)  
  - DB & Auth: Supabase (PostgreSQL + Auth)  
  - Xử lý nền: Celery + Redis  
  - AI: Google Gemini 1.5 Flash  

- **Trang đã có:** Login, Dashboard, Documents, Templates, Processing, API Keys, Webhooks, Settings.

---

## 2. Yêu cầu trước khi chạy

Cài sẵn trên máy:

- **Node.js 18+** và npm  
- **Python 3.10+**  
- **Redis** (cho Celery)  
- **Tài khoản Supabase** (URL + anon key + service role key)  
- **Google Gemini API key**  

---

## 3. Chạy từng bước (Windows)

### Bước 1: Clone / mở project

```bash
cd E:\DuAn\document-understands
```

### Bước 2: Cấu hình Backend

```bash
cd backend
```

- Tạo virtual environment:

```bash
python -m venv venv
venv\Scripts\activate
```

- Cài dependency:

```bash
pip install -r requirements.txt
```

- Tạo file `.env` (copy từ `.env.example` và sửa):

```bash
copy .env.example .env
```

Mở `.env` và điền:

- `SUPABASE_URL` = URL dự án Supabase  
- `SUPABASE_KEY` = Supabase anon key  
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key  
- `GEMINI_API_KEY` = API key Google Gemini  
- `REDIS_URL` = `redis://localhost:6379/0` (nếu Redis chạy local)  
- `SECRET_KEY` = chuỗi bí mật bất kỳ (dùng cho JWT)  

### Bước 3: Chạy Redis

- Cài Redis trên Windows (hoặc dùng WSL/Docker). Ví dụ với Docker:

```bash
docker run -d -p 6379:6379 redis:alpine
```

- Hoặc nếu đã cài Redis: mở terminal khác và chạy `redis-server`.

### Bước 4: Chạy Backend (2 terminal)

**Terminal 1 – API:**

```bash
cd E:\DuAn\document-understands\backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 – Celery worker:**

```bash
cd E:\DuAn\document-understands\backend
venv\Scripts\activate
celery -A app.services.processing.celery_app worker --loglevel=info -P solo
```

(Lưu ý: trên Windows thường cần `-P solo` cho Celery.)

### Bước 5: Cấu hình Frontend

Quay lại thư mục gốc project:

```bash
cd E:\DuAn\document-understands
```

- Cài dependency:

```bash
npm install
```

- Tạo file `.env.local` với nội dung:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:8000
```

Thay `your_supabase_url` và `your_supabase_anon_key` bằng giá trị thật từ Supabase.

### Bước 6: Chạy Frontend

```bash
npm run dev
```

Mở trình duyệt: **http://localhost:5173**

---

## 4. Thứ tự chạy (tóm tắt)

1. Redis đang chạy (port 6379).  
2. Backend: `cd backend` → `venv\Scripts\activate` → `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.  
3. Celery: cùng thư mục `backend`, `venv` active → `celery -A app.services.processing.celery_app worker --loglevel=info -P solo`.  
4. Frontend: ở thư mục gốc → `npm run dev` → truy cập http://localhost:5173.

---

## 5. Database (Supabase)

- Schema đã có trong `supabase/migrations/`.  
- Cần apply migration trong Supabase (hoặc chạy SQL trong SQL Editor) để có đủ bảng: `organizations`, `user_profiles`, `documents`, `output_templates`, `processing_jobs`, `processing_results`, v.v.  
- Sau khi có bảng, đăng ký user mới qua giao diện Login; có thể cần tạo/binding `organization` và `user_profiles` tùy migration.

---

## 6. Kiểm tra nhanh

- Backend: http://localhost:8000 → có JSON `{"name":"Document Processing API",...}`.  
- Backend docs: http://localhost:8000/docs.  
- Frontend: http://localhost:5173 → trang Login / Dashboard.

Nếu có lỗi, kiểm tra: Redis đang chạy, `.env` backend đủ biến, `.env.local` frontend đúng URL và key Supabase.
