from app.core.supabase import get_supabase_admin_client
from app.core.config import settings
from fastapi import UploadFile, HTTPException
from typing import Optional, Tuple
import uuid
import os
from io import BytesIO
from PIL import Image
from PyPDF2 import PdfReader


class StorageService:
    def __init__(self):
        self.supabase = get_supabase_admin_client()
        self.bucket_name = settings.STORAGE_BUCKET_NAME

    async def ensure_bucket_exists(self):
        try:
            buckets = self.supabase.storage.list_buckets()
            bucket_exists = any(b.name == self.bucket_name for b in buckets)

            if not bucket_exists:
                self.supabase.storage.create_bucket(
                    self.bucket_name,
                    options={"public": False}
                )
        except Exception as e:
            print(f"Bucket check/creation warning: {str(e)}")

    async def upload_file(
        self,
        file: UploadFile,
        user_id: str,
        organization_id: str
    ) -> Tuple[str, Optional[str]]:
        if file.size and file.size > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE} bytes"
            )

        if file.content_type not in settings.allowed_file_types_list:
            raise HTTPException(
                status_code=415,
                detail=f"File type {file.content_type} not allowed"
            )

        file_ext = os.path.splitext(file.filename)[1]
        file_id = str(uuid.uuid4())
        storage_path = f"{organization_id}/{user_id}/{file_id}{file_ext}"

        try:
            file_content = await file.read()

            self.supabase.storage.from_(self.bucket_name).upload(
                storage_path,
                file_content,
                file_options={"content-type": file.content_type}
            )

            thumbnail_url = None
            if file.content_type.startswith("image/"):
                thumbnail_url = await self._generate_thumbnail(
                    file_content,
                    file.content_type,
                    storage_path
                )
            elif file.content_type == "application/pdf":
                thumbnail_url = await self._generate_pdf_thumbnail(
                    file_content,
                    storage_path
                )

            return storage_path, thumbnail_url

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"File upload failed: {str(e)}"
            )

    async def _generate_thumbnail(
        self,
        file_content: bytes,
        content_type: str,
        original_path: str
    ) -> Optional[str]:
        try:
            image = Image.open(BytesIO(file_content))

            image.thumbnail((300, 300), Image.Resampling.LANCZOS)

            thumbnail_buffer = BytesIO()
            image_format = "PNG" if content_type == "image/png" else "JPEG"
            image.save(thumbnail_buffer, format=image_format)
            thumbnail_buffer.seek(0)

            thumbnail_path = original_path.replace(
                os.path.splitext(original_path)[1],
                "_thumb.jpg"
            )

            self.supabase.storage.from_(self.bucket_name).upload(
                thumbnail_path,
                thumbnail_buffer.getvalue(),
                file_options={"content-type": "image/jpeg"}
            )

            return self.get_public_url(thumbnail_path)

        except Exception as e:
            print(f"Thumbnail generation failed: {str(e)}")
            return None

    async def _generate_pdf_thumbnail(
        self,
        file_content: bytes,
        original_path: str
    ) -> Optional[str]:
        try:
            import fitz

            pdf_document = fitz.open(stream=file_content, filetype="pdf")

            if pdf_document.page_count == 0:
                return None

            first_page = pdf_document[0]
            pix = first_page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72))

            img_data = pix.tobytes("png")
            image = Image.open(BytesIO(img_data))

            image.thumbnail((300, 300), Image.Resampling.LANCZOS)

            thumbnail_buffer = BytesIO()
            image.save(thumbnail_buffer, format="JPEG")
            thumbnail_buffer.seek(0)

            thumbnail_path = original_path.replace(".pdf", "_thumb.jpg")

            self.supabase.storage.from_(self.bucket_name).upload(
                thumbnail_path,
                thumbnail_buffer.getvalue(),
                file_options={"content-type": "image/jpeg"}
            )

            return self.get_public_url(thumbnail_path)

        except ImportError:
            print("PyMuPDF not installed, skipping PDF thumbnail generation")
            return None
        except Exception as e:
            print(f"PDF thumbnail generation failed: {str(e)}")
            return None

    def get_public_url(self, storage_path: str) -> str:
        return self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)

    async def get_file_url(self, storage_path: str, expires_in: int = 3600) -> str:
        try:
            signed_url = self.supabase.storage.from_(self.bucket_name).create_signed_url(
                storage_path,
                expires_in
            )
            return signed_url["signedURL"]
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate file URL: {str(e)}"
            )

    async def delete_file(self, storage_path: str) -> bool:
        try:
            self.supabase.storage.from_(self.bucket_name).remove([storage_path])

            thumbnail_path = storage_path.replace(
                os.path.splitext(storage_path)[1],
                "_thumb.jpg"
            )
            try:
                self.supabase.storage.from_(self.bucket_name).remove([thumbnail_path])
            except:
                pass

            return True
        except Exception as e:
            print(f"File deletion failed: {str(e)}")
            return False

    async def extract_metadata(self, file: UploadFile, file_content: bytes) -> dict:
        metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(file_content)
        }

        try:
            if file.content_type == "application/pdf":
                pdf_reader = PdfReader(BytesIO(file_content))
                metadata["page_count"] = len(pdf_reader.pages)
                if pdf_reader.metadata:
                    metadata["title"] = pdf_reader.metadata.get("/Title", "")
                    metadata["author"] = pdf_reader.metadata.get("/Author", "")

            elif file.content_type.startswith("image/"):
                image = Image.open(BytesIO(file_content))
                metadata["dimensions"] = {
                    "width": image.width,
                    "height": image.height
                }
                metadata["format"] = image.format

        except Exception as e:
            print(f"Metadata extraction failed: {str(e)}")

        return metadata


storage_service = StorageService()
