import os
import sys
from dataclasses import dataclass
from dotenv import load_dotenv

from pathlib import Path
# Look for .env in the same directory as this file (backend/)
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

@dataclass
class Settings:
    supabase_url: str
    supabase_key: str
    frontend_url: str = "http://localhost:3000"

def load_config() -> Settings:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    if not url or not key:
        print("\n[CRITICAL] Missing mandatory environment variables!")
        print("Required: SUPABASE_URL, SUPABASE_KEY")
        print("Please check your .env file in the backend directory.\n")
        sys.exit(1)

    return Settings(
        supabase_url=url,
        supabase_key=key,
        frontend_url=frontend.rstrip("/")
    )

settings = load_config()
