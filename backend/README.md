# Document Processing API - Backend

Python FastAPI backend for intelligent document processing with Google Gemini API.

## Features

- **Document Upload & Storage**: Supabase Storage integration with automatic thumbnail generation
- **Google Gemini Integration**: Advanced document understanding and extraction
- **Async Processing**: Celery-based background task processing
- **Multiple Output Formats**: Text, JSON, Excel output support
- **Template System**: Dynamic output format definition
- **Webhook Support**: Async callbacks for processing completion
- **API Key Management**: Secure external API access
- **Multi-tenant**: Organization-based data isolation
- **Role-based Access Control**: Admin, User, Viewer roles

## Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- Supabase URL and keys
- Google Gemini API key
- Redis URL (for Celery)
- Secret key for JWT

### 3. Start Redis (for Celery)

```bash
redis-server
```

### 4. Start Celery Worker

```bash
celery -A app.services.processing.celery_app worker --loglevel=info
```

On **Windows**, the app automatically uses the `solo` pool to avoid multiprocessing errors. To override: `celery -A app.services.processing.celery_app worker --loglevel=info --pool=solo`

### 5. Run API Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Authentication Required

#### Documents
- `POST /api/v1/documents/upload` - Upload document
- `GET /api/v1/documents` - List documents
- `GET /api/v1/documents/{id}` - Get document details
- `DELETE /api/v1/documents/{id}` - Delete document

#### Templates
- `POST /api/v1/templates` - Create template
- `GET /api/v1/templates` - List templates
- `GET /api/v1/templates/{id}` - Get template
- `PUT /api/v1/templates/{id}` - Update template
- `DELETE /api/v1/templates/{id}` - Delete template

#### Jobs
- `POST /api/v1/jobs` - Create processing job
- `GET /api/v1/jobs` - List jobs
- `GET /api/v1/jobs/{id}` - Get job status
- `GET /api/v1/jobs/{id}/result` - Get job result
- `POST /api/v1/jobs/{id}/cancel` - Cancel job

#### API Keys (Admin only)
- `POST /api/v1/keys` - Generate API key
- `GET /api/v1/keys` - List API keys
- `DELETE /api/v1/keys/{id}` - Revoke API key

#### Webhooks
- `POST /api/v1/webhooks` - Create webhook
- `GET /api/v1/webhooks` - List webhooks
- `GET /api/v1/webhooks/{id}` - Get webhook
- `PUT /api/v1/webhooks/{id}` - Update webhook
- `DELETE /api/v1/webhooks/{id}` - Delete webhook
- `GET /api/v1/webhooks/{id}/deliveries` - List webhook deliveries

### External API (API Key Authentication)

#### Processing
- `POST /external/v1/process` - Submit document for processing
- `GET /external/v1/jobs/{id}` - Check job status
- `GET /external/v1/jobs/{id}/result` - Get processing result

## Architecture

```
backend/
├── app/
│   ├── api/           # API route handlers
│   ├── core/          # Config, auth, database
│   ├── models/        # Pydantic schemas
│   ├── services/      # Business logic
│   └── utils/         # Utilities
├── requirements.txt   # Python dependencies
└── .env              # Environment variables
```

## Development

Run tests:
```bash
pytest
```

Format code:
```bash
black app/
```

Lint:
```bash
flake8 app/
```
