import io
import os
import uuid
import zipfile
from pathlib import Path
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
DANGEROUS_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".vbs", ".sh", ".php", ".phtml", ".php5",
    ".py", ".pl", ".rb", ".js", ".html", ".htm", ".xhtml", ".svg",
    ".jar", ".scr", ".msi", ".dll", ".so", ".dylib", ".bin"
}


def validate_and_save_resume(uploaded_file: UploadedFile) -> str:
    """
    Validates uploaded resume file strictly against XSS, malware, and format forgery.
    Allowed extensions: .pdf, .docx
    Returns relative path under MEDIA_ROOT (e.g., 'resumes/<uuid>.<ext>').
    """
    if not uploaded_file:
        raise ValueError("فایل رزومه ارسال نشده است.")

    orig_name = uploaded_file.name or ""
    orig_name_lower = orig_name.lower().strip()
    ext = os.path.splitext(orig_name_lower)[1]

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("فقط ارسال فایل‌های رزومه با پسوند PDF و DOCX مجاز است.")

    # Prevent double-extension tricks e.g. "shell.php.pdf" or "exploit.exe.docx"
    name_parts = orig_name_lower.split(".")
    if len(name_parts) > 2:
        for part in name_parts[1:-1]:
            if f".{part}" in DANGEROUS_EXTENSIONS:
                raise ValueError("نام فایل ارسالی حاوی پسوند غیرمجاز است.")

    # Size validation
    size = uploaded_file.size
    if size < 64:
        raise ValueError("فایل ارسالی خالی یا ناقص است.")
    if size > MAX_FILE_SIZE:
        raise ValueError("حجم فایل رزومه حداکثر ۱۰ مگابایت است.")

    content = uploaded_file.read()
    uploaded_file.seek(0)

    # Executable header detection
    if content.startswith(b"MZ") or content.startswith(b"\x7fELF"):
        raise ValueError("فایل‌های اجرایی غیرمجاز هستند.")

    lower_content = content.lower()

    # Reject common Web shells, scripts or HTML injection
    dangerous_signatures = [b"<script", b"javascript:", b"<?php", b"<% ", b"<html", b"<svg"]
    for sig in dangerous_signatures:
        if sig in lower_content:
            raise ValueError("فایل ارسالی حاوی تگ‌های اسکریپت یا کدهای اجرایی غیرمجاز است.")

    if ext == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise ValueError("محتوای فایل با ساختار استاندارد PDF مطابقت ندارد.")
        # Check for PDF-embedded JavaScript actions
        if b"/javascript" in lower_content or b"/js " in lower_content:
            raise ValueError("فایل PDF حاوی اسکریپت‌های تعبیه‌شدهٔ غیرمجاز است.")

    elif ext == ".docx":
        if not content.startswith(b"PK\x03\x04"):
            raise ValueError("محتوای فایل با ساختار استاندارد DOCX مطابقت ندارد.")
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                namelist = zf.namelist()
                has_doc = any("word/" in n for n in namelist) or ("[Content_Types].xml" in namelist)
                if not has_doc:
                    raise ValueError("ساختار سند Word نامعتبر است.")
                for entry in namelist:
                    entry_lower = entry.lower()
                    if any(entry_lower.endswith(bad_ext) for bad_ext in DANGEROUS_EXTENSIONS):
                        raise ValueError("فایل فشردهٔ DOCX حاوی فایل‌های اجرایی غیرمجاز است.")
        except zipfile.BadZipFile:
            raise ValueError("فایل DOCX آسیب‌دیده یا نامعتبر است.")

    # Save to media/resumes with secure UUID
    safe_name = f"{uuid.uuid4().hex}{ext}"
    rel_path = f"resumes/{safe_name}"
    full_path = Path(settings.MEDIA_ROOT) / "resumes" / safe_name
    full_path.parent.mkdir(parents=True, exist_ok=True)

    with open(full_path, "wb") as f:
        f.write(content)

    return rel_path
