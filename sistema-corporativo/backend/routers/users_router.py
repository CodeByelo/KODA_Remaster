import os

from fastapi import APIRouter, Depends, HTTPException
from database.async_db import get_db_connection
from auth.supabase_auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])
DEV_ROLE_MASTER_PASSWORD = os.getenv("DEV_ROLE_MASTER_PASSWORD", "")


def _is_privileged_role(role_name: str) -> bool:
    if not role_name:
        return False
    role = str(role_name).strip().lower()
    return role in {"desarrollador", "administrativo", "ceo", "admin", "administrador"}

@router.get("/all")
async def list_all_users(
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
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener usuarios: {str(e)}")

@router.put("/{user_id}/role")
async def update_user_role(
    user_id: str,
    data: dict,
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
        return {"message": "Rol actualizado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
