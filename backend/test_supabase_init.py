import os
from supabase import create_client, Client

url = "https://example.supabase.co"
key = "ey..."

try:
    print("Attempting to create client...")
    client = create_client(url, key)
    print("Success!")
except Exception as e:
    import traceback
    traceback.print_exc()
