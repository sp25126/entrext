from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import traceback
import logging
from datetime import datetime, timezone

# ─── Structured Logger ────────────────────────────────────────────────────────
# This produces semi-structured logs that are easy to parse by log aggregators
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger("entrext")

class AppError(Exception):
    """
    Base class for all business logic errors.
    Errors here are intended to be seen by the client.
    """
    def __init__(self, code: str, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)

# ─── Exception Handlers ───────────────────────────────────────────────────────

async def app_error_handler(request: Request, exc: AppError):
    """Handles intentional application errors"""
    logger.warning(f"AppError [{exc.code}] {exc.message} — {request.method} {request.url.path}")
    return JSONResponse(
        status_code=exc.status,
        content={"error": exc.code, "message": exc.message}
    )

async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Handles Pydantic validation failures"""
    errors = []
    for err in exc.errors():
        # Clean up the location path for readability
        field = " → ".join(str(l) for l in err["loc"] if l != "body")
        errors.append({"field": field, "issue": err["msg"]})
    
    logger.info(f"Validation failure on {request.url.path}: {errors}")
    return JSONResponse(
        status_code=422,
        content={"error": "VALIDATION_ERROR", "fields": errors}
    )

async def unhandled_error_handler(request: Request, exc: Exception):
    """
    Catches everything else.
    Logs the full traceback but returns a generic error to the client.
    """
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {exc}\n"
        f"Path: {request.method} {request.url.path}\n"
        f"{traceback.format_exc()}"
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_ERROR", 
            "message": "An unexpected error occurred. Our engineers have been notified."
        }
    )
