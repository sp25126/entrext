from supabase import create_client
from config import settings
import uuid

def diagnose():
    db = create_client(settings.supabase_url, settings.supabase_key)
    
    print("--- Attempting Raw Project Insert ---")
    dummy_project = {
        "name": "Diagnostic Test",
        "description": "Checking for FK constraints",
        "target_url": "https://example.com",
        "user_id": "00000000-0000-0000-0000-000000000000",
        "share_token": "diag_" + str(uuid.uuid4())[:8]
    }
    
    try:
        r = db.table("projects").insert(dummy_project).execute()
        print("SUCCESS: Insert worked with dummy UUID.")
    except Exception as e:
        print("\n!!! DATABASE ERROR DETECTED !!!")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {str(e)}")
        
        print("\n--- Testing Null user_id fallback ---")
        try:
            del dummy_project["user_id"]
            r = db.table("projects").insert(dummy_project).execute()
            print("SUCCESS: Insert worked with NULL user_id.")
        except Exception as e2:
            print(f"FAILED (Null User): {str(e2)}")

if __name__ == "__main__":
    diagnose()
