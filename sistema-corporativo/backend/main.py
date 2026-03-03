import os
import sys
import logging
import ipaddress
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from pathlib import Path

# Cargar .env explícitamente desde la carpeta backend
env_path = Path(__file__).parent / ".env"
print(f"\n🔍 Buscando .env en: {env_path}")
print(f"📁 Existe: {env_path.exists()}\n")

load_dotenv(dotenv_path=env_path)
DEV_ROLE_MASTER_PASSWORD = os.getenv("DEV_ROLE_MASTER_PASSWORD", "")

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from jose import jwt
import traceback

# Asegurar que el directorio backend esté en el PYTHONPATH
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# AHORA sí importar módulos que dependen de variables de entorno
from database.async_db import get_db_connection, init_db_pool
import database.async_db as async_db
from middleware.tenant import get_tenant_context, trace_id_var
from services.rate_limiter import rate_limiter_middleware


def _extract_client_ip(request: Request) -> Optional[str]:
    """
    Obtiene IP real del cliente considerando proxies (Render/Vercel/Cloudflare).
    Prioridad:
    - CF-Connecting-IP
    - X-Real-IP
    - X-Forwarded-For (primer valor no vacio)
    - request.client.host
    """
    candidates = [
        request.headers.get("cf-connecting-ip"),
        request.headers.get("x-real-ip"),
    ]

    xff = request.headers.get("x-forwarded-for")
    if xff:
        candidates.extend([part.strip() for part in xff.split(",") if part.strip()])

    if request.client and request.client.host:
        candidates.append(request.client.host)

    for raw in candidates:
        if not raw:
            continue
        ip = raw
        if ":" in ip and "." not in ip:
            ip = ip.split("%")[0]
        try:
            ipaddress.ip_address(ip)
            return ip
        except ValueError:
            continue
    return None
from src import schemas
from routers import auth_router, users_router
from auth.supabase_auth import get_current_user
from pydantic import BaseModel

import json
DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"
DEFAULT_JWT_SECRET = "tu_clave_secreta_muy_segura_cambiala_en_produccion"
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10MB por archivo
MAX_UPLOAD_FILES = int(os.getenv("MAX_UPLOAD_FILES", "5"))
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx"}

# ===================================================================
# CONFIGURACIÓN DE LOGGING ESTRUCTURADO JSON ENTERPRISE
# ===================================================================
from middleware.context import (
    get_current_tenant_id, 
    get_current_user_id, 
    get_current_trace_id, 
    tenant_id_var,
    user_id_var,
    extract_user_from_token,
)
import time
import uuid

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "tenant_id": get_current_tenant_id(),
            "user_id": get_current_user_id(),
            "trace_id": get_current_trace_id(),
        }
        if hasattr(record, 'duration_ms'):
            log_entry["duration_ms"] = record.duration_ms
            
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)

logger = logging.getLogger("sistema_corporativo")
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False

app = FastAPI(
    title="Sistema Corporativo API - MultiTenant Edition",
    description="API Enterprise con aislamiento RLS y escalado multi-tenant",
    version="2.0.0"
)

@app.middleware("http")
async def add_observability_context(request: Request, call_next):
    start_time = time.time()
    trace_id = str(uuid.uuid4())
    token = trace_id_var.set(trace_id)
    user_token = None
    tenant_token = None
    
    try:
        request_user_id, request_tenant_id = await extract_user_from_token(request)
        if request_user_id:
            user_token = user_id_var.set(request_user_id)
        if request_tenant_id:
            tenant_token = tenant_id_var.set(request_tenant_id)

        await rate_limiter_middleware(request)
        response = await call_next(request)
        duration_ms = int((time.time() - start_time) * 1000)
        
        logger.info(
            f"HTTP {request.method} {request.url.path} - {response.status_code}",
            extra={"duration_ms": duration_ms}
        )
        return response
    finally:
        if tenant_token is not None:
            tenant_id_var.reset(tenant_token)
        if user_token is not None:
            user_id_var.reset(user_token)
        trace_id_var.reset(token)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if os.getenv("NODE_ENV", "").lower() == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# ===================================================================
# CONFIGURACIÓN DE SEGURIDAD
# ===================================================================
from auth.security import verify_password, get_password_hash, create_access_token

# ===================================================================
# MIDDLEWARES
# ===================================================================
# Configurar CORS para permitir localhost:3000 y otros orígenes comunes
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://sistema-corpoelect.vercel.app",
    "https://sistema-corpoelect-eight.vercel.app",
    "https://sistema-corpoelect-git-main-henryddaniel1910-6913s-projects.vercel.app",
    "https://sistema-corpoelect-backend.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos para adjuntos
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# INCLUSIÓN DE ROUTERS
app.include_router(auth_router.router)
app.include_router(users_router.router)

print("\n📋 RUTAS REGISTRADAS EN FASTAPI:")
for route in app.routes:
    if hasattr(route, 'methods'):
        print(f"  {list(route.methods)} {route.path}")
print()

