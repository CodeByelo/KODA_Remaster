import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from pathlib import Path

# Cargar .env explícitamente desde la carpeta backend
env_path = Path(__file__).parent / ".env"
print(f"\n🔍 Buscando .env en: {env_path}")
print(f"📁 Existe: {env_path.exists()}\n")

load_dotenv(dotenv_path=env_path)

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
from database.async_db import get_db_connection, init_db_pool, pool
from middleware.tenant import get_tenant_context, trace_id_var
from services.rate_limiter import rate_limiter_middleware
from src import schemas
from routers import auth_router, users_router
from auth.supabase_auth import get_current_user
from pydantic import BaseModel

import json

# ===================================================================
# CONFIGURACIÓN DE LOGGING ESTRUCTURADO JSON ENTERPRISE
# ===================================================================
from middleware.context import (
    get_current_tenant_id, 
    get_current_user_id, 
    get_current_trace_id, 
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
    
    try:
        response = await call_next(request)
        duration_ms = int((time.time() - start_time) * 1000)
        
        logger.info(
            f"HTTP {request.method} {request.url.path} - {response.status_code}",
            extra={"duration_ms": duration_ms}
        )
        return response
    finally:
        trace_id_var.reset(token)

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
    await init_db_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS bot_knowledge (
                    id BIGSERIAL PRIMARY KEY,
                    question TEXT NOT NULL UNIQUE,
                    answer TEXT NOT NULL,
                    updated_by TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
    except Exception as exc:
        logger.warning(f"No se pudo garantizar bot_knowledge en startup: {exc}")
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
        "message": str(exc),
        "type": type(exc).__name__
    }
    
    # En desarrollo, enviamos el trace al frontend para diagnóstico rápido
    if os.getenv("DEBUG", "false").lower() == "true":
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
    form_data: OAuth2PasswordRequestForm = Depends(),
    conn = Depends(get_db_connection)
):
    # Reutiliza la misma lógica del endpoint /api/login
    query = """
        SELECT p.id, p.username, p.password_hash, p.nombre, p.apellido, p.email, p.rol_id, r.nombre_rol, p.tenant_id,
               p.gerencia_id, g.nombre as gerencia_nombre
        FROM profiles p
        LEFT JOIN roles r ON p.rol_id = r.id
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE p.username = $1 AND p.estado = TRUE
    """
    user = await conn.fetchrow(query, form_data.username)

    if not user or not verify_password(form_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    access_token = create_access_token(
        data={
            "sub": str(user['id']), 
            "role": user['nombre_rol'],
            "tenant_id": str(user['tenant_id']) if user['tenant_id'] else None,
            "gerencia_id": user['gerencia_id']
        }
    )

    await conn.execute(
        "UPDATE profiles SET ultima_conexion = $1 WHERE id = $2", 
        datetime.now(), user['id']
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user['id']),
            "username": user['username'],
            "nombre": user['nombre'],
            "apellido": user['apellido'],
            "email": user['email'],
            "role": user['nombre_rol'],
            "tenant_id": user['tenant_id'],
            "gerencia_id": user['gerencia_id'],
            "gerencia_depto": user['gerencia_nombre']
        }
    }


