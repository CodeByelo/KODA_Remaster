// src/lib/api.ts
// Capa de API central para el frontend — conecta con el backend FastAPI en localhost:8000

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://corpoelect-backend.onrender.com";

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
}

export interface ApiUser {
    id: number;
    username: string;
    email?: string;
    nombre?: string;
    apellido?: string;
    role?: string;
    gerencia_id?: number;
    gerencia_nombre?: string;
    is_active?: boolean;
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
    const res = await fetch(`${BASE_URL}/documentos`, {
        headers: getAuthHeaders(),
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
    documentId: number,
    newStatus: string,
    comment?: string
): Promise<ApiDocument> {
    const res = await fetch(`${BASE_URL}/documentos/${documentId}/estado`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ estado: newStatus, comment }),
    });
    return handleResponse<ApiDocument>(res);
}

/**
 * Marca un documento como leído por el receptor.
 */
export async function markAsRead(documentId: number): Promise<ApiDocument> {
    const res = await fetch(`${BASE_URL}/documentos/${documentId}/leido`, {
        method: "PATCH",
        headers: getAuthHeaders(),
    });
    return handleResponse<ApiDocument>(res);
}

// ==========================================
// USUARIOS
// ==========================================

/**
 * Obtiene la lista de todos los usuarios del sistema.
 */
export async function getAllUsers(): Promise<ApiUser[]> {
    const res = await fetch(`${BASE_URL}/usuarios`, {
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
    const res = await fetch(`${BASE_URL}/gerencias`, {
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
    userId: number,
    roleId: number
): Promise<ApiUser> {
    const res = await fetch(`${BASE_URL}/users/${userId}/role`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ rol_id: roleId }),
    });
    return handleResponse<ApiUser>(res);
}

// ==========================================
// TICKETS
// ==========================================

export async function getTickets(): Promise<ApiTicket[]> {
    const res = await fetch(`${BASE_URL}/tickets`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<ApiTicket[]>(res);
}

export async function createTicket(payload: {
    titulo: string;
    descripcion?: string;
    prioridad?: string;
    observaciones?: string;
}): Promise<ApiTicket> {
    const res = await fetch(`${BASE_URL}/tickets`, {
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
    const res = await fetch(`${BASE_URL}/api/register`, {
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
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const res = await fetch(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });
    return handleResponse<{ access_token: string; user: ApiUser }>(res);
}