@app.on_event("startup")
async def startup():
    jwt_secret = os.getenv("JWT_SECRET", DEFAULT_JWT_SECRET)
    if (not jwt_secret) or (jwt_secret == DEFAULT_JWT_SECRET) or (len(jwt_secret) < 32):
        raise RuntimeError("JWT_SECRET inseguro o no configurado correctamente (minimo 32 caracteres y no default)")
    if (not DEV_ROLE_MASTER_PASSWORD) or (DEV_ROLE_MASTER_PASSWORD == "JJDKoda**") or (len(DEV_ROLE_MASTER_PASSWORD) < 12):
        raise RuntimeError("DEV_ROLE_MASTER_PASSWORD inseguro o no configurado (minimo 12 caracteres y no default)")

    await init_db_pool()
    try:
        if async_db.pool is None:
            raise RuntimeError("DB pool no inicializado en startup")
        async with async_db.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS bot_knowledge (
                    id BIGSERIAL PRIMARY KEY,
                    question TEXT NOT NULL UNIQUE,
                    answer TEXT NOT NULL,
                    updated_by TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS security_events (
                    id BIGSERIAL PRIMARY KEY,
                    tenant_id UUID,
                    user_id UUID,
                    username TEXT,
                    evento TEXT NOT NULL,
                    detalles TEXT,
                    estado TEXT DEFAULT 'info',
                    page TEXT,
                    ip_origen TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS login_lockouts (
                    username TEXT PRIMARY KEY,
                    failed_count INT NOT NULL DEFAULT 0,
                    locked_until TIMESTAMPTZ
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS dashboard_announcement (
                    id INT PRIMARY KEY DEFAULT 1,
                    badge TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    status TEXT NOT NULL,
                    urgency TEXT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT dashboard_announcement_singleton CHECK (id = 1)
                )
            """)
    except Exception as exc:
        logger.warning(f"No se pudo garantizar tablas base en startup: {exc}")
    logger.info("Database Connection Pool Initialized")

# ===================================================================
# UTILIDADES
# ===================================================================
# Security utilities imported from auth.security

# ===================================================================
# GLOBAL EXCEPTION HANDLER
# ===================================================================
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_trace = traceback.format_exc()
    # Print explícito para asegurar que se ve en la terminal
    print(f"\n❌ CRITICAL GLOBAL ERROR: {str(exc)}\n{error_trace}\n")
    logger.error(f"GLOBAL ERROR: {str(exc)}\n{error_trace}")
    
    response_content = {
        "detail": "Internal Server Error",
    }
    
    # En desarrollo, enviamos el trace al frontend para diagnóstico rápido
    if DEBUG_MODE:
        response_content["message"] = str(exc)
        response_content["type"] = type(exc).__name__
        response_content["trace"] = error_trace

    response = JSONResponse(
        status_code=500,
        content=response_content
    )
    
    # Inyectar CORS manualmente para evitar bloqueos de navegador en errores 500
    origin = request.headers.get("origin")
    if origin in origins or "*" in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
    return response

# ===================================================================
# ENDPOINTS
# ===================================================================

@app.get("/db-check")
@app.get("/health")
async def health_check(conn = Depends(get_db_connection)):
    try:
        await conn.execute("SELECT 1")
        return {"status": "ok", "message": "Conectado al Backend y Base de Datos (Enterprise Mode)", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "error", "message": str(e), "database": "error"}

@app.post("/api/register", response_model=schemas.UsuarioResponse)
async def register_user(
    user: schemas.UsuarioCreate, 
    conn = Depends(get_db_connection)
):
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM profiles WHERE username = $1 OR email = $2", 
            user.username, user.email
        )
        if existing:
            raise HTTPException(status_code=400, detail="Usuario o Email ya registrado")

        # Mapear gerencia si viene por nombre
        g_id = user.gerencia_id
        if not g_id and user.gerencia_nombre:
            g_id = await conn.fetchval("SELECT id FROM gerencias WHERE nombre = $1", user.gerencia_nombre)
            if not g_id:
                # Si no existe, crearla dinámicamente
                g_id = await conn.fetchval(
                    "INSERT INTO gerencias (nombre) VALUES ($1) RETURNING id", 
                    user.gerencia_nombre
                )

        hashed_pw = get_password_hash(user.password)

        tenant_id = await conn.fetchval(
            "SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1"
        )
        if not tenant_id:
            raise HTTPException(status_code=500, detail="No existe organization base para asignar tenant_id")

        query = """
            INSERT INTO profiles (username, nombre, apellido, email, password_hash, rol_id, gerencia_id, estado, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, username, nombre, apellido, email, rol_id, gerencia_id, estado, tenant_id
        """
        default_rol = 3
        row = await conn.fetchrow(
            query, 
            user.username, user.nombre, user.apellido, user.email, 
            hashed_pw, user.rol_id or default_rol, g_id, True, tenant_id
        )
        
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno durante el registro: {str(e)}")

@app.post("/login")
@app.post("/api/login")
async def login_compat(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    conn = Depends(get_db_connection)
):
    username_input = str(form_data.username or "").strip()
    username_norm = username_input.lower()

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS login_lockouts (
            username TEXT PRIMARY KEY,
            failed_count INT NOT NULL DEFAULT 0,
            locked_until TIMESTAMPTZ
        )
    """)
    lock_row = await conn.fetchrow(
        "SELECT failed_count, locked_until FROM login_lockouts WHERE username = $1",
        username_norm,
    )
    now_utc = datetime.now(timezone.utc)
    if lock_row and lock_row["locked_until"] and lock_row["locked_until"] > now_utc:
        raise HTTPException(
            status_code=423,
            detail={
                "message": "Usuario bloqueado contacte a un administrador",
                "failed_count": int(lock_row["failed_count"] or 3),
                "remaining_attempts": 0,
                "is_locked": True,
            },
        )

    client_ip = _extract_client_ip(request)

    query = """
        SELECT p.id, p.username, p.password_hash, p.nombre, p.apellido, p.email, p.rol_id, r.nombre_rol, p.tenant_id,
               p.permisos,
               p.gerencia_id, g.nombre as gerencia_nombre,
               p.estado
        FROM profiles p
        LEFT JOIN roles r ON p.rol_id = r.id
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE LOWER(p.username) = LOWER($1)
    """
    user = await conn.fetchrow(query, username_input)

    if user and user["estado"] is False:
        raise HTTPException(status_code=403, detail="Usuario inactivo. Contacte a un administrador")

    if not user or not verify_password(form_data.password, user["password_hash"]):
        failed_count = (lock_row["failed_count"] if lock_row else 0) + 1
        is_locked = failed_count >= 3
        locked_until = datetime.now(timezone.utc) + timedelta(days=3650) if is_locked else None
        await conn.execute(
            """
            INSERT INTO login_lockouts (username, failed_count, locked_until)
            VALUES ($1, $2, $3)
            ON CONFLICT (username)
            DO UPDATE SET failed_count = EXCLUDED.failed_count, locked_until = EXCLUDED.locked_until
            """,
            username_norm,
            failed_count,
            locked_until,
        )
        try:
            await _ensure_security_events_table(conn)
            await conn.execute(
                """
                INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page, ip_origen)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
                """,
                user["tenant_id"] if user else None,
                user["id"] if user else None,
                user["username"] if user else username_input,
                "LOGIN_FALLIDO" if not is_locked else "USUARIO_BLOQUEADO",
                f"Intento fallido #{failed_count}" if not is_locked else "Bloqueado tras 3 intentos fallidos",
                "warning" if not is_locked else "danger",
                "/login",
                client_ip,
            )
        except Exception:
            pass
        if is_locked:
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Usuario bloqueado contacte a un administrador",
                    "failed_count": int(failed_count),
                    "remaining_attempts": 0,
                    "is_locked": True,
                },
            )
        remaining_attempts = max(0, 3 - int(failed_count))
        raise HTTPException(
            status_code=401,
            detail={
                "message": f"Credenciales incorrectas. Intento {failed_count} de 3.",
                "failed_count": int(failed_count),
                "remaining_attempts": int(remaining_attempts),
                "is_locked": False,
            },
        )

    await conn.execute("DELETE FROM login_lockouts WHERE username = $1", username_norm)

    access_token = create_access_token(
        data={
            "sub": str(user["id"]),
            "role": user["nombre_rol"],
            "tenant_id": str(user["tenant_id"]) if user["tenant_id"] else None,
            "gerencia_id": user["gerencia_id"],
        }
    )

    await conn.execute(
        "UPDATE profiles SET ultima_conexion = $1 WHERE id = $2",
        datetime.now(),
        user["id"],
    )
    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page, ip_origen)
            VALUES ($1::uuid, $2::uuid, $3, 'LOGIN_OK', 'Inicio de sesion exitoso', 'success', '/login', $4)
            """,
            user["tenant_id"],
            user["id"],
            user["username"],
            client_ip,
        )
    except Exception:
        pass

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["id"]),
            "username": user["username"],
            "nombre": user["nombre"],
            "apellido": user["apellido"],
            "email": user["email"],
            "role": user["nombre_rol"],
            "tenant_id": user["tenant_id"],
            "gerencia_id": user["gerencia_id"],
            "gerencia_depto": user["gerencia_nombre"],
            "permissions": list(user["permisos"] or []),
        },
    }


@app.get("/auth/validate")
async def validate_auth_session(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    profile = await conn.fetchrow(
        """
        SELECT p.id, p.username, p.nombre, p.apellido, p.email, p.estado, p.permisos,
               p.gerencia_id, COALESCE(g.nombre, 'Sin Asignar') as gerencia_depto,
               COALESCE(r.nombre_rol, 'Usuario') as role
        FROM profiles p
        LEFT JOIN roles r ON p.rol_id = r.id
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE p.id = $1::uuid
        LIMIT 1
        """,
        user_id,
    )

    if not profile:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    lock_row = await conn.fetchrow(
        "SELECT locked_until FROM login_lockouts WHERE username = LOWER($1)",
        profile["username"],
    )
    if lock_row and lock_row["locked_until"] and lock_row["locked_until"] > datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="Usuario bloqueado")

    if profile["estado"] is False:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    return {
        "authenticated": True,
        "user": {
            "id": str(profile["id"]),
            "username": profile["username"],
            "nombre": profile["nombre"],
            "apellido": profile["apellido"],
            "email": profile["email"],
            "role": profile["role"],
            "gerencia_id": profile["gerencia_id"],
            "gerencia_depto": profile["gerencia_depto"],
            "permissions": list(profile["permisos"] or []),
        },
    }


def _is_privileged_role(role_name: Optional[str]) -> bool:
    if not role_name:
        return False
    role = str(role_name).strip().lower()
    return role in {
        "desarrollador",
        "dev",
        "developer",
        "administrativo",
        "ceo",
        "admin",
        "administrador",
    }


async def _is_privileged_user(conn, current_user: dict) -> bool:
    if _is_privileged_role(current_user.get("role")):
        return True
    user_id = current_user.get("sub")
    if not user_id:
        return False
    rol_id = await conn.fetchval("SELECT rol_id FROM profiles WHERE id = $1::uuid", user_id)
    return rol_id in {1, 2, 4}


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    text = str(value).lower().strip()
    return " ".join(text.split())


async def _is_tech_user(conn, user_id: str) -> bool:
    dept = await conn.fetchval("""
        SELECT COALESCE(g.nombre, '')
        FROM profiles p
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE p.id = $1::uuid
    """, user_id)
    return "tecnolog" in _normalize_text(dept)


async def _ensure_knowledge_table(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS bot_knowledge (
            id BIGSERIAL PRIMARY KEY,
            question TEXT NOT NULL UNIQUE,
            answer TEXT NOT NULL,
            updated_by TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


async def _ensure_security_events_table(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS security_events (
            id BIGSERIAL PRIMARY KEY,
            tenant_id UUID,
            user_id UUID,
            username TEXT,
            evento TEXT NOT NULL,
            detalles TEXT,
            estado TEXT DEFAULT 'info',
            page TEXT,
            ip_origen TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


async def _ensure_ticket_events_table(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS ticket_events (
            id BIGSERIAL PRIMARY KEY,
            ticket_id INTEGER NOT NULL,
            tenant_id UUID,
            actor_user_id UUID,
            actor_username TEXT,
            action TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            observaciones TEXT,
            details TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


async def _ensure_tickets_schema(conn) -> None:
    await conn.execute("""
        ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS solicitante_nombre_cache TEXT,
        ADD COLUMN IF NOT EXISTS solicitante_gerencia_cache TEXT
    """)
    await conn.execute("""
        UPDATE tickets t
        SET
            solicitante_nombre_cache = COALESCE(t.solicitante_nombre_cache, p.nombre || ' ' || p.apellido, p.username),
            solicitante_gerencia_cache = COALESCE(t.solicitante_gerencia_cache, g.nombre)
        FROM profiles p
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE p.id = t.solicitante_id
          AND (t.solicitante_nombre_cache IS NULL OR t.solicitante_gerencia_cache IS NULL)
    """)


async def _log_ticket_event(
    conn,
    ticket_id: int,
    tenant_id: Optional[str],
    actor_user_id: Optional[str],
    actor_username: Optional[str],
    action: str,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    observaciones: Optional[str] = None,
    details: Optional[str] = None,
) -> None:
    await _ensure_ticket_events_table(conn)
    await conn.execute(
        """
        INSERT INTO ticket_events (
            ticket_id, tenant_id, actor_user_id, actor_username, action,
            old_status, new_status, observaciones, details
        )
        VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)
        """,
        ticket_id,
        tenant_id,
        actor_user_id,
        actor_username,
        action,
        old_status,
        new_status,
        observaciones,
        details,
    )


async def _ensure_announcement_table(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS dashboard_announcement (
            id INT PRIMARY KEY DEFAULT 1,
            badge TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            urgency TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT dashboard_announcement_singleton CHECK (id = 1)
        )
    """)


async def _resolve_org_id(conn, tenant_id: Optional[str] = None) -> Optional[str]:
    # Global mode: single org row for shared configs
    return await conn.fetchval("SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1")

async def _get_org_gerencia_names(conn, org_id: Optional[str]) -> List[str]:
    if not org_id:
        return []
    cfg = await conn.fetchval("SELECT config FROM organizations WHERE id = $1::uuid", org_id)
    org_structure = (cfg or {}).get("org_structure") if isinstance(cfg, dict) else None
    if not isinstance(org_structure, list):
        return []

    names: List[str] = []
    seen = set()
    for group in org_structure:
        items = (group or {}).get("items") if isinstance(group, dict) else None
        if not isinstance(items, list):
            continue
        for item in items:
            name = str(item or "").strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            names.append(name)
    return names


class TicketCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    prioridad: Optional[str] = "media"
    observaciones: Optional[str] = None


class TicketUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    prioridad: Optional[str] = None
    observaciones: Optional[str] = None


class TicketStatusUpdate(BaseModel):
    estado: str
    observaciones: Optional[str] = None


class KnowledgeCreate(BaseModel):
    question: str
    answer: str
    updatedBy: Optional[str] = "unknown"


class AnnouncementPayload(BaseModel):
    badge: str
    title: str
    description: str
    status: str
    urgency: str


class OrgStructurePayload(BaseModel):
    org_structure: List[Dict[str, Any]]


class OrgManagementDetailsPayload(BaseModel):
    management_details: Dict[str, List[str]]


class SecurityLogPayload(BaseModel):
    evento: str
    detalles: Optional[str] = ""
    estado: Optional[str] = "info"
    page: Optional[str] = ""

# ===================================================================
# HEALTH CHECKS ENTERPRISE
# ===================================================================

@app.get("/health/live")
async def liveness():
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}

@app.get("/health/ready")
async def readiness(conn = Depends(get_db_connection)):
    try:
        await conn.execute("SELECT 1")
        return {
            "status": "ready",
            "components": {
                "database": "ok",
                "pool_size": pool.get_size() if pool else 0
            }
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Service Not Ready")

# ===================================================================
# ENDPOINTS DE AUTENTICACIÓN Y TENANCY
# ===================================================================

@app.post("/api/auth/switch-organization")
async def switch_organization(
    org_id: schemas.SwitchOrgRequest,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    user_id = current_user.get("sub")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    query = """
        SELECT EXISTS(
            SELECT 1 FROM user_organizations 
            WHERE user_id = $1 AND organization_id = $2
        )
    """
    exists = await conn.fetchval(query, user_id, org_id.organization_id)
    
    if not exists:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta organización")
    
    role_row = await conn.fetchrow(
        "SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2",
        user_id, org_id.organization_id
    )

    new_token = create_access_token(
        data={
            "sub": user_id,
            "tenant_id": str(org_id.organization_id),
            "role": role_row['role'] if role_row else 'member'
        }
    )
    try:
        await _ensure_security_events_table(conn)
        username = await conn.fetchval(
            "SELECT username FROM profiles WHERE id = $1::uuid",
            user_id,
        )
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'ORGANIZACION_CAMBIADA', $4, 'info', '/dashboard')
            """,
            org_id.organization_id,
            user_id,
            username or current_user.get("username") or "anon",
            f"Cambio de organizacion a {org_id.organization_id}",
        )
    except Exception:
        pass
    
    logger.info(f"User switched to organization {org_id.organization_id}")
    
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "tenant_id": str(org_id.organization_id)
    }

@app.get("/documentos", dependencies=[Depends(get_tenant_context)])
async def list_documentos(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    try:
        tenant_id = current_user.get("tenant_id")
        user_id_raw = current_user.get("sub")
        if not user_id_raw:
            raise HTTPException(status_code=401, detail="Usuario no identificado")
        user_id = uuid.UUID(str(user_id_raw))
        user_gerencia_id = await conn.fetchval(
            "SELECT gerencia_id FROM profiles WHERE id = $1::uuid",
            user_id,
        )
        is_privileged = await _is_privileged_user(conn, current_user)
        role_norm = _normalize_text(current_user.get("role"))
        is_manager = role_norm in {"gerente", "manager"}

        # 1. Ejecutar máquina de estados automática
        await conn.execute("""
            UPDATE documentos 
            SET estado = 'pendiente' 
            WHERE estado = 'en-proceso' 
            AND now() - fecha_ultima_actividad > INTERVAL '3 days'
        """)
        
        await conn.execute("""
            UPDATE documentos 
            SET estado = 'omitido' 
            WHERE estado = 'pendiente' 
            AND now() - fecha_ultima_actividad > INTERVAL '6 days'
        """)

        # 2. Query mejorada para sistema de correo con multi-adjuntos
        query = """
            SELECT 
                d.id, 
                COALESCE(d.titulo, d.title, 'Sin Asunto') as name, 
                d.correlativo as idDoc,
                d.tipo_documento as category,
                d.estado as signatureStatus,
                d.prioridad,
                d.remitente_id,
                COALESCE(p_rem.nombre || ' ' || p_rem.apellido, 'Desconocido') as uploadedBy,
                COALESCE(p_rem.nombre || ' ' || p_rem.apellido, 'Desconocido') as remitente_nombre,
                p_rem.gerencia_id as remitente_gerencia_id,
                g_rem.nombre as remitente_gerencia_nombre,
                d.receptor_id,
                d.receptor_gerencia_id,
                COALESCE(p_rec.nombre || ' ' || p_rec.apellido, g.nombre, 'Sin Asignar') as receptor_nombre,
                p_rec.gerencia_id as receptor_gerencia_id_usuario,
                g_rec.nombre as receptor_gerencia_nombre_usuario,
                COALESCE(g.nombre, 'Mensaje Personal') as targetDepartment,
                d.url_archivo as fileUrl,
                (SELECT array_agg(da.url_archivo) FROM documento_adjuntos da WHERE da.documento_id = d.id) as archivos,
                d.fecha_creacion,
                TO_CHAR(d.fecha_creacion, 'DD/MM/YYYY') as uploadDate,
                TO_CHAR(d.fecha_creacion, 'HH24:MI') as uploadTime,
                d.fecha_caducidad,
                d.tenant_id,
                d.contenido,
                d.leido
            FROM documentos d
            LEFT JOIN profiles p_rem ON d.remitente_id = p_rem.id
            LEFT JOIN profiles p_rec ON d.receptor_id = p_rec.id
            LEFT JOIN gerencias g ON d.receptor_gerencia_id = g.id
            LEFT JOIN gerencias g_rem ON p_rem.gerencia_id = g_rem.id
            LEFT JOIN gerencias g_rec ON p_rec.gerencia_id = g_rec.id
            WHERE
                (
                    $4::boolean = TRUE
                    OR d.remitente_id = $2::uuid
                    OR d.receptor_id = $2::uuid
                    OR ($3::int IS NOT NULL AND d.receptor_gerencia_id = $3::int)
                    OR (
                        $5::boolean = TRUE
                        AND $3::int IS NOT NULL
                        AND (
                            p_rem.gerencia_id = $3::int
                            OR p_rec.gerencia_id = $3::int
                            OR d.receptor_gerencia_id = $3::int
                        )
                    )
                )
                AND (
                    $1::uuid IS NULL
                    OR d.tenant_id = $1::uuid
                    OR d.tenant_id IS NULL
                )
            ORDER BY d.fecha_creacion DESC
        """
        rows = await conn.fetch(query, tenant_id, user_id, user_gerencia_id, is_privileged, is_manager)
        # Convertir record a dict y manejar el campo archivos
        result = []
        for r in rows:
            d = dict(r)
            # Asegurar que archivos no sea None
            if d.get("archivos") is None:
                d["archivos"] = [d["fileUrl"]] if d.get("fileUrl") else []
            result.append(d)
        return result
    except Exception as e:
        logger.error(f"Error listando correos/documentos: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import UploadFile, File as FastAPIFile, Form

@app.post("/documentos", dependencies=[Depends(get_tenant_context)])
async def create_documento(
    request: Request,
    titulo: str = Form(...),
    correlativo_user: Optional[str] = Form(None, alias="correlativo"),
    tipo_documento: str = Form(...),
    prioridad: str = Form("media"),
    tiempo_maximo_dias: Optional[int] = Form(None),
    receptor_gerencia_id: Optional[int] = Form(None),
    receptor_gerencia_nombre: Optional[str] = Form(None),
    receptor_id: Optional[uuid.UUID] = Form(None),
    contenido: Optional[str] = Form(None),
    archivos: List[UploadFile] = FastAPIFile(None),
    conn = Depends(get_db_connection)
):
    try:
        # ========== 1. EXTRAER Y VALIDAR TOKEN ==========
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Token no proporcionado")
        
        token = auth_header.split(" ")[1]
        secret_key = os.getenv("JWT_SECRET", "tu_clave_secreta_muy_segura_cambiala_en_produccion")
        
        try:
            payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")
        
        user_id_raw = payload.get("sub")
        tenant_id_raw = payload.get("tenant_id")
        
        if not user_id_raw or user_id_raw == "None":
            raise HTTPException(status_code=401, detail="Usuario no identificado")
        
        user_id = uuid.UUID(str(user_id_raw))

        # Resolver gerencia por nombre cuando el cliente aun no tiene ID sincronizado.
        if not receptor_gerencia_id and receptor_gerencia_nombre:
            dept_name = receptor_gerencia_nombre.strip()
            if dept_name:
                receptor_gerencia_id = await conn.fetchval(
                    "SELECT id FROM gerencias WHERE LOWER(nombre) = LOWER($1) LIMIT 1",
                    dept_name,
                )
                if not receptor_gerencia_id:
                    receptor_gerencia_id = await conn.fetchval(
                        "INSERT INTO gerencias (nombre) VALUES ($1) RETURNING id",
                        dept_name,
                    )
        
        # ========== 2. OBTENER TENANT_ID ==========
        tenant_id = None
        if tenant_id_raw and tenant_id_raw != "None":
            try:
                tenant_id = uuid.UUID(str(tenant_id_raw))
            except:
                pass
        
        if not tenant_id:
            tenant_id_raw = await conn.fetchval("SELECT tenant_id FROM profiles WHERE id = $1", user_id)
            tenant_id = uuid.UUID(str(tenant_id_raw)) if tenant_id_raw else None
        if not tenant_id and receptor_id:
            receiver_tenant = await conn.fetchval(
                "SELECT tenant_id FROM profiles WHERE id = $1::uuid",
                receptor_id,
            )
            tenant_id = uuid.UUID(str(receiver_tenant)) if receiver_tenant else None
        if not tenant_id and receptor_gerencia_id:
            dept_tenant = await conn.fetchval(
                """
                SELECT tenant_id
                FROM profiles
                WHERE gerencia_id = $1
                  AND tenant_id IS NOT NULL
                ORDER BY created_at ASC
                LIMIT 1
                """,
                receptor_gerencia_id,
            )
            tenant_id = uuid.UUID(str(dept_tenant)) if dept_tenant else None
        if not tenant_id:
            fallback_org = await conn.fetchval(
                "SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1"
            )
            tenant_id = uuid.UUID(str(fallback_org)) if fallback_org else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No se pudo resolver tenant para el documento")
        
        # ========== 3. GENERAR CORRELATIVO ==========
        try:
            user_info = await conn.fetchrow("""
                SELECT g.siglas FROM profiles p 
                LEFT JOIN gerencias g ON p.gerencia_id = g.id 
                WHERE p.id = $1
            """, user_id)
            siglas = user_info['siglas'] if user_info and user_info['siglas'] else 'COR'
        except:
            siglas = 'COR'
        
        year = datetime.now().year
        count = await conn.fetchval("""
            SELECT COUNT(*) FROM documentos 
            WHERE correlativo LIKE $1 || '-%-' || $2 AND tenant_id = $3
        """, siglas, str(year), tenant_id)
        
        manual_part = (correlativo_user or "").strip()
        if manual_part:
            auto_correlativo = f"{siglas}-{manual_part}-{year}"
        else:
            auto_correlativo = f"{siglas}-{str((count or 0) + 1).zfill(3)}-{year}"
        
        # ========== 4. PROCESAR MÚLTIPLES ARCHIVOS ==========
        file_urls = []
        if archivos:
            if len(archivos) > MAX_UPLOAD_FILES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cantidad maxima de archivos excedida. Limite: {MAX_UPLOAD_FILES}",
                )
            folder = Path("uploads")
            folder.mkdir(exist_ok=True)
            for archivo in archivos:
                if archivo and archivo.filename:
                    ext = Path(archivo.filename).suffix.lower()
                    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
                        raise HTTPException(status_code=400, detail=f"Extension no permitida: {ext}")
                    file_id = f"{uuid.uuid4()}{ext}"
                    filepath = folder / file_id
                    written = 0
                    with filepath.open("wb") as buffer:
                        while True:
                            chunk = await archivo.read(1024 * 1024)
                            if not chunk:
                                break
                            written += len(chunk)
                            if written > MAX_UPLOAD_BYTES:
                                buffer.close()
                                filepath.unlink(missing_ok=True)
                                raise HTTPException(
                                    status_code=413,
                                    detail=f"Archivo excede limite permitido ({MAX_UPLOAD_BYTES // (1024 * 1024)}MB)",
                                )
                            buffer.write(chunk)
                    await archivo.close()
                    file_urls.append(f"/uploads/{file_id}")

        # Guardamos la primera URL en la tabla principal para compatibilidad legacy
        primary_file_url = file_urls[0] if file_urls else None

        # ========== 5. INSERTAR EN BD ==========
        fecha_creacion = datetime.now()
        if tiempo_maximo_dias and int(tiempo_maximo_dias) > 0:
            fecha_caducidad = fecha_creacion + timedelta(days=int(tiempo_maximo_dias))
        else:
            fecha_caducidad = fecha_creacion + timedelta(days=6)

        doc_id = await conn.fetchval("""
            INSERT INTO documentos (
                titulo, title, correlativo, tipo_documento, estado, prioridad,
                remitente_id, receptor_id, receptor_gerencia_id, url_archivo,
                contenido, leido, fecha_creacion, fecha_caducidad, 
                fecha_ultima_actividad, tenant_id, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id
        """, 
            titulo, titulo, auto_correlativo, tipo_documento, 'pendiente', prioridad,
            user_id, receptor_id, receptor_gerencia_id, primary_file_url,
            contenido, False, fecha_creacion, fecha_caducidad, fecha_creacion, tenant_id, user_id
        )

        # ========== 6. INSERTAR ADJUNTOS EN TABLA RELACIONADA ==========
        for url in file_urls:
            await conn.execute("""
                INSERT INTO documento_adjuntos (documento_id, url_archivo)
                VALUES ($1, $2)
            """, doc_id, url)

        # ========== 7. LOG DE ENVIO ==========
        try:
            await _ensure_security_events_table(conn)
            username = await conn.fetchval(
                "SELECT username FROM profiles WHERE id = $1::uuid",
                user_id,
            )
            destino = (
                f"usuario_id={receptor_id}" if receptor_id
                else f"gerencia_id={receptor_gerencia_id}" if receptor_gerencia_id
                else "destino_no_definido"
            )
            await conn.execute(
                """
                INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
                VALUES ($1::uuid, $2::uuid, $3, 'DOCUMENTO_ENVIADO', $4, 'success', '/dashboard?tab=documentos')
                """,
                tenant_id,
                user_id,
                username or "anon",
                f"Documento enviado: {auto_correlativo} | titulo='{titulo}' | estado_inicial='pendiente' | {destino}",
            )
        except Exception:
            pass
        
        return {"id": doc_id, "correlativo": auto_correlativo, "status": "success"}

    except Exception as e:
        logger.error(f"Error enviando mensaje: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/documentos/{id}/leido")
async def mark_as_read(
    id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    try:
        tenant_id = current_user.get("tenant_id")
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Usuario no identificado")
        user_uuid = uuid.UUID(str(user_id))
        user_gerencia_id = await conn.fetchval(
            "SELECT gerencia_id FROM profiles WHERE id = $1::uuid",
            user_uuid,
        )
        is_privileged = await _is_privileged_user(conn, current_user)
        if not tenant_id:
            tenant_id = await conn.fetchval(
                "SELECT tenant_id FROM profiles WHERE id = $1::uuid",
                user_uuid,
            )
        updated = await conn.fetchrow(
            """
            UPDATE documentos
            SET
                leido = TRUE,
                estado = CASE
                    WHEN estado IN ('en-proceso', 'pendiente') THEN 'recibido'
                    ELSE estado
                END,
                fecha_ultima_actividad = NOW()
            WHERE id = $1
              AND ($2::uuid IS NULL OR tenant_id = $2::uuid OR tenant_id IS NULL)
              AND (
                    $3::boolean = TRUE
                    OR receptor_id = $4::uuid
                    OR ($5::int IS NOT NULL AND receptor_gerencia_id = $5::int)
                  )
            RETURNING id, COALESCE(titulo, title, 'Sin Asunto') as titulo, correlativo, estado
            """,
            id,
            tenant_id,
            is_privileged,
            user_uuid,
            user_gerencia_id,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Documento no encontrado o sin permiso para marcarlo como leido")

        try:
            await _ensure_security_events_table(conn)
            username = await conn.fetchval(
                "SELECT username FROM profiles WHERE id = $1::uuid",
                user_id,
            )
            await conn.execute(
                """
                INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
                VALUES ($1::uuid, $2::uuid, $3, 'DOCUMENTO_LEIDO', $4, 'info', '/dashboard?tab=documentos')
                """,
                tenant_id,
                user_uuid,
                username or "anon",
                f"Documento abierto: {updated.get('correlativo') or updated.get('id')} | titulo='{updated.get('titulo')}' | nuevo_estado='{updated.get('estado')}'",
            )
        except Exception:
            pass

        return {"status": "success", "estado": updated.get("estado")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/documentos/{id}/estado")
async def update_doc_status(
    id: uuid.UUID,
    status_data: dict,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    try:
        tenant_id = current_user.get("tenant_id")
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Usuario no identificado")
        if not tenant_id:
            tenant_id = await conn.fetchval(
                "SELECT tenant_id FROM profiles WHERE id = $1::uuid",
                user_id,
            )
        nuevo_estado = status_data.get("estado")
        updated = await conn.fetchrow("""
            UPDATE documentos 
            SET estado = $1, fecha_ultima_actividad = NOW() 
            WHERE id = $2 AND ($3::uuid IS NULL OR tenant_id = $3::uuid OR tenant_id IS NULL)
            RETURNING id, COALESCE(titulo, title, 'Sin Asunto') as titulo, correlativo, estado
        """, nuevo_estado, id, tenant_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        try:
            await _ensure_security_events_table(conn)
            username = await conn.fetchval(
                "SELECT username FROM profiles WHERE id = $1::uuid",
                user_id,
            )
            await conn.execute(
                """
                INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
                VALUES ($1::uuid, $2::uuid, $3, 'DOCUMENTO_ESTADO_ACTUALIZADO', $4, 'info', '/dashboard?tab=documentos')
                """,
                tenant_id,
                user_id,
                username or "anon",
                f"Cambio de estado: {updated.get('correlativo') or updated.get('id')} | titulo='{updated.get('titulo')}' | nuevo_estado='{updated.get('estado')}'",
            )
        except Exception:
            pass
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documentos/{id}")
async def delete_documento(
    id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    try:
        if not await _is_privileged_user(conn, current_user):
            raise HTTPException(status_code=403, detail="No autorizado para eliminar documentos")

        tenant_id = current_user.get("tenant_id")
        user_id = current_user.get("sub")
        if not tenant_id and user_id:
            tenant_id = await conn.fetchval(
                "SELECT tenant_id FROM profiles WHERE id = $1::uuid",
                user_id,
            )

        doc = await conn.fetchrow(
            """
            SELECT id, COALESCE(titulo, title, 'Sin Asunto') as titulo, correlativo, url_archivo
            FROM documentos
            WHERE id = $1
              AND ($2::uuid IS NULL OR tenant_id = $2::uuid OR tenant_id IS NULL)
            """,
            id,
            tenant_id,
        )
        if not doc:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        adjuntos = await conn.fetch(
            "SELECT url_archivo FROM documento_adjuntos WHERE documento_id = $1",
            id,
        )
        file_urls = [doc.get("url_archivo")] + [r.get("url_archivo") for r in adjuntos]

        await conn.execute("DELETE FROM documento_adjuntos WHERE documento_id = $1", id)
        await conn.execute("DELETE FROM documentos WHERE id = $1", id)

        for url in file_urls:
            try:
                if not url:
                    continue
                if not str(url).startswith("/uploads/"):
                    continue
                filename = Path(str(url)).name
                if not filename:
                    continue
                path = Path("uploads") / filename
                if path.exists():
                    path.unlink()
            except Exception:
                pass

        try:
            await _ensure_security_events_table(conn)
            username = await conn.fetchval(
                "SELECT username FROM profiles WHERE id = $1::uuid",
                user_id,
            )
            await conn.execute(
                """
                INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
                VALUES ($1::uuid, $2::uuid, $3, 'DOCUMENTO_ELIMINADO', $4, 'warning', '/dashboard?tab=seguridad')
                """,
                tenant_id,
                user_id,
                username or "admin",
                f"Documento eliminado: {doc.get('correlativo') or doc.get('id')} | titulo='{doc.get('titulo')}'",
            )
        except Exception:
            pass

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/gerencias")
async def list_gerencias(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    org_id = await _resolve_org_id(conn, current_user.get("tenant_id"))
    org_names = await _get_org_gerencia_names(conn, org_id)

    if not org_names:
        rows = await conn.fetch("SELECT id, nombre, siglas FROM gerencias ORDER BY nombre")
        return [dict(r) for r in rows]

    lowered = [n.lower() for n in org_names]
    async with conn.transaction():
        for name in org_names:
            exists = await conn.fetchval(
                "SELECT 1 FROM gerencias WHERE LOWER(nombre) = LOWER($1) LIMIT 1",
                name,
            )
            if not exists:
                await conn.execute("INSERT INTO gerencias (nombre) VALUES ($1)", name)

    rows = await conn.fetch(
        "SELECT id, nombre, siglas FROM gerencias WHERE LOWER(nombre) = ANY($1::text[])",
        lowered,
    )
    by_name = {str(r["nombre"]).strip().lower(): dict(r) for r in rows}
    ordered = [by_name[n.lower()] for n in org_names if n.lower() in by_name]
    return ordered

@app.get("/gerencias/public")
async def list_gerencias_public(conn = Depends(get_db_connection)):
    org_id = await _resolve_org_id(conn, None)
    org_names = await _get_org_gerencia_names(conn, org_id)
    if org_names:
        return [{"nombre": n} for n in org_names]

    rows = await conn.fetch("SELECT nombre FROM gerencias ORDER BY nombre")
    return [{"nombre": r["nombre"]} for r in rows]

@app.get("/usuarios")
async def list_usuarios(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("sub")
    if not tenant_id and user_id:
        tenant_id = await conn.fetchval("SELECT tenant_id FROM profiles WHERE id = $1::uuid", user_id)

    is_privileged = await _is_privileged_user(conn, current_user)

    if is_privileged:
        rows = await conn.fetch("""
            SELECT p.id, p.username as usuario_corp, p.nombre, p.apellido, p.email,
                   p.gerencia_id, COALESCE(g.nombre, 'Sin Asignar') as gerencia_depto,
                   p.rol_id, COALESCE(r.nombre_rol, 'Usuario') as role,
                   p.estado, p.ultima_conexion, p.tenant_id, p.permisos,
                   COALESCE(ll.failed_count, 0) AS failed_count,
                   ll.locked_until,
                   CASE WHEN ll.locked_until IS NOT NULL AND ll.locked_until > NOW() THEN TRUE ELSE FALSE END AS is_locked
            FROM profiles p
            LEFT JOIN roles r ON p.rol_id = r.id
            LEFT JOIN gerencias g ON p.gerencia_id = g.id
            LEFT JOIN login_lockouts ll ON LOWER(ll.username) = LOWER(p.username)
            WHERE p.id IS NOT NULL
            ORDER BY p.nombre, p.apellido
        """)
    else:
        rows = await conn.fetch("""
            SELECT p.id, p.username as usuario_corp, p.nombre, p.apellido, p.email,
                   p.gerencia_id, COALESCE(g.nombre, 'Sin Asignar') as gerencia_depto,
                   p.rol_id, COALESCE(r.nombre_rol, 'Usuario') as role,
                   p.estado, p.ultima_conexion, p.tenant_id, p.permisos,
                   COALESCE(ll.failed_count, 0) AS failed_count,
                   ll.locked_until,
                   CASE WHEN ll.locked_until IS NOT NULL AND ll.locked_until > NOW() THEN TRUE ELSE FALSE END AS is_locked
            FROM profiles p
            LEFT JOIN roles r ON p.rol_id = r.id
            LEFT JOIN gerencias g ON p.gerencia_id = g.id
            LEFT JOIN login_lockouts ll ON LOWER(ll.username) = LOWER(p.username)
            WHERE p.estado = TRUE
            ORDER BY p.nombre, p.apellido
        """)
    return [dict(r) for r in rows]


@app.patch("/users/{user_id}/permissions")
async def update_user_permissions(
    user_id: uuid.UUID,
    payload: dict,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    permisos = payload.get("permisos") or []
    if not isinstance(permisos, list):
        raise HTTPException(status_code=400, detail="permisos debe ser una lista")

    await conn.execute(
        "UPDATE profiles SET permisos = $2::text[] WHERE id = $1",
        user_id,
        permisos,
    )
    try:
        await _ensure_security_events_table(conn)
        target_username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'PERMISOS_ACTUALIZADOS', $4, 'info', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Permisos actualizados para usuario {target_username or user_id}. Total permisos={len(permisos)}",
        )
    except Exception:
        pass
    return {"status": "success", "user_id": str(user_id), "permisos": permisos}

@app.put("/users/{user_id}/role")
async def update_user_role(
    user_id: uuid.UUID,
    payload: dict,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    role_id = payload.get("rol_id")
    if role_id not in {1, 2, 3, 4, 5}:
        raise HTTPException(status_code=400, detail="rol_id invalido")

    if role_id == 4:
        master_password = payload.get("master_password")
        if master_password != DEV_ROLE_MASTER_PASSWORD:
            raise HTTPException(status_code=403, detail="Clave maestra invalida para rol Desarrollador")

    exists = await conn.fetchval("SELECT 1 FROM profiles WHERE id = $1", user_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    await conn.execute("UPDATE profiles SET rol_id = $2 WHERE id = $1", user_id, role_id)
    updated = await conn.fetchrow("""
        SELECT p.id, p.username as usuario_corp, p.nombre, p.apellido, p.email,
               p.gerencia_id, COALESCE(g.nombre, 'Sin Asignar') as gerencia_depto,
               p.rol_id, COALESCE(r.nombre_rol, 'Usuario') as role,
               p.estado, p.ultima_conexion, p.tenant_id, p.permisos
        FROM profiles p
        LEFT JOIN roles r ON p.rol_id = r.id
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE p.id = $1
    """, user_id)

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'ROL_ACTUALIZADO', $4, 'info', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Rol de usuario {updated['usuario_corp']} actualizado a {updated['role']}",
        )
    except Exception:
        pass

    return dict(updated)

@app.put("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: uuid.UUID,
    payload: dict,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    new_password = str(payload.get("new_password") or "").strip()
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva clave debe tener al menos 8 caracteres")

    username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1", user_id)
    if not username:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    new_hash = get_password_hash(new_password)
    await conn.execute(
        "UPDATE profiles SET password_hash = $2, estado = TRUE WHERE id = $1",
        user_id,
        new_hash,
    )
    await conn.execute("DELETE FROM login_lockouts WHERE username = LOWER($1)", username)

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'PASSWORD_RESETEADO', $4, 'warning', '/dashboard/security/user')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Clave reseteada para usuario {username}",
        )
    except Exception:
        pass

    return {"status": "success", "user_id": str(user_id), "username": username}

@app.delete("/users/{user_id}")
async def delete_user_account(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    current_user_id = current_user.get("sub")
    if current_user_id and str(current_user_id) == str(user_id):
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")

    row = await conn.fetchrow("SELECT username FROM profiles WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    username = row["username"]

    async with conn.transaction():
        await conn.execute("DELETE FROM login_lockouts WHERE username = LOWER($1)", username)
        await conn.execute("DELETE FROM profiles WHERE id = $1", user_id)

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'USUARIO_ELIMINADO', $4, 'danger', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Usuario eliminado: {username}",
        )
    except Exception:
        pass

    return {"status": "success", "user_id": str(user_id), "username": username}


@app.patch("/users/{user_id}/unlock")
async def unlock_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1", user_id)
    if not username:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    await conn.execute("UPDATE profiles SET estado = TRUE WHERE id = $1", user_id)
    await conn.execute("DELETE FROM login_lockouts WHERE username = LOWER($1)", username)

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'USUARIO_DESBLOQUEADO', $4, 'success', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Se desbloqueo usuario {username}",
        )
    except Exception:
        pass

    return {"status": "success", "user_id": str(user_id), "username": username}


@app.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: uuid.UUID,
    payload: dict,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    status = str(payload.get("status") or "").strip().upper()
    if status not in {"ACTIVO", "INACTIVO", "BLOQUEADO"}:
        raise HTTPException(status_code=400, detail="status invalido")

    row = await conn.fetchrow("SELECT id, username FROM profiles WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    current_user_id = current_user.get("sub")
    if current_user_id and str(current_user_id) == str(user_id) and status in {"INACTIVO", "BLOQUEADO"}:
        raise HTTPException(status_code=400, detail="No puedes desactivarte o bloquearte a ti mismo")

    username = str(row["username"] or "").strip().lower()

    if status == "ACTIVO":
        await conn.execute("UPDATE profiles SET estado = TRUE WHERE id = $1", user_id)
        await conn.execute("DELETE FROM login_lockouts WHERE username = $1", username)
        event = "USUARIO_ACTIVADO"
        detail = f"Usuario {username} marcado como ACTIVO"
        level = "success"
    elif status == "INACTIVO":
        await conn.execute("UPDATE profiles SET estado = FALSE WHERE id = $1", user_id)
        await conn.execute("DELETE FROM login_lockouts WHERE username = $1", username)
        event = "USUARIO_INACTIVADO"
        detail = f"Usuario {username} marcado como INACTIVO"
        level = "warning"
    else:
        await conn.execute("UPDATE profiles SET estado = FALSE WHERE id = $1", user_id)
        await conn.execute(
            """
            INSERT INTO login_lockouts (username, failed_count, locked_until)
            VALUES ($1, 3, NOW() + INTERVAL '3650 days')
            ON CONFLICT (username)
            DO UPDATE SET failed_count = EXCLUDED.failed_count, locked_until = EXCLUDED.locked_until
            """,
            username,
        )
        event = "USUARIO_BLOQUEADO_MANUAL"
        detail = f"Usuario {username} bloqueado manualmente por administrador"
        level = "danger"

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, '/dashboard/security/user')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            event,
            detail,
            level,
        )
    except Exception:
        pass

    return {"status": "success", "user_id": str(user_id), "username": username, "new_status": status}


@app.get("/announcement")
async def get_announcement(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    await _ensure_announcement_table(conn)
    row = await conn.fetchrow("""
        SELECT badge, title, description, status, urgency
        FROM dashboard_announcement
        WHERE id = 1
    """)
    if row:
        return dict(row)

    default_announcement = {
        "badge": "Comunicado del Dia",
        "title": "Actualizacion de Protocolos 2026",
        "description": "Mensaje institucional vigente para todas las gerencias.",
        "status": "Activo",
        "urgency": "Alta",
    }
    await conn.execute(
        """
        INSERT INTO dashboard_announcement (id, badge, title, description, status, urgency, updated_at)
        VALUES (1, $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO NOTHING
        """,
        default_announcement["badge"],
        default_announcement["title"],
        default_announcement["description"],
        default_announcement["status"],
        default_announcement["urgency"],
    )
    return default_announcement


@app.put("/announcement")
async def save_announcement(
    payload: AnnouncementPayload,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado para editar anuncios")

    await _ensure_announcement_table(conn)
    data = payload.model_dump()
    await conn.execute(
        """
        INSERT INTO dashboard_announcement (id, badge, title, description, status, urgency, updated_at)
        VALUES (1, $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
            badge = EXCLUDED.badge,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            urgency = EXCLUDED.urgency,
            updated_at = NOW()
        """,
        data["badge"],
        data["title"],
        data["description"],
        data["status"],
        data["urgency"],
    )
    saved = await conn.fetchrow("""
        SELECT badge, title, description, status, urgency
        FROM dashboard_announcement
        WHERE id = 1
    """)
    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'ANUNCIO_ACTUALIZADO', $4, 'info', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Anuncio actualizado: titulo='{data['title']}' | status='{data['status']}' | urgencia='{data['urgency']}'",
        )
    except Exception:
        pass
    return {"status": "success", "announcement": dict(saved) if saved else data}


@app.get("/org-structure")
async def get_org_structure(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    org_id = await _resolve_org_id(conn, current_user.get("tenant_id"))
    if not org_id:
        raise HTTPException(status_code=500, detail="No existe organizacion base")

    cfg = await conn.fetchval("SELECT config FROM organizations WHERE id = $1::uuid", org_id)
    org_structure = (cfg or {}).get("org_structure") if isinstance(cfg, dict) else None
    source = "config"
    if not org_structure:
        rows = await conn.fetch("SELECT nombre FROM gerencias ORDER BY nombre")
        org_structure = [{
            "category": "Gerencias",
            "icon": "Briefcase",
            "items": [r["nombre"] for r in rows],
        }]
        source = "catalog"
    management_details = (cfg or {}).get("management_details") if isinstance(cfg, dict) else None
    if not isinstance(management_details, dict):
        management_details = {}

    return {"org_structure": org_structure, "management_details": management_details, "source": source}


@app.put("/org-structure")
async def save_org_structure(
    payload: OrgStructurePayload,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado para editar estructura")

    org_id = await _resolve_org_id(conn, current_user.get("tenant_id"))
    if not org_id:
        raise HTTPException(status_code=500, detail="No existe organizacion base")

    normalized_structure: List[Dict[str, Any]] = []
    ordered_unique_names: List[str] = []
    seen_names = set()

    # Normaliza payload y construye lista unica de gerencias para sincronizar catalogos.
    for group in payload.org_structure or []:
        category = str((group or {}).get("category") or "").strip()
        icon = str((group or {}).get("icon") or "Briefcase").strip() or "Briefcase"
        raw_items = (group or {}).get("items") or []
        clean_items: List[str] = []
        for item in raw_items:
            name = str(item or "").strip()
            if not name:
                continue
            clean_items.append(name)
            key = name.lower()
            if key not in seen_names:
                seen_names.add(key)
                ordered_unique_names.append(name)

        if category:
            normalized_structure.append({
                "category": category,
                "icon": icon,
                "items": clean_items,
            })

    current_cfg = await conn.fetchval("SELECT config FROM organizations WHERE id = $1::uuid", org_id)
    previous_structure = (current_cfg or {}).get("org_structure") if isinstance(current_cfg, dict) else None

    def _flatten_names(structure: Any) -> List[str]:
        names: List[str] = []
        if not isinstance(structure, list):
            return names
        for group in structure:
            items = (group or {}).get("items") if isinstance(group, dict) else None
            if not isinstance(items, list):
                continue
            for item in items:
                name = str(item or "").strip()
                if name:
                    names.append(name)
        return names

    previous_names = _flatten_names(previous_structure)

    async with conn.transaction():
        await conn.execute(
            """
            UPDATE organizations
            SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{org_structure}', $2::jsonb, true),
                updated_at = NOW()
            WHERE id = $1::uuid
            """,
            org_id,
            json.dumps(normalized_structure),
        )

        # Si fue una edicion (misma cantidad), intenta renombrar manteniendo IDs para no romper referencias.
        if previous_names and len(previous_names) == len(ordered_unique_names):
            for old_name, new_name in zip(previous_names, ordered_unique_names):
                if old_name.lower() == new_name.lower():
                    continue
                exists_new = await conn.fetchval(
                    "SELECT 1 FROM gerencias WHERE LOWER(nombre) = LOWER($1) LIMIT 1",
                    new_name,
                )
                if not exists_new:
                    await conn.execute(
                        "UPDATE gerencias SET nombre = $1 WHERE LOWER(nombre) = LOWER($2)",
                        new_name,
                        old_name,
                    )

        # Inserta las nuevas gerencias para que Tickets/Mensajeria/Registro consuman el mismo catalogo.
        for name in ordered_unique_names:
            exists = await conn.fetchval(
                "SELECT 1 FROM gerencias WHERE LOWER(nombre) = LOWER($1) LIMIT 1",
                name,
            )
            if not exists:
                await conn.execute("INSERT INTO gerencias (nombre) VALUES ($1)", name)

        # Elimina gerencias fuera de la estructura solo si no estan en uso.
        if ordered_unique_names:
            await conn.execute(
                """
                DELETE FROM gerencias g
                WHERE LOWER(g.nombre) <> ALL($1::text[])
                  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.gerencia_id = g.id)
                  AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.receptor_gerencia_id = g.id)
                """,
                [n.lower() for n in ordered_unique_names],
            )

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'ESTRUCTURA_ORG_ACTUALIZADA', $4, 'info', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Estructura organizativa actualizada: modulos={len(normalized_structure)} | gerencias={len(ordered_unique_names)}",
        )
    except Exception:
        pass

    return {"status": "success", "org_structure": normalized_structure}


@app.get("/org-management-details")
async def get_org_management_details(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    org_id = await _resolve_org_id(conn, current_user.get("tenant_id"))
    if not org_id:
        raise HTTPException(status_code=500, detail="No existe organizacion base")

    cfg = await conn.fetchval("SELECT config FROM organizations WHERE id = $1::uuid", org_id)
    details = (cfg or {}).get("management_details") if isinstance(cfg, dict) else {}
    if not isinstance(details, dict):
        details = {}
    return {"management_details": details}


@app.put("/org-management-details")
async def save_org_management_details(
    payload: OrgManagementDetailsPayload,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    if not await _is_privileged_user(conn, current_user):
        raise HTTPException(status_code=403, detail="No autorizado para editar detalles de gerencia")

    org_id = await _resolve_org_id(conn, current_user.get("tenant_id"))
    if not org_id:
        raise HTTPException(status_code=500, detail="No existe organizacion base")

    normalized: Dict[str, List[str]] = {}
    for key, value in (payload.management_details or {}).items():
        name = str(key or "").strip()
        if not name:
            continue
        lines: List[str] = []
        if isinstance(value, list):
            for item in value:
                text = str(item or "").strip()
                if text:
                    lines.append(text)
        normalized[name] = lines

    await conn.execute(
        """
        UPDATE organizations
        SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{management_details}', $2::jsonb, true),
            updated_at = NOW()
        WHERE id = $1::uuid
        """,
        org_id,
        json.dumps(normalized),
    )

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'DETALLES_GERENCIA_ACTUALIZADOS', $4, 'info', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Detalles de gerencia actualizados: entradas={len(normalized)}",
        )
    except Exception:
        pass

    return {"status": "success", "management_details": normalized}


@app.post("/security/logs")
async def create_security_log(
    payload: SecurityLogPayload,
    request: Request,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    await _ensure_security_events_table(conn)
    user_id = current_user.get("sub")
    tenant_id = current_user.get("tenant_id")
    username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id) if user_id else "anon"
    ip = _extract_client_ip(request)

    row = await conn.fetchrow(
        """
        INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page, ip_origen)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
        RETURNING id, tenant_id, user_id, username, evento, detalles, estado, page, ip_origen, created_at
        """,
        tenant_id, user_id, username, payload.evento, payload.detalles, payload.estado, payload.page, ip
    )
    return dict(row)


@app.get("/security/logs")
async def list_security_logs(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    await _ensure_security_events_table(conn)
    tenant_id = current_user.get("tenant_id")
    rows = await conn.fetch(
        """
        SELECT id, username, evento, detalles, estado, ip_origen as ip_address, created_at as fecha_hora, user_id
        FROM security_events
        WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
        ORDER BY created_at DESC
        LIMIT 2000
        """,
        tenant_id,
    )
    return [dict(r) for r in rows]


@app.get("/security/logs/user/{user_id}")
async def list_security_logs_by_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    await _ensure_security_events_table(conn)
    tenant_id = current_user.get("tenant_id")
    rows = await conn.fetch(
        """
        SELECT id, username, evento, detalles, estado, ip_origen as ip_address, created_at as fecha_hora, user_id
        FROM security_events
        WHERE user_id = $1::uuid AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
        ORDER BY created_at DESC
        LIMIT 2000
        """,
        user_id,
        tenant_id,
    )
    return [dict(r) for r in rows]


@app.get("/tickets", dependencies=[Depends(get_tenant_context)])
async def list_tickets(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_tickets_schema(conn)
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    role_norm = _normalize_text(role)
    is_dev = role_norm in {"desarrollador", "dev", "developer"}
    is_admin = role_norm in {"administrativo", "admin", "administrador"}
    is_ceo = role_norm == "ceo"
    is_privileged = is_dev or is_admin or is_ceo
    is_tech = await _is_tech_user(conn, user_id)

    query = """
        SELECT
            t.id,
            t.titulo,
            t.descripcion,
            t.area,
            t.prioridad,
            t.estado,
            t.solicitante_id,
            t.tecnico_id,
            t.observaciones,
            t.fecha_creacion,
            COALESCE(t.solicitante_nombre_cache, ps.nombre || ' ' || ps.apellido, ps.username, 'Desconocido') AS solicitante_nombre,
            COALESCE(t.solicitante_gerencia_cache, gs.nombre, 'Sin Asignar') AS solicitante_gerencia,
            COALESCE(pt.nombre || ' ' || pt.apellido, pt.username) AS tecnico_nombre
        FROM tickets t
        LEFT JOIN profiles ps ON t.solicitante_id = ps.id
        LEFT JOIN gerencias gs ON ps.gerencia_id = gs.id
        LEFT JOIN profiles pt ON t.tecnico_id = pt.id
        WHERE (
            $1::uuid IS NULL
            OR ps.tenant_id = $1::uuid
            OR pt.tenant_id = $1::uuid
            OR (
                ps.id IS NULL AND pt.id IS NULL
                AND EXISTS (
                    SELECT 1
                    FROM profiles pz
                    WHERE pz.id = t.solicitante_id
                      AND pz.tenant_id = $1::uuid
                )
            )
        )
    """
    params: List[Any] = [tenant_id]
    if not is_privileged and not is_tech:
        query += " AND t.solicitante_id = $2::uuid"
        params.append(user_id)

    query += " ORDER BY t.fecha_creacion DESC"
    rows = await conn.fetch(query, *params)
    return [dict(r) for r in rows]


@app.get("/tickets/history", dependencies=[Depends(get_tenant_context)])
async def search_ticket_history(
    q: str = "",
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    tenant_id = current_user.get("tenant_id")
    await _ensure_ticket_events_table(conn)
    rows = await conn.fetch(
        """
        SELECT
            e.id, e.ticket_id, e.actor_username, e.action, e.old_status, e.new_status,
            e.observaciones, e.details, e.created_at,
            t.titulo, t.estado
        FROM ticket_events e
        LEFT JOIN tickets t ON t.id = e.ticket_id
        WHERE ($1::uuid IS NULL OR e.tenant_id = $1::uuid)
          AND (
                $2::text = ''
                OR COALESCE(t.titulo, '') ILIKE '%' || $2 || '%'
                OR CAST(e.ticket_id AS TEXT) ILIKE '%' || $2 || '%'
                OR COALESCE(e.details, '') ILIKE '%' || $2 || '%'
              )
        ORDER BY e.created_at DESC
        LIMIT 500
        """,
        tenant_id,
        q.strip(),
    )
    return [dict(r) for r in rows]


@app.get("/tickets/{ticket_id}/history", dependencies=[Depends(get_tenant_context)])
async def list_ticket_history(
    ticket_id: int,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    tenant_id = current_user.get("tenant_id")
    await _ensure_ticket_events_table(conn)
    rows = await conn.fetch(
        """
        SELECT id, ticket_id, actor_username, action, old_status, new_status,
               observaciones, details, created_at
        FROM ticket_events
        WHERE ticket_id = $1
          AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
        ORDER BY created_at ASC
        """,
        ticket_id,
        tenant_id,
    )
    return [dict(r) for r in rows]


@app.post("/tickets", dependencies=[Depends(get_tenant_context)])
async def create_ticket(
    payload: TicketCreate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_tickets_schema(conn)
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")
    tenant_id = current_user.get("tenant_id")
    is_tech = await _is_tech_user(conn, user_id)
    observations = payload.observaciones if is_tech else None

    creator_name = await conn.fetchval(
        "SELECT COALESCE(nombre || ' ' || apellido, username, 'Desconocido') FROM profiles WHERE id = $1::uuid",
        user_id,
    )
    creator_dept = await conn.fetchval(
        """
        SELECT COALESCE(g.nombre, 'Sin Asignar')
        FROM profiles p
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE p.id = $1::uuid
        """,
        user_id,
    )

    row = await conn.fetchrow("""
        INSERT INTO tickets (
            titulo, descripcion, area, prioridad, estado, solicitante_id, observaciones,
            solicitante_nombre_cache, solicitante_gerencia_cache
        )
        VALUES ($1, $2, $3, $4, 'abierto', $5::uuid, $6, $7, $8)
        RETURNING id, titulo, descripcion, area, prioridad, estado, solicitante_id, tecnico_id, observaciones, fecha_creacion
    """,
        payload.titulo.strip(),
        payload.descripcion,
        "Gerencia Nacional de Tecnologias de la informacion y la comunicacion",
        (payload.prioridad or "media").lower(),
        user_id,
        observations,
        creator_name,
        creator_dept,
    )

    try:
        await _ensure_security_events_table(conn)
        username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'TICKET_CREADO', $4, 'success', '/dashboard?tab=tickets')
            """,
            tenant_id,
            user_id,
            username or "anon",
            f"Ticket #{row['id']} creado | titulo='{row['titulo']}' | area='{row['area']}' | prioridad='{row['prioridad']}'",
        )
    except Exception:
        pass
    try:
        username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
        await _log_ticket_event(
            conn,
            int(row["id"]),
            tenant_id,
            user_id,
            username or "anon",
            "CREATED",
            old_status=None,
            new_status="abierto",
            observaciones=observations,
            details=f"Ticket creado: {row['titulo']}",
        )
    except Exception:
        pass

    return dict(row)


