from pydantic import BaseModel, ConfigDict, Field, EmailStr
from typing import Optional, List, Dict, Any, Union
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
    updated_at: Optional[datetime] = None


class TemplateCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    description: str = ""
    output_format: OutputFormat
    template_schema: Dict[str, Any] = Field(alias="schema")
    is_public: bool = False


class TemplateUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: Optional[str] = None
    description: Optional[str] = None
    template_schema: Optional[Dict[str, Any]] = Field(default=None, alias="schema")
    is_public: Optional[bool] = None


class TemplateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    user_id: str
    organization_id: str
    name: str
    description: str
    output_format: OutputFormat
    template_schema: Dict[str, Any] = Field(alias="schema")
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
    priority: Optional[int] = 0  # optional: table may not have column
    custom_instructions: Optional[str] = ""
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None  # optional: table may not have column


class ProcessingResultResponse(BaseModel):
    id: str
    job_id: str
    output_format: OutputFormat  # DB may return as "format"
    output_data: Optional[Union[Dict[str, Any], List[Any]]] = None  # JSON object or array
    output_text: Optional[str] = None
    output_file_url: Optional[str] = None
    tokens_used: int = 0  # optional in DB
    processing_time: int = 0  # optional in DB
    created_at: datetime

    @classmethod
    def model_validate(cls, obj: Any, **kwargs):
        if isinstance(obj, dict):
            obj = dict(obj)
            obj.setdefault("output_format", obj.get("format"))
            obj.setdefault("tokens_used", 0)
            obj.setdefault("processing_time", 0)
        return super().model_validate(obj, **kwargs)


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
    template_id: Optional[str] = None


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None
    template_id: Optional[str] = None


class WebhookResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    url: str
    events: List[str]
    secret: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    template_id: Optional[str] = None


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
