import {
    createSecurityLog,
    getAllUsers,
    getSecurityLogs,
    getUserSecurityLogs,
} from "../../../lib/api";

export async function getSecurityLogsData() {
    return getSecurityLogs();
}

export async function getUsersList() {
    return getAllUsers();
}

export async function getUserDetails(userId: string) {
    const users = await getAllUsers();
    return users.find((u: any) => String(u.id) === String(userId)) || null;
}

export async function getUserLogs(userId: string) {
    return getUserSecurityLogs(userId);
}

export async function logTicketActivity(data: any) {
    return createSecurityLog({
        evento: data?.evento || "TICKET",
        detalles: data?.detalles || "",
        estado: data?.estado || "info",
        page: "/dashboard?tab=tickets",
    });
}

export async function logDocumentActivity(data: any) {
    return createSecurityLog({
        evento: data?.evento || "DOCUMENTO",
        detalles: data?.detalles || "",
        estado: data?.estado || "info",
        page: "/dashboard?tab=documentos",
    });
}

export async function deleteUser(_userId: string) {
    return { success: false, error: "Use panel de gestion de usuarios para desactivar/bloquear." };
}

export async function updateUserStatus(_userId: string, _newStatus: string) {
    return { success: false, error: "Funcion en construccion." };
}

