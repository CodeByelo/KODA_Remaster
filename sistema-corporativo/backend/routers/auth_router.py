from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid
from database.async_db import get_db_connection
from auth.security import verify_password, get_password_hash, create_access_token
from auth.supabase_auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["auth"])


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
            gerencia_id INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


async def _log_security_event(conn, *, tenant_id, user_id, username, evento, detalles=None, estado="info", page=None, ip_origen=None, gerencia_id=None):
    await _ensure_security_events_table(conn)
    await conn.execute(
        """
        INSERT INTO security_events (tenant_id, user_id, username, evento, detalles, estado, page, ip_origen, gerencia_id)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
        """,
        tenant_id,
        user_id,
        username or "anon",
        evento,
        detalles,
        estado,
        page,
        ip_origen,
        gerencia_id,
    )


def _extract_client_ip(request: Request) -> Optional[str]:
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
        return ip
    return None

@router.get("/me")
async def get_user_profile(
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    try:
        query = """
            SELECT p.id, p.username, p.nombre, p.apellido, p.email, g.nombre as gerencia_nombre, p.rol_id, r.nombre_rol as role
            FROM profiles p
            LEFT JOIN gerencias g ON p.gerencia_id = g.id
            LEFT JOIN roles r ON p.rol_id = r.id
            WHERE p.id = $1
        """
        profile = await conn.fetchrow(query, uuid.UUID(user_id))
        
        if not profile:
             raise HTTPException(status_code=404, detail="Profile not found")

        return dict(profile)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching profile: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener perfil")

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    nombre: str
    apellido: str
    username: str
    gerencia_nombre: str

class UserLogin(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: str

@router.post("/register")
async def register(user_data: UserRegister, request: Request, conn = Depends(get_db_connection)):
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM profiles WHERE username = $1 OR email = $2", 
            user_data.username, user_data.email
        )
        if existing:
            raise HTTPException(status_code=400, detail="Usuario o Email ya registrado")

        hashed_pw = get_password_hash(user_data.password)
        
        # Mapear gerencia si es posible
        g_id = await conn.fetchval("SELECT id FROM gerencias WHERE nombre = $1", user_data.gerencia_nombre)
        if not g_id:
            g_id = await conn.fetchval(
                "INSERT INTO gerencias (nombre) VALUES ($1) RETURNING id", 
                user_data.gerencia_nombre
            )

        query = """
            INSERT INTO profiles (username, nombre, apellido, email, password_hash, rol_id, gerencia_id, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, username, email
        """
        row = await conn.fetchrow(
            query, 
            user_data.username, user_data.nombre, user_data.apellido, 
            user_data.email, hashed_pw, 3, g_id, True
        )
        
        await _log_security_event(
            conn,
            tenant_id=None,
            user_id=row["id"],
            username=row["email"],
            evento="REGISTER",
            detalles=f"Registro de usuario {row['email']}",
            estado="success",
            page="/auth/register",
            ip_origen=_extract_client_ip(request),
            gerencia_id=g_id,
        )
        return {
            "message": "User registered successfully",
            "user_id": str(row['id']),
            "email": row['email']
        }
    except Exception as e:
        try:
            await _log_security_event(
                conn,
                tenant_id=None,
                user_id=None,
                username=user_data.email,
                evento="REGISTER_FAILED",
                detalles=str(e),
                estado="error",
                page="/auth/register",
                ip_origen=_extract_client_ip(request),
            )
        except Exception:
            pass
        print(f"Error registering user: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(login_data: UserLogin, request: Request, conn = Depends(get_db_connection)):
    query = """
        SELECT p.id, p.username, p.nombre, p.apellido, p.password_hash, p.email, 
               p.rol_id, r.nombre_rol, p.tenant_id, p.gerencia_id, g.nombre as gerencia_nombre
        FROM profiles p
        LEFT JOIN roles r ON p.rol_id = r.id
        LEFT JOIN gerencias g ON p.gerencia_id = g.id
        WHERE (p.email = $1 OR p.username = $1) AND p.estado = TRUE
    """
    identifier = login_data.email or login_data.username
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or Username required")
        
    user = await conn.fetchrow(query, identifier)

    if not user or not verify_password(login_data.password, user['password_hash']):
        await _log_security_event(
            conn,
            tenant_id=None,
            user_id=None,
            username=identifier,
            evento="LOGIN_FAILED",
            detalles="Credenciales incorrectas",
            estado="warning",
            page="/auth/login",
            ip_origen=_extract_client_ip(request),
            gerencia_id=user["gerencia_id"] if user else None,
        )
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    access_token = create_access_token(
        data={
            "sub": str(user['id']), 
            "role": user['nombre_rol'],
            "tenant_id": str(user['tenant_id']) if user['tenant_id'] else None,
            "gerencia_id": user['gerencia_id']
        }
    )
    
    # Actualizar última conexión
    await conn.execute("UPDATE profiles SET ultima_conexion = NOW() WHERE id = $1", user['id'])
    
    await _log_security_event(
        conn,
        tenant_id=user["tenant_id"],
        user_id=user["id"],
        username=user["username"],
        evento="LOGIN",
        detalles=f"Login exitoso ({user['username']})",
        estado="success",
        page="/auth/login",
        ip_origen=_extract_client_ip(request),
        gerencia_id=user["gerencia_id"],
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
            "gerencia_id": user['gerencia_id'],
            "gerencia_depto": user['gerencia_nombre']
        }
    }

@router.post("/logout")
async def logout(
    request: Request,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection),
):
    try:
        await _log_security_event(
            conn,
            tenant_id=current_user.get("tenant_id"),
            user_id=current_user.get("sub"),
            username=current_user.get("username") or current_user.get("email"),
            evento="LOGOUT",
            detalles="Logout de usuario",
            estado="info",
            page="/auth/logout",
            ip_origen=_extract_client_ip(request),
            gerencia_id=current_user.get("gerencia_id"),
        )
    except Exception:
        pass
    return {"message": "Logged out successfully"}