@app.put("/tickets/{ticket_id}", dependencies=[Depends(get_tenant_context)])
async def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_tickets_schema(conn)
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")
    role_norm = _normalize_text(role)
    is_dev = role_norm in {"desarrollador", "dev", "developer"}
    is_admin = role_norm in {"administrativo", "admin", "administrador"}
    is_ceo = role_norm == "ceo"

    current_row = await conn.fetchrow("SELECT solicitante_id, titulo, prioridad FROM tickets WHERE id = $1", ticket_id)
    owner_id = current_row["solicitante_id"] if current_row else None
    if not owner_id:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if is_ceo:
        raise HTTPException(status_code=403, detail="CEO solo tiene acceso de lectura")
    if str(owner_id) != str(user_id) and not (is_admin or is_dev):
        raise HTTPException(status_code=403, detail="No autorizado para editar este ticket")

    is_tech = await _is_tech_user(conn, user_id)
    can_manage_ticket = is_dev or is_admin or is_tech
    obs_value = payload.observaciones if can_manage_ticket else None
    tenant_id = current_user.get("tenant_id")
    next_priority = payload.prioridad if can_manage_ticket else None

    updated = await conn.fetchrow("""
        UPDATE tickets
        SET
            titulo = COALESCE($2, titulo),
            descripcion = COALESCE($3, descripcion),
            prioridad = COALESCE($4, prioridad),
            observaciones = CASE
                WHEN $6::boolean = TRUE THEN COALESCE($5, observaciones)
                ELSE observaciones
            END
        WHERE id = $1
        RETURNING id, titulo, descripcion, area, prioridad, estado, solicitante_id, tecnico_id, observaciones, fecha_creacion
    """, ticket_id, payload.titulo, payload.descripcion, next_priority, obs_value, can_manage_ticket)

    try:
        await _ensure_security_events_table(conn)
        username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'TICKET_EDITADO', $4, 'info', '/dashboard?tab=tickets')
            """,
            tenant_id,
            user_id,
            username or "anon",
            f"Ticket #{updated['id']} editado | titulo='{updated['titulo']}' | prioridad='{updated['prioridad']}'",
        )
    except Exception:
        pass
    try:
        username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
        await _log_ticket_event(
            conn,
            int(updated["id"]),
            tenant_id,
            user_id,
            username or "anon",
            "UPDATED",
            old_status=None,
            new_status=updated["estado"],
            observaciones=obs_value,
            details=f"Ticket editado: '{current_row['titulo']}' -> '{updated['titulo']}' | prioridad '{current_row['prioridad']}' -> '{updated['prioridad']}'",
        )
    except Exception:
        pass

    return dict(updated)


@app.patch("/tickets/{ticket_id}/estado", dependencies=[Depends(get_tenant_context)])
async def update_ticket_status(
    ticket_id: int,
    payload: TicketStatusUpdate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_tickets_schema(conn)
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    role_norm = _normalize_text(role)
    is_dev = role_norm in {"desarrollador", "dev", "developer"}
    is_admin = role_norm in {"administrativo", "admin", "administrador"}
    is_ceo = role_norm == "ceo"

    current = await conn.fetchrow("SELECT id, estado, solicitante_id FROM tickets WHERE id = $1", ticket_id)
    if not current:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    next_status = _normalize_text(payload.estado).replace(" ", "-")
    if next_status not in {"abierto", "en-proceso", "resuelto"}:
        raise HTTPException(status_code=400, detail="Estado invalido")

    is_tech = await _is_tech_user(conn, user_id)
    can_manage_ticket = is_dev or is_admin or is_tech
    if is_ceo:
        raise HTTPException(status_code=403, detail="CEO solo tiene acceso de lectura")
    if not can_manage_ticket:
        raise HTTPException(status_code=403, detail="No autorizado para cambiar este ticket")
    if payload.observaciones and not can_manage_ticket:
        raise HTTPException(status_code=403, detail="No autorizado para registrar observaciones")

    tecnico_id = user_id if next_status in {"en-proceso", "resuelto"} else None
    tenant_id = current_user.get("tenant_id")
    updated = await conn.fetchrow("""
        UPDATE tickets
        SET
            estado = $2,
            tecnico_id = CASE WHEN $3::uuid IS NULL THEN tecnico_id ELSE $3::uuid END,
            observaciones = COALESCE($4, observaciones)
        WHERE id = $1
        RETURNING id, titulo, descripcion, area, prioridad, estado, solicitante_id, tecnico_id, observaciones, fecha_creacion
    """, ticket_id, next_status, tecnico_id, payload.observaciones)

    try:
        await _ensure_security_events_table(conn)
        username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'TICKET_ESTADO_ACTUALIZADO', $4, 'info', '/dashboard?tab=tickets')
            """,
            tenant_id,
            user_id,
            username or "anon",
            f"Ticket #{updated['id']} cambio a estado='{updated['estado']}' | tecnico='{updated['tecnico_id']}'",
        )
    except Exception:
        pass
    try:
        username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
        await _log_ticket_event(
            conn,
            int(updated["id"]),
            tenant_id,
            user_id,
            username or "anon",
            "STATUS_CHANGED",
            old_status=current["estado"],
            new_status=updated["estado"],
            observaciones=payload.observaciones,
            details=f"Cambio de estado de '{current['estado']}' a '{updated['estado']}'",
        )
    except Exception:
        pass

    return dict(updated)


