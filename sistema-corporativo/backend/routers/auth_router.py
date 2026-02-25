from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid
from database.async_db import get_db_connection
from auth.security import verify_password, get_password_hash, create_access_token
from auth.supabase_auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["auth"])

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
async def register(user_data: UserRegister, conn = Depends(get_db_connection)):
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
        
        return {
            "message": "User registered successfully",
            "user_id": str(row['id']),
            "email": row['email']
        }
    except Exception as e:
        print(f"Error registering user: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(login_data: UserLogin, conn = Depends(get_db_connection)):
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
async def logout():
    return {"message": "Logged out successfully"}
