from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from app.core.config import settings
from app.api import documents, templates, jobs, api_keys, webhooks, external

app = FastAPI(
    title="Document Processing API",
    description="Intelligent document processing with Google Gemini API",
    version="1.0.0"
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    # Support both JWT (Bearer) and API Key in Swagger
    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT", "description": "JWT from login (Supabase session)"},
        "ApiKey": {"type": "apiKey", "in": "header", "name": "X-Api-Key", "description": "API key (alternative to Bearer)"},
    }
    # Routes that accept EITHER Bearer OR X-Api-Key
    either_auth_paths = ("/api/v1/documents", "/api/v1/templates", "/api/v1/jobs")
    for path, path_item in (openapi_schema.get("paths") or {}).items():
        if not path.startswith(either_auth_paths):
            continue
        for method in ("get", "post", "put", "patch", "delete"):
            op = path_item.get(method)
            if not op:
                continue
            op["security"] = [{"Bearer": []}, {"ApiKey": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix=f"{settings.API_V1_PREFIX}/documents", tags=["documents"])
app.include_router(templates.router, prefix=f"{settings.API_V1_PREFIX}/templates", tags=["templates"])
app.include_router(jobs.router, prefix=f"{settings.API_V1_PREFIX}/jobs", tags=["jobs"])
app.include_router(api_keys.router, prefix=f"{settings.API_V1_PREFIX}/keys", tags=["api-keys"])
app.include_router(webhooks.router, prefix=f"{settings.API_V1_PREFIX}/webhooks", tags=["webhooks"])
app.include_router(external.router, prefix=settings.EXTERNAL_API_PREFIX, tags=["external"])


@app.get("/")
async def root():
    return {
        "name": "Document Processing API",
        "version": "1.0.0",
        "status": "active"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
