# Document AI Processing System

A comprehensive intelligent document processing platform powered by Google Gemini API. This system enables users to upload documents, define custom output templates, and extract structured data with advanced AI understanding.

## Features

### Core Features
- **Multi-format Document Support**: PDF, Word, Excel, PowerPoint, Images
- **AI-Powered Extraction**: Google Gemini 1.5 Flash for document understanding
- **Dynamic Output Templates**: Visual template builder for custom data structures
- **Multiple Output Formats**: Text, JSON, Excel with customizable schemas
- **Async Processing**: Background task processing with Celery and Redis
- **Webhook Integration**: Real-time callbacks for processing completion
- **API Key Management**: Secure external API access with rate limiting
- **Multi-language Support**: English and Vietnamese interface
- **Multi-tenant Architecture**: Organization-based data isolation
- **Role-based Access Control**: Admin, User, and Viewer roles

### Technical Highlights
- **Backend**: Python FastAPI with async/await patterns
- **Frontend**: React 18 with TypeScript and Tailwind CSS
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Storage**: Supabase Storage with automatic thumbnail generation
- **Authentication**: Supabase Auth with JWT tokens
- **State Management**: React Query for server state
- **Internationalization**: i18next for multi-language support

## Architecture

```
project/
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── api/          # API route handlers
│   │   ├── core/         # Config, auth, database
│   │   ├── models/       # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utilities
│   └── requirements.txt
│
└── frontend/             # React + TypeScript frontend
    ├── src/
    │   ├── components/   # Reusable UI components
    │   ├── pages/        # Page components
    │   ├── services/     # API services
    │   ├── contexts/     # React contexts
    │   ├── hooks/        # Custom hooks
    │   ├── i18n/         # Translations
    │   └── types/        # TypeScript types
    └── package.json
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Redis server
- Supabase account
- Google Gemini API key

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
   - `GEMINI_API_KEY`: Google Gemini API key
   - `REDIS_URL`: Redis connection URL
   - `SECRET_KEY`: JWT secret key

5. **Start Redis**
   ```bash
   redis-server
   ```

6. **Start Celery worker**
   ```bash
   celery -A app.services.processing.celery_app worker --loglevel=info
   ```

7. **Run API server**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**

   Create `.env.local` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

### Database Setup

The database schema is already created via the Supabase migration. It includes:

- `organizations`: Multi-tenant organization management
- `user_profiles`: User profiles with roles and preferences
- `documents`: Document storage metadata
- `output_templates`: Custom output format definitions
- `processing_jobs`: Background job tracking
- `processing_results`: Processed output storage
- `api_keys`: External API key management
- `webhooks`: Webhook configuration
- `webhook_deliveries`: Webhook delivery logs
- `audit_logs`: Security audit trail

All tables have Row Level Security (RLS) enabled for secure multi-tenant data access.

## Usage

### Web Application

1. **Register/Login**: Create an account or sign in
2. **Upload Documents**: Drag and drop documents to upload
3. **Create Templates**: Define custom output schemas
4. **Process Documents**: Select document and template to extract data
5. **View Results**: Download results in Text, JSON, or Excel format
6. **Manage API Keys**: Generate keys for external integration
7. **Configure Webhooks**: Set up callbacks for async notifications

### External API Integration

#### Authentication

Include your API key in the request header:
```
X-API-Key: your_api_key_here
```

#### Process Document

```bash
curl -X POST http://localhost:8000/external/v1/process \
  -H "X-API-Key: your_api_key" \
  -F "file=@document.pdf" \
  -F "template_id=your_template_id"
```

#### Check Job Status

```bash
curl http://localhost:8000/external/v1/jobs/{job_id} \
  -H "X-API-Key: your_api_key"
```

#### Get Result

```bash
curl http://localhost:8000/external/v1/jobs/{job_id}/result \
  -H "X-API-Key: your_api_key"
```

### Python Example

```python
import requests

API_KEY = "your_api_key"
API_URL = "http://localhost:8000/external/v1"

headers = {"X-API-Key": API_KEY}

