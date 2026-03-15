from fastapi import APIRouter, Depends, HTTPException, Request
from database.async_db import get_db_connection
from typing import List

router = APIRouter(prefix="/gerencias", tags=["gerencias"])


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

@router.get("")
async def list_gerencias(
    request: Request,
    conn = Depends(get_db_connection),
):
    try:
        rows = await conn.fetch("SELECT id, nombre, siglas, categoria FROM gerencias ORDER BY nombre")
        try:
            await _log_security_event(
                conn,
                tenant_id=None,
                user_id=None,
                username=None,
                evento="GERENCIAS_LIST",
                detalles="Listado de gerencias",
                estado="info",
                page="/gerencias",
                ip_origen=request.client.host if request.client else None,
            )
        except Exception:
            pass
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener gerencias: {str(e)}")
