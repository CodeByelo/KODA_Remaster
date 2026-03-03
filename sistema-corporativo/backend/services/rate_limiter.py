from redis.asyncio import Redis
from fastapi import Request, HTTPException
from middleware.context import get_current_tenant_id
import os

REDIS_URL = (os.getenv("REDIS_URL") or "").strip()
redis_client = Redis.from_url(REDIS_URL) if REDIS_URL else None
_redis_warning_logged = False


async def rate_limiter_middleware(request: Request):
    """
    Rate limiting por ventana de 1 segundo.
    - Con tenant en contexto: limite por tenant.
    - Sin tenant: limite por IP para endpoints publicos.
    """
    if redis_client is None:
        return

    tenant_id = get_current_tenant_id()
    client_ip = request.client.host if request.client else "unknown"

    if tenant_id:
        key = f"rate_limit:tenant:{tenant_id}"
        limit = 120
    else:
        key = f"rate_limit:ip:{client_ip}"
        limit = 40

    window = 1

    async with redis_client.pipeline(transaction=True) as pipe:
        try:
            await pipe.incr(key)
            await pipe.expire(key, window)
            results = await pipe.execute()
            count = int(results[0] or 0)
            if count > limit:
                raise HTTPException(
                    status_code=429,
                    detail="Demasiadas solicitudes. Intente nuevamente en unos segundos.",
                )
        except Exception as error:
            if isinstance(error, HTTPException):
                raise error
            # Fail-open para no tumbar el servicio si Redis falla.
            global _redis_warning_logged
            if not _redis_warning_logged:
                print(f"Redis Rate Limiter Error (fail-open): {error}")
                _redis_warning_logged = True
