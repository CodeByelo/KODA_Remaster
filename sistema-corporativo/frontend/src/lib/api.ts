// src/lib/api.ts
// Capa de API central para el frontend — conecta con el backend FastAPI en localhost:8000

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://corpoelect-backend.onrender.com"
    : "http://127.0.0.1:8000");

// ==========================================
// TIPOS EXPORTADOS
// ==========================================

export interface ApiDocument {
    id: number;
    name: string;
    category: string;
    file_path?: string;
    file_url?: string;
    status?: string;
    signatureStatus?: string;
    prioridad?: string;
    uploadDate?: string;
    targetDepartment?: string;
    receptor_gerencia_id?: number;
    receptor_gerencia_nombre?: string;
    receptor_gerencia_id_usuario?: number;
    receptor_gerencia_nombre_usuario?: string;
    emisor_gerencia_id?: number;
    emisor_gerencia_nombre?: string;
    emisor_usuario_id?: number;
    receptor_usuario_id?: number;
    read?: boolean;
    correlativo?: string;
    tipo?: string;
    descripcion?: string;
    created_at?: string;
    updated_at?: string;
    remitente_gerencia_id?: number;
    remitente_gerencia_nombre?: string;
    fecha_caducidad?: string;
    respuesta_contenido?: string;
    respuesta_usuario_id?: string;
    respuesta_usuario_nombre?: string;
    respuesta_fecha?: string;
    respuesta_url_archivo?: string;
    respuesta_archivos?: string[];
}

export interface ApiUser {
    id: string;
    username: string;
    usuario_corp?: string;
    email?: string;
    nombre?: string;
    apellido?: string;
    role?: string;
    rol_id?: number;
    gerencia_id?: number;
    gerencia_nombre?: string;
    gerencia_depto?: string;
    is_active?: boolean;
    estado?: boolean;
    failed_count?: number;
    is_locked?: boolean;
}

export interface ApiGerencia {
    id: number;
    nombre: string;
    descripcion?: string;
}

export interface ApiTicket {
    id: number;
    titulo: string;
    descripcion?: string;
    area?: string;
    prioridad?: string;
    estado?: string;
    solicitante_id?: string;
    tecnico_id?: string | null;
    observaciones?: string;
    fecha_creacion?: string;
    solicitante_nombre?: string;
    tecnico_nombre?: string | null;
    solicitante_gerencia?: string;
}

export interface ApiTicketHistoryEvent {
    id: number;
    ticket_id: number;
    actor_username?: string;
    action: string;
    old_status?: string;
    new_status?: string;
    observaciones?: string;
    details?: string;
    created_at: string;
    titulo?: string;
    estado?: string;
}

export interface AnnouncementData {
    badge: string;
    title: string;
    description: string;
    status: string;
    urgency: string;
    color?: string;
}

export interface SecurityLog {
    id: number;
    username: string;
    evento: string;
    detalles: string;
    estado: string;
    ip_address?: string;
    fecha_hora: string;
    user_id?: string;
    gerencia_id?: number;
}

export interface CommunityChannel {
    id: string;
    label: string;
    description: string;
    visibility: "public" | "private";
    allowed_roles: string[];
}

// ==========================================
// HELPERS
// ==========================================

function getAuthHeaders(): HeadersInit {
    const token =
        typeof window !== "undefined" ? localStorage.getItem("sgd_token") : null;
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        throw new Error(`Error ${res.status}: ${errorText}`);
    }
    return res.json() as Promise<T>;
}

// ==========================================
// DOCUMENTOS
// ==========================================

/**
 * Obtiene todos los documentos a los que el usuario tiene acceso.
 */
export async function getDocumentos(): Promise<ApiDocument[]> {
    const res = await fetch(`/api/documentos`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<ApiDocument[]>(res);
}

/**
 * Sube un nuevo documento al servidor.
 * @param formData FormData con el archivo y metadatos
 */
export async function uploadDocumento(formData: FormData): Promise<ApiDocument> {
    const token =
        typeof window !== "undefined" ? localStorage.getItem("sgd_token") : null;

    const res = await fetch(`${BASE_URL}/documentos`, {
        method: "POST",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // NO incluir Content-Type: el browser lo pone automáticamente con boundary
        },
        body: formData,
    });
    return handleResponse<ApiDocument>(res);
}