def _is_privileged_role(role_name: Optional[str]) -> bool:
    if not role_name:
        return False
    role = str(role_name).strip().lower()
    return role in {
        "desarrollador",
        "administrativo",
        "ceo",
        "admin",
        "administrador",
    }


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
        if not tenant_id:
            raise HTTPException(status_code=403, detail="Usuario sin tenant activo")

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
                d.receptor_id,
                d.receptor_gerencia_id,
                COALESCE(p_rec.nombre || ' ' || p_rec.apellido, g.nombre, 'Sin Asignar') as receptor_nombre,
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
            WHERE ($1::uuid IS NULL OR d.tenant_id = $1::uuid)
            ORDER BY d.fecha_creacion DESC
        """
        rows = await conn.fetch(query, tenant_id)
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
import shutil

@app.post("/documentos", dependencies=[Depends(get_tenant_context)])
async def create_documento(
    request: Request,
    titulo: str = Form(...),
    correlativo_user: Optional[str] = Form(None, alias="correlativo"),
    tipo_documento: str = Form(...),
    prioridad: str = Form("media"),
    receptor_gerencia_id: Optional[int] = Form(None),
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

        if not tenant_id:
            raise HTTPException(status_code=403, detail="Usuario sin tenant activo")
        
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
        
        auto_correlativo = f"{siglas}-{str((count or 0) + 1).zfill(3)}-{year}"
        
        # ========== 4. PROCESAR MÚLTIPLES ARCHIVOS ==========
        file_urls = []
        if archivos:
            folder = Path("uploads")
            folder.mkdir(exist_ok=True)
            for archivo in archivos:
                if archivo and archivo.filename:
                    ext = Path(archivo.filename).suffix
                    file_id = f"{uuid.uuid4()}{ext}"
                    filepath = folder / file_id
                    with filepath.open("wb") as buffer:
                        shutil.copyfileobj(archivo.file, buffer)
                    file_urls.append(f"/uploads/{file_id}")

        # Guardamos la primera URL en la tabla principal para compatibilidad legacy
        primary_file_url = file_urls[0] if file_urls else None

        # ========== 5. INSERTAR EN BD ==========
        fecha_creacion = datetime.now()
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
            titulo, titulo, auto_correlativo, tipo_documento, 'en-proceso', prioridad,
            user_id, receptor_id, receptor_gerencia_id, primary_file_url,
            contenido, False, fecha_creacion, fecha_caducidad, fecha_creacion, tenant_id, user_id
        )

        # ========== 6. INSERTAR ADJUNTOS EN TABLA RELACIONADA ==========
        for url in file_urls:
            await conn.execute("""
                INSERT INTO documento_adjuntos (documento_id, url_archivo)
                VALUES ($1, $2)
            """, doc_id, url)
        
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
        if not tenant_id:
            raise HTTPException(status_code=403, detail="Usuario sin tenant activo")
        await conn.execute(
            "UPDATE documentos SET leido = TRUE WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2::uuid)",
            id,
            tenant_id,
        )
        return {"status": "success"}
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
        if not tenant_id:
            raise HTTPException(status_code=403, detail="Usuario sin tenant activo")
        nuevo_estado = status_data.get("estado")
        await conn.execute("""
            UPDATE documentos 
            SET estado = $1, fecha_ultima_actividad = NOW() 
            WHERE id = $2 AND ($3::uuid IS NULL OR tenant_id = $3::uuid)
        """, nuevo_estado, id, tenant_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/gerencias")
async def list_gerencias(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    rows = await conn.fetch("SELECT id, nombre, siglas FROM gerencias ORDER BY nombre")
    return [dict(r) for r in rows]

@app.get("/usuarios")
async def list_usuarios(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    if not _is_privileged_role(current_user.get("role")):
        raise HTTPException(status_code=403, detail="No autorizado para listar usuarios")

    rows = await conn.fetch("""
        SELECT p.id, p.username as usuario_corp, p.nombre, p.apellido, p.email,
               p.gerencia_id, COALESCE(g.nombre, 'Sin Asignar') as gerencia_depto,
               p.rol_id, COALESCE(r.nombre_rol, 'Usuario') as role,
               p.estado, p.ultima_conexion, p.tenant_id
        FROM profiles p
        LEFT JOIN roles r ON p.rol_id = r.id
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE p.estado = TRUE
        ORDER BY p.nombre, p.apellido
    """)
    return [dict(r) for r in rows]


@app.get("/tickets", dependencies=[Depends(get_tenant_context)])
async def list_tickets(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    is_privileged = _is_privileged_role(role)
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
            COALESCE(ps.nombre || ' ' || ps.apellido, ps.username, 'Desconocido') AS solicitante_nombre,
            COALESCE(pt.nombre || ' ' || pt.apellido, pt.username) AS tecnico_nombre
        FROM tickets t
        LEFT JOIN profiles ps ON t.solicitante_id = ps.id
        LEFT JOIN profiles pt ON t.tecnico_id = pt.id
        WHERE ($1::uuid IS NULL OR ps.tenant_id = $1::uuid OR pt.tenant_id = $1::uuid)
    """
    params: List[Any] = [tenant_id]
    if not is_privileged and not is_tech:
        query += " AND t.solicitante_id = $2::uuid"
        params.append(user_id)

    query += " ORDER BY t.fecha_creacion DESC"
    rows = await conn.fetch(query, *params)
    return [dict(r) for r in rows]


