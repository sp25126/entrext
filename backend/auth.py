from typing import Optional
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
from logger import logger
from errors import AppError
from supabase import Client, create_client
import os

# Initialize a local client for auth verification if needed, 
# though main.py usually exports 'db'. 
# For isolation, we can use the env directly.
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
db: Client = create_client(supabase_url, supabase_key)

bearer_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
):
    """
    Validates Supabase JWT. Raises AppError (401) if missing or invalid.
    Returns the Supabase user object on success.
    """
    if not credentials or not credentials.credentials:
        raise AppError("UNAUTHORIZED", "Authentication required. Provide a Bearer token.", 401)

    token = credentials.credentials

    # Basic format check — JWT has exactly 3 dot-separated parts
    parts = token.split(".")
    if len(parts) != 3:
        raise AppError("INVALID_TOKEN", "Malformed JWT token.", 401)

    try:
        user_response = db.auth.get_user(token)
        if not user_response or not user_response.user:
            raise AppError("INVALID_TOKEN", "Token is invalid or expired.", 401)
        return user_response.user
    except AppError:
        raise
    except Exception as e:
        logger.warning(f"JWT validation failed: {type(e).__name__}")
        raise AppError("INVALID_TOKEN", "Token is invalid or expired.", 401)
