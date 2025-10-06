from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"


class Language(str, Enum):
    EN = "en"
    VI = "vi"


class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OutputFormat(str, Enum):
    TEXT = "text"
    JSON = "json"
    EXCEL = "excel"


class OrganizationCreate(BaseModel):
    name: str
    slug: str


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    settings: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class UserProfileCreate(BaseModel):
    display_name: str
    organization_id: str
    role: UserRole = UserRole.USER
    language: Language = Language.EN


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    language: Optional[Language] = None
    settings: Optional[Dict[str, Any]] = None


class UserProfileResponse(BaseModel):
    id: str
    organization_id: str
    role: UserRole
    display_name: str
    avatar_url: Optional[str] = None
    language: Language
    settings: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    storage_path: str
    thumbnail_url: Optional[str] = None
    status: DocumentStatus
    created_at: datetime


class DocumentResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    filename: str
    file_type: str
    file_size: int
    storage_path: str
    thumbnail_url: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    status: DocumentStatus
    created_at: datetime
    updated_at: datetime


class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    output_format: OutputFormat
    schema: Dict[str, Any]
    is_public: bool = False


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schema: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    name: str
    description: str
    output_format: OutputFormat
    schema: Dict[str, Any]
    is_public: bool
    created_at: datetime
    updated_at: datetime


class ProcessingJobCreate(BaseModel):
    document_id: str
    template_id: Optional[str] = None
    custom_instructions: str = ""
    priority: int = 0


class ProcessingJobResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    document_id: str
    template_id: Optional[str] = None
    status: JobStatus
    priority: int
    custom_instructions: str
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ProcessingResultResponse(BaseModel):
    id: str
    job_id: str
    output_format: OutputFormat
    output_data: Optional[Dict[str, Any]] = None
    output_text: Optional[str] = None
    output_file_url: Optional[str] = None
    tokens_used: int
    processing_time: int
    created_at: datetime


class APIKeyCreate(BaseModel):
    name: str
    scopes: List[str] = Field(default_factory=list)
    rate_limit: int = 60
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: List[str]
    rate_limit: int
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime


class APIKeyCreateResponse(BaseModel):
    id: str
    name: str
    api_key: str
    key_prefix: str
    scopes: List[str]
    rate_limit: int
    expires_at: Optional[datetime] = None
    created_at: datetime


class WebhookCreate(BaseModel):
    url: str
    events: List[str]


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None


class WebhookResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    url: str
    events: List[str]
    secret: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class WebhookDeliveryResponse(BaseModel):
    id: str
    webhook_id: str
    job_id: Optional[str] = None
    event_type: str
    payload: Dict[str, Any]
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    attempt_count: int
    delivered_at: Optional[datetime] = None
    created_at: datetime


class ExternalProcessRequest(BaseModel):
    template_id: Optional[str] = None
    output_format: OutputFormat = OutputFormat.JSON
    custom_schema: Optional[Dict[str, Any]] = None
    custom_instructions: str = ""
    webhook_url: Optional[str] = None


class ExternalProcessResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str
    estimated_completion: Optional[int] = None


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