@app.post("/tickets", dependencies=[Depends(get_tenant_context)])
async def create_ticket(
    payload: TicketCreate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    row = await conn.fetchrow("""
        INSERT INTO tickets (titulo, descripcion, area, prioridad, estado, solicitante_id, observaciones)
        VALUES ($1, $2, $3, $4, 'abierto', $5::uuid, $6)
        RETURNING id, titulo, descripcion, area, prioridad, estado, solicitante_id, tecnico_id, observaciones, fecha_creacion
    """,
        payload.titulo.strip(),
        payload.descripcion,
        "Gerencia Nacional de Tecnologias de la informacion y la comunicacion",
        (payload.prioridad or "media").lower(),
        user_id,
        payload.observaciones,
    )
    return dict(row)


@app.put("/tickets/{ticket_id}", dependencies=[Depends(get_tenant_context)])
async def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    owner_id = await conn.fetchval("SELECT solicitante_id FROM tickets WHERE id = $1", ticket_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if str(owner_id) != str(user_id) and not _is_privileged_role(role):
        raise HTTPException(status_code=403, detail="No autorizado para editar este ticket")

    updated = await conn.fetchrow("""
        UPDATE tickets
        SET
            titulo = COALESCE($2, titulo),
            descripcion = COALESCE($3, descripcion),
            prioridad = COALESCE($4, prioridad),
            observaciones = COALESCE($5, observaciones)
        WHERE id = $1
        RETURNING id, titulo, descripcion, area, prioridad, estado, solicitante_id, tecnico_id, observaciones, fecha_creacion
    """, ticket_id, payload.titulo, payload.descripcion, payload.prioridad, payload.observaciones)
    return dict(updated)


@app.patch("/tickets/{ticket_id}/estado", dependencies=[Depends(get_tenant_context)])
async def update_ticket_status(
    ticket_id: int,
    payload: TicketStatusUpdate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    current = await conn.fetchrow("SELECT id, estado, solicitante_id FROM tickets WHERE id = $1", ticket_id)
    if not current:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    next_status = _normalize_text(payload.estado).replace(" ", "-")
    if next_status not in {"abierto", "en-proceso", "resuelto"}:
        raise HTTPException(status_code=400, detail="Estado invalido")

    is_tech = await _is_tech_user(conn, user_id)
    is_owner = str(current["solicitante_id"]) == str(user_id)
    if not _is_privileged_role(role) and not is_owner and not is_tech:
        raise HTTPException(status_code=403, detail="No autorizado para cambiar este ticket")
    if next_status in {"en-proceso", "resuelto"} and not is_tech:
        raise HTTPException(status_code=403, detail="Solo Tecnologia puede tomar o resolver tickets")

    tecnico_id = user_id if next_status in {"en-proceso", "resuelto"} else None
    updated = await conn.fetchrow("""
        UPDATE tickets
        SET
            estado = $2,
            tecnico_id = CASE WHEN $3::uuid IS NULL THEN tecnico_id ELSE $3::uuid END,
            observaciones = COALESCE($4, observaciones)
        WHERE id = $1
        RETURNING id, titulo, descripcion, area, prioridad, estado, solicitante_id, tecnico_id, observaciones, fecha_creacion
    """, ticket_id, next_status, tecnico_id, payload.observaciones)
    return dict(updated)


@app.delete("/tickets/{ticket_id}", dependencies=[Depends(get_tenant_context)])
async def delete_ticket(
    ticket_id: int,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalido")

    owner_id = await conn.fetchval("SELECT solicitante_id FROM tickets WHERE id = $1", ticket_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if str(owner_id) != str(user_id) and not _is_privileged_role(role):
        raise HTTPException(status_code=403, detail="No autorizado para eliminar este ticket")

    await conn.execute("DELETE FROM tickets WHERE id = $1", ticket_id)
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
    await conn.execute("DELETE FROM bot_knowledge WHERE id = $1", knowledge_id)
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