@app.delete("/tickets/{ticket_id}", dependencies=[Depends(get_tenant_context)])
async def delete_ticket(
    ticket_id: int,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_tickets_schema(conn)
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")
    role_norm = _normalize_text(role)
    is_dev = role_norm in {"desarrollador", "dev", "developer"}
    is_admin = role_norm in {"administrativo", "admin", "administrador"}
    is_ceo = role_norm == "ceo"
    is_tech = await _is_tech_user(conn, user_id)

    owner_id = await conn.fetchval("SELECT solicitante_id FROM tickets WHERE id = $1", ticket_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if str(owner_id) != str(user_id) and not (is_admin or is_dev or is_ceo or is_tech):
        raise HTTPException(status_code=403, detail="No autorizado para eliminar este ticket")

    tenant_id = current_user.get("tenant_id")
    username = await conn.fetchval("SELECT username FROM profiles WHERE id = $1::uuid", user_id)
    deleted = await conn.fetchrow(
        """
        UPDATE tickets
        SET
            estado = 'eliminado',
            observaciones = COALESCE(observaciones, '') || CASE
                WHEN COALESCE(observaciones, '') = '' THEN ''
                ELSE E'\n'
            END || 'Eliminado por ' || COALESCE($2, 'usuario') || ' el ' || to_char(NOW(), 'DD/MM/YYYY HH24:MI')
        WHERE id = $1
        RETURNING id, titulo, estado
        """,
        ticket_id,
        username or "usuario",
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'TICKET_ELIMINADO', $4, 'warning', '/dashboard?tab=tickets')
            """,
            tenant_id,
            user_id,
            username or "anon",
            f"Ticket #{ticket_id} eliminado",
        )
    except Exception:
        pass
    try:
        await _log_ticket_event(
            conn,
            int(ticket_id),
            tenant_id,
            user_id,
            username or "anon",
            "DELETED",
            old_status=None,
            new_status="eliminado",
            observaciones=None,
            details=f"Ticket eliminado: {deleted['titulo']}",
        )
    except Exception:
        pass
    return {"status": "success"}


@app.get("/api/chat/knowledge", dependencies=[Depends(get_tenant_context)])
async def list_knowledge(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_knowledge_table(conn)
    rows = await conn.fetch("""
        SELECT id, question, answer, updated_by, updated_at
        FROM bot_knowledge
        ORDER BY updated_at DESC
    """)
    return {"knowledge": [dict(r) for r in rows]}


@app.post("/api/chat/knowledge", dependencies=[Depends(get_tenant_context)])
async def upsert_knowledge(
    payload: KnowledgeCreate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_knowledge_table(conn)
    if not _is_privileged_role(current_user.get("role")):
        raise HTTPException(status_code=403, detail="Solo Desarrollador o Administrativo pueden entrenar")

    question = _normalize_text(payload.question)
    answer = (payload.answer or "").strip()
    if not question or not answer:
        raise HTTPException(status_code=400, detail="question y answer son requeridos")

    await conn.execute("""
        INSERT INTO bot_knowledge (question, answer, updated_by, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (question)
        DO UPDATE SET answer = EXCLUDED.answer, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    """, question, answer, payload.updatedBy or current_user.get("role") or "unknown")

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'BOT_KNOWLEDGE_UPSERT', $4, 'info', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Knowledge entrenado/actualizado: question='{question[:120]}'",
        )
    except Exception:
        pass

    rows = await conn.fetch("SELECT id, question, answer, updated_by, updated_at FROM bot_knowledge ORDER BY updated_at DESC")
    return {"knowledge": [dict(r) for r in rows]}


@app.delete("/api/chat/knowledge/{knowledge_id}", dependencies=[Depends(get_tenant_context)])
async def delete_knowledge(
    knowledge_id: int,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    await _ensure_knowledge_table(conn)
    if not _is_privileged_role(current_user.get("role")):
        raise HTTPException(status_code=403, detail="No autorizado")
    question = await conn.fetchval("SELECT question FROM bot_knowledge WHERE id = $1", knowledge_id)
    await conn.execute("DELETE FROM bot_knowledge WHERE id = $1", knowledge_id)

    try:
        await _ensure_security_events_table(conn)
        await conn.execute(
            """
            INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page)
            VALUES ($1::uuid, $2::uuid, $3, 'BOT_KNOWLEDGE_DELETE', $4, 'warning', '/dashboard?tab=seguridad')
            """,
            current_user.get("tenant_id"),
            current_user.get("sub"),
            current_user.get("username") or "admin",
            f"Knowledge eliminado id={knowledge_id} question='{str(question or '')[:120]}'",
        )
    except Exception:
        pass

    rows = await conn.fetch("SELECT id, question, answer, updated_by, updated_at FROM bot_knowledge ORDER BY updated_at DESC")
    return {"knowledge": [dict(r) for r in rows]}


@app.post("/api/chat")
async def chat_endpoint(
    payload: dict,
    conn = Depends(get_db_connection)
):
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message requerido")

    normalized = _normalize_text(message)
    try:
        await _ensure_knowledge_table(conn)
        knowledge_rows = await conn.fetch(
            "SELECT question, answer FROM bot_knowledge ORDER BY updated_at DESC LIMIT 500"
        )
        for item in knowledge_rows:
            learned_q = _normalize_text(item["question"])
            if normalized == learned_q or normalized in learned_q or learned_q in normalized:
                return {"response": item["answer"]}
    except Exception:
        knowledge_rows = []

    if "hola" in normalized:
        return {"response": "Hola, estoy en linea para ayudarte con el sistema."}
    if "ticket" in normalized:
        return {"response": "Los tickets se enrutan a Tecnologia y un tecnico puede tomarlo desde el tablero."}
    if "documento" in normalized:
        return {"response": "Puedes enviar documentos desde Mensajeria Interna y hacer seguimiento por estado."}

    return {"response": "Recibido. Si no encuentro una respuesta entrenada, puedo ayudarte con una guia general del sistema."}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

