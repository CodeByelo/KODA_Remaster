import os

from fastapi import APIRouter, Depends, HTTPException, Request
from database.async_db import get_db_connection
from auth.supabase_auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])
DEV_ROLE_MASTER_PASSWORD = os.getenv("DEV_ROLE_MASTER_PASSWORD", "")


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


def _is_privileged_role(role_name: str) -> bool:
    if not role_name:
        return False
    role = str(role_name).strip().lower()
    return role in {"desarrollador", "administrativo", "ceo", "admin", "administrador"}

@router.get("/all")
async def list_all_users(
    request: Request,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    try:
        if not _is_privileged_role(current_user.get("role")):
            raise HTTPException(status_code=403, detail="No autorizado")

        query = """
            SELECT p.id, p.username, p.nombre, p.apellido, p.email, p.rol_id, r.nombre_rol as role, p.estado
            FROM profiles p
            LEFT JOIN roles r ON p.rol_id = r.id
            ORDER BY p.username
        """
        rows = await conn.fetch(query)
        await _log_security_event(
            conn,
            tenant_id=current_user.get("tenant_id"),
            user_id=current_user.get("sub"),
            username=current_user.get("username"),
            evento="USERS_LIST",
            detalles="Listado de usuarios",
            estado="info",
            page="/users/all",
            ip_origen=request.client.host if request.client else None,
            gerencia_id=current_user.get("gerencia_id"),
        )
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener usuarios: {str(e)}")

@router.put("/{user_id}/role")
async def update_user_role(
    user_id: str,
    data: dict,
    request: Request,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    try:
        if not _is_privileged_role(current_user.get("role")):
            raise HTTPException(status_code=403, detail="No autorizado")

        rol_id = data.get("rol_id")
        if not rol_id:
            raise HTTPException(status_code=400, detail="rol_id es requerido")
        if rol_id not in {1, 2, 3, 4, 5}:
            raise HTTPException(status_code=400, detail="rol_id invalido")

        # Requiere clave maestra para asignar rol Desarrollador (rol_id=4)
        if rol_id == 4:
            master_password = str(data.get("master_password") or "")
            if not DEV_ROLE_MASTER_PASSWORD or master_password != DEV_ROLE_MASTER_PASSWORD:
                raise HTTPException(status_code=403, detail="Clave maestra invalida para rol Desarrollador")
            
        await conn.execute(
            "UPDATE profiles SET rol_id = $1 WHERE id = $2",
            rol_id, user_id
        )
        await _log_security_event(
            conn,
            tenant_id=current_user.get("tenant_id"),
            user_id=current_user.get("sub"),
            username=current_user.get("username"),
            evento="USER_ROLE_UPDATED",
            detalles=f"Rol actualizado para user_id={user_id} rol_id={rol_id}",
            estado="warning",
            page=f"/users/{user_id}/role",
            ip_origen=request.client.host if request.client else None,
            gerencia_id=current_user.get("gerencia_id"),
        )
        return {"message": "Rol actualizado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