with open("document.pdf", "rb") as f:
    files = {"file": f}
    data = {"template_id": "your_template_id"}

    response = requests.post(
        f"{API_URL}/process",
        headers=headers,
        files=files,
        data=data
    )

    job = response.json()
    job_id = job["job_id"]

status_response = requests.get(
    f"{API_URL}/jobs/{job_id}",
    headers=headers
)

if status_response.json()["status"] == "completed":
    result_response = requests.get(
        f"{API_URL}/jobs/{job_id}/result",
        headers=headers
    )
    print(result_response.json())
```

### JavaScript Example

```javascript
const apiKey = "your_api_key";
const apiUrl = "http://localhost:8000/external/v1";

const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("template_id", "your_template_id");

const response = await fetch(`${apiUrl}/process`, {
  method: "POST",
  headers: {
    "X-API-Key": apiKey,
  },
  body: formData,
});

const job = await response.json();
const jobId = job.job_id;

const checkStatus = async () => {
  const statusResponse = await fetch(`${apiUrl}/jobs/${jobId}`, {
    headers: { "X-API-Key": apiKey },
  });

  const status = await statusResponse.json();

  if (status.status === "completed") {
    const resultResponse = await fetch(`${apiUrl}/jobs/${jobId}/result`, {
      headers: { "X-API-Key": apiKey },
    });

    const result = await resultResponse.json();
    console.log(result);
  }
};
```

## Template Schema Examples

### JSON Template

```json
{
  "fields": [
    {
      "name": "invoice_number",
      "type": "string",
      "description": "Invoice number"
    },
    {
      "name": "date",
      "type": "string",
      "description": "Invoice date"
    },
    {
      "name": "total",
      "type": "number",
      "description": "Total amount"
    },
    {
      "name": "items",
      "type": "array",
      "description": "Line items",
      "items": {
        "type": "object",
        "properties": {
          "description": "string",
          "quantity": "number",
          "price": "number"
        }
      }
    }
  ]
}
```

### Excel Template

```json
{
  "columns": [
    { "name": "Name", "description": "Person name" },
    { "name": "Email", "description": "Email address" },
    { "name": "Phone", "description": "Phone number" },
    { "name": "Address", "description": "Full address" }
  ]
}
```

### Text Template

```json
{
  "template": "Invoice #{invoice_number}\nDate: {date}\nCustomer: {customer_name}\nTotal: ${total}"
}
```

## API Documentation

Full API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Security

- **Authentication**: JWT-based authentication via Supabase Auth
- **Authorization**: Role-based access control (RBAC)
- **Row Level Security**: Database-level access control
- **API Key Management**: Secure key generation with SHA-256 hashing
- **Rate Limiting**: Per-key request throttling
- **Webhook Signatures**: HMAC-SHA256 webhook verification
- **CORS**: Configurable cross-origin resource sharing

## Performance

- **Async Processing**: Non-blocking background tasks
- **Caching**: Redis-based caching for improved performance
- **Queue Management**: Priority-based job processing
- **Connection Pooling**: Efficient database connections
- **CDN-ready**: Static asset optimization

## Monitoring

- **Health Checks**: `/health` endpoint for service monitoring
- **Audit Logs**: Comprehensive activity tracking
- **Error Tracking**: Structured error logging
- **Usage Metrics**: Token usage and processing time tracking

## Development

### Running Tests

Backend:
```bash
cd backend
pytest
```

Frontend:
```bash
npm test
```

### Code Formatting

Backend:
```bash
black app/
```

Frontend:
```bash
npm run lint
```

## Deployment

### Backend Deployment

1. Set up production environment variables
2. Configure Redis instance
3. Deploy FastAPI application (Railway, Render, AWS, etc.)
4. Start Celery workers
5. Configure monitoring and logging

### Frontend Deployment

1. Build production bundle: `npm run build`
2. Deploy to hosting platform (Vercel, Netlify, AWS S3, etc.)
3. Configure environment variables
4. Set up CDN for static assets

## Contributing

This project is designed for production use. For feature requests or bug reports, please open an issue.

## License

Proprietary - All rights reserved

## Support

For support inquiries, please contact your system administrator.