/**
 * Actualiza el estado de un documento (aprobado, rechazado, en-proceso, etc.)
 */
export async function updateDocumentStatus(
    documentId: string | number,
    newStatus: string,
    comment?: string
): Promise<ApiDocument> {
    const res = await fetch(`${BASE_URL}/documentos/${documentId}/estado`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ estado: newStatus, comentario: comment }),
    });
    return handleResponse<ApiDocument>(res);
}

export async function respondDocumento(
    documentId: string | number,
    contenido: string,
    archivos: File[] = [],
): Promise<{ status: string }> {
    const token =
        typeof window !== "undefined" ? localStorage.getItem("sgd_token") : null;
    const formData = new FormData();
    formData.append("contenido", contenido);
    archivos.forEach((file) => formData.append("archivos", file));
    const res = await fetch(`${BASE_URL}/documentos/${documentId}/respuesta`, {
        method: "POST",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
    });
    return handleResponse<{ status: string }>(res);
}

export interface ApiDocumentoRespuesta {
    id: string;
    documento_id: string;
    user_id: string;
    contenido: string;
    created_at: string;
    usuario_nombre?: string;
    archivos?: string[];
}

export async function getDocumentoRespuestas(documentId: string | number): Promise<ApiDocumentoRespuesta[]> {
    const res = await fetch(`${BASE_URL}/documentos/${documentId}/respuestas`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<ApiDocumentoRespuesta[]>(res);
}

export interface ApiDocumentoEvento {
    id: number;
    documento_id: string;
    actor_username?: string;
    action: string;
    details?: string;
    created_at: string;
}

export async function getDocumentoEventos(documentId: string | number): Promise<ApiDocumentoEvento[]> {
    const res = await fetch(`${BASE_URL}/documentos/${documentId}/eventos`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<ApiDocumentoEvento[]>(res);
}

/**
 * Marca un documento como leído por el receptor.
 */
export async function markAsRead(documentId: string | number): Promise<ApiDocument> {
    const res = await fetch(`${BASE_URL}/documentos/${documentId}/leido`, {
        method: "PATCH",
        headers: getAuthHeaders(),
    });
    return handleResponse<ApiDocument>(res);
}

export async function purgeControlSeguimiento(): Promise<{ status: string; deleted: number }> {
    const res = await fetch(`${BASE_URL}/documentos/prioridad/control`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    return handleResponse<{ status: string; deleted: number }>(res);
}

export async function deleteDocumento(documentId: string | number): Promise<{ status: string }> {
    const res = await fetch(`${BASE_URL}/documentos/${documentId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    return handleResponse<{ status: string }>(res);
}

// ==========================================
// USUARIOS
// ==========================================

/**
 * Obtiene la lista de todos los usuarios del sistema.
 */
export async function getAllUsers(): Promise<ApiUser[]> {
    const res = await fetch(`/api/users`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<ApiUser[]>(res);
}

// ==========================================
// GERENCIAS
// ==========================================

/**
 * Obtiene la lista de todas las gerencias/departamentos.
 */
export async function getGerencias(): Promise<ApiGerencia[]> {
    const res = await fetch(`/api/gerencias`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<ApiGerencia[]>(res);
}

// ==========================================
// ADMINISTRACIÓN DE USUARIOS
// ==========================================

/**
 * Actualiza el rol de un usuario por su ID.
 * @param userId ID del usuario
 * @param roleId ID del rol (1=CEO, 2=Administrativo, 3=Usuario, 4=Desarrollador)
 */
export async function updateUserRole(
    userId: string | number,
    roleId: number,
    masterPassword?: string
): Promise<ApiUser> {
    const res = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ rol_id: roleId, ...(masterPassword ? { master_password: masterPassword } : {}) }),
    });
    return handleResponse<ApiUser>(res);
}

export async function updateUserProfile(
    userId: string | number,
    payload: {
        usuario_corp: string;
        nombre: string;
        apellido: string;
        email: string;
    },
): Promise<ApiUser> {
    const res = await fetch(`/api/users/${userId}/profile`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<ApiUser>(res);
}

export async function unlockUser(userId: string): Promise<{ status: string }> {
    const res = await fetch(`/api/users/${userId}/unlock`, {
        method: "PATCH",
        headers: getAuthHeaders(),
    });
    return handleResponse<{ status: string }>(res);
}

export async function updateUserAccountStatus(
    userId: string,
    status: "ACTIVO" | "INACTIVO" | "BLOQUEADO",
): Promise<{ status: string; user_id?: string; username?: string; new_status?: string }> {
    const res = await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
    });
    return handleResponse<{ status: string; user_id?: string; username?: string; new_status?: string }>(res);
}

export async function updateUserPermissions(
    userId: string,
    permisos: string[],
): Promise<{ status: string }> {
    const res = await fetch(`/api/users/${userId}/permissions`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ permisos }),
    });
    return handleResponse<{ status: string }>(res);
}

export async function resetUserPassword(
    userId: string,
    newPassword: string,
): Promise<{ status: string }> {
    const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ new_password: newPassword }),
    });
    return handleResponse<{ status: string }>(res);
}

export async function deleteUserAccount(userId: string): Promise<{ status: string }> {
    const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    return handleResponse<{ status: string }>(res);
}

export async function getAnnouncement(): Promise<AnnouncementData> {
    const res = await fetch(`/api/announcement`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<AnnouncementData>(res);
}

export async function saveAnnouncement(data: AnnouncementData): Promise<{ status: string }> {
    const res = await fetch(`/api/announcement`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<{ status: string }>(res);
}

export async function getOrgStructure(): Promise<{ org_structure: any[]; management_details?: Record<string, string[]>; source?: string }> {
    const res = await fetch(`/api/org-structure`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<{ org_structure: any[]; management_details?: Record<string, string[]>; source?: string }>(res);
}

export async function saveOrgStructure(org_structure: any[]): Promise<{ status: string }> {
    const res = await fetch(`/api/org-structure`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ org_structure }),
    });
    return handleResponse<{ status: string }>(res);
}

export async function getOrgManagementDetails(): Promise<{ management_details: Record<string, string[]> }> {
    const res = await fetch(`/api/org-management-details`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<{ management_details: Record<string, string[]> }>(res);
}

export async function saveOrgManagementDetails(
    management_details: Record<string, string[]>,
): Promise<{ status: string; management_details: Record<string, string[]> }> {
    const res = await fetch(`/api/org-management-details`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ management_details }),
    });
    return handleResponse<{ status: string; management_details: Record<string, string[]> }>(res);
}

export async function getCommunityChannels(): Promise<{ channels: CommunityChannel[] }> {
    const res = await fetch(`/api/community-channels`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<{ channels: CommunityChannel[] }>(res);
}

export async function saveCommunityChannels(
    channels: CommunityChannel[],
): Promise<{ status: string; channels: CommunityChannel[] }> {
    const res = await fetch(`/api/community-channels`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ channels }),
    });
    return handleResponse<{ status: string; channels: CommunityChannel[] }>(res);
}

export async function getSecurityLogs(): Promise<SecurityLog[]> {
    const res = await fetch(`/api/security/logs`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<SecurityLog[]>(res);
}

export async function getUserSecurityLogs(userId: string): Promise<SecurityLog[]> {
    const res = await fetch(`/api/security/logs/user/${userId}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<SecurityLog[]>(res);
}

export async function createSecurityLog(payload: {
    evento: string;
    detalles?: string;
    estado?: string;
    page?: string;
}): Promise<SecurityLog> {
    const res = await fetch(`/api/security/logs`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<SecurityLog>(res);
}

export async function purgeSecurityLogs(): Promise<{ status: string; message: string }> {
    const res = await fetch(`/api/security/logs`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    return handleResponse<{ status: string; message: string }>(res);
}

// ==========================================
// TICKETS
// ==========================================

export async function getTickets(): Promise<ApiTicket[]> {
    const res = await fetch(`/api/tickets`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<ApiTicket[]>(res);
}

export async function createTicket(payload: {
    titulo: string;
    descripcion?: string;
    prioridad?: string;
    observaciones?: string;
}): Promise<ApiTicket> {
    const res = await fetch(`/api/tickets`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<ApiTicket>(res);
}

export async function updateTicket(
    ticketId: number,
    payload: {
        titulo?: string;
        descripcion?: string;
        prioridad?: string;
        observaciones?: string;
    },
): Promise<ApiTicket> {
    const res = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<ApiTicket>(res);
}

export async function updateTicketStatus(
    ticketId: number,
    payload: { estado: string; observaciones?: string },
): Promise<ApiTicket> {
    const res = await fetch(`${BASE_URL}/tickets/${ticketId}/estado`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<ApiTicket>(res);
}

export async function deleteTicket(ticketId: number): Promise<{ status: string }> {
    const res = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    return handleResponse<{ status: string }>(res);
}

export async function getTicketHistory(ticketId: number): Promise<ApiTicketHistoryEvent[]> {
    const res = await fetch(`${BASE_URL}/tickets/${ticketId}/history`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<ApiTicketHistoryEvent[]>(res);
}

export async function searchTicketHistory(query: string): Promise<ApiTicketHistoryEvent[]> {
    const q = encodeURIComponent(query || "");
    const res = await fetch(`${BASE_URL}/tickets/history?q=${q}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
    });
    return handleResponse<ApiTicketHistoryEvent[]>(res);
}

// ==========================================
// DIAGNÓSTICO / CONEXIÓN
// ==========================================

/**
 * Verifica la conectividad con el backend y la base de datos.
 * Retorna un objeto con { message: string } si la conexión es exitosa.
 */
export async function checkConnection(): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/health`, {
        headers: { "Content-Type": "application/json" },
    });
    return handleResponse<{ message: string }>(res);
}
// ==========================================
// AUTENTICACIÓN Y REGISTRO
// ==========================================

/**
 * Registra un nuevo usuario en el sistema.
 * @param userData Datos del usuario
 */
export async function register(userData: any): Promise<ApiUser> {
    const res = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
    });
    return handleResponse<ApiUser>(res);
}

/**
 * Autentica un usuario y retorna el token de acceso.
 */
export async function login(username: string, password: string): Promise<{ access_token: string; user: ApiUser }> {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    const res = await fetch(`/api/auth/login`, {
        method: "POST",
        body: formData,
    });
    return handleResponse<{ access_token: string; user: ApiUser }>(res);
}

// ==========================================
// HOJAS DE RUTA
// ==========================================

export interface ApiHojaDeRuta {
    id: string;
    asunto: string;
    fecha_limite: string;
    acciones: string[];
    coordinaciones: string[];
    remitente_id: string;
    remitente_nombre: string;
    destinatario_id?: string | null;
    destinatario_nombre?: string | null;
    created_at: string;
}

export async function getHojasDeRuta(): Promise<ApiHojaDeRuta[]> {
    const res = await fetch(`${BASE_URL}/hojas-de-ruta`, { headers: getAuthHeaders() });
    return handleResponse<ApiHojaDeRuta[]>(res);
}

export async function createHojaDeRuta(payload: {
    asunto: string;
    fecha_limite: string;
    acciones: string[];
    coordinaciones: string[];
}): Promise<ApiHojaDeRuta> {
    const res = await fetch(`${BASE_URL}/hojas-de-ruta`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse<ApiHojaDeRuta>(res);
}

export async function deleteHojaDeRuta(id: string): Promise<{ status: string }> {
    const res = await fetch(`${BASE_URL}/hojas-de-ruta/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    return handleResponse<{ status: string }>(res);
}

