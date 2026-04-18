from collections import defaultdict
from time import time
from fastapi import Request, HTTPException

# Sliding window rate limiter
# Stores: { ip_action: [timestamp1, timestamp2, ...] }
_windows: defaultdict[str, list[float]] = defaultdict(list)

LIMITS = {
    "create_project":  (10, 3600),   # 10 projects per hour per IP
    "create_comment":  (60, 60),     # 60 comments per minute per IP
    "proxy":           (30, 60),     # 30 proxy requests per minute per IP
    "export":          (20, 60),     # 20 exports per minute per IP
    "default":         (100, 60),    # 100 requests per minute for everything else
}

def get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For for reverse proxies"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Get the first IP in the chain
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_rate_limit(request: Request, action: str = "default") -> None:
    """
    Raises HTTP 429 if the client IP has exceeded the rate limit for this action.
    Uses sliding window: counts requests in the last `window_seconds` seconds.
    Automatically cleans up expired timestamps.
    """
    ip = get_client_ip(request)
    max_requests, window_seconds = LIMITS.get(action, LIMITS["default"])
    
    # Unique key per IP + Action combination
    key = f"{ip}:{action}"
    now = time()
    window_start = now - window_seconds
    
    # Remove timestamps outside the current sliding window
    _windows[key] = [t for t in _windows[key] if t > window_start]
    
    if len(_windows[key]) >= max_requests:
        # Calculate when the oldest request in the window expires
        oldest_req = _windows[key][0]
        retry_after = int(oldest_req + window_seconds - now) + 1
        
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for '{action}'. Retry after {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )
    
    # Add crystal timestamp of the current request
    _windows[key].append(now)

def get_windows():
    """Access the internal window storage for cleanup tasks"""
    return _windows
