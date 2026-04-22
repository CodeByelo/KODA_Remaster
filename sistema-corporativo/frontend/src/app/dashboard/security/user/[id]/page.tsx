'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Shield, Clock, Activity, FileText, Lock, Calendar, Pencil } from 'lucide-react';
import { changeUserRole, deleteUser, editUserProfileAction, getUserDetails, getUserLogs, resetUserPasswordAction, setUserStatus } from '../../actions';

export default function UserHistoryPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const [user, setUser] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
    const [dialog, setDialog] = useState<{
        open: boolean;
        type: "confirm" | "prompt";
        title: string;
        message: string;
        inputType?: "text" | "password";
        inputValue?: string;
        confirmText?: string;
        cancelText?: string;
    }>({
        open: false,
        type: "confirm",
        title: "",
        message: "",
        inputType: "text",
        inputValue: "",
        confirmText: "Aceptar",
        cancelText: "Cancelar",
    });
    const dialogResolverRef = useRef<((value: boolean | string | null) => void) | null>(null);

    const [mounted, setMounted] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        usuario_corp: "",
        nombre: "",
        apellido: "",
        email: "",
    });
    const userId = params?.id;
    const safeLogs = Array.isArray(logs) ? logs : [];

    const goBackToDashboard = () => {
        router.replace('/dashboard');
    };

    const showNotice = (type: "success" | "error" | "info", message: string) => {
        setNotice({ type, message });
        window.setTimeout(() => setNotice(null), 3200);
    };

    const askConfirm = (
        title: string,
        message: string,
        confirmText: string = "Aceptar",
        cancelText: string = "Cancelar",
    ) =>
        new Promise<boolean>((resolve) => {
            dialogResolverRef.current = (value) => resolve(Boolean(value));
            setDialog({
                open: true,
                type: "confirm",
                title,
                message,
                inputType: "text",
                inputValue: "",
                confirmText,
                cancelText,
            });
        });

    const askPrompt = (
        title: string,
        message: string,
        inputType: "text" | "password" = "text",
        confirmText: string = "Confirmar",
        cancelText: string = "Cancelar",
    ) =>
        new Promise<string | null>((resolve) => {
            dialogResolverRef.current = (value) => resolve(typeof value === "string" ? value : null);
            setDialog({
                open: true,
                type: "prompt",
                title,
                message,
                inputType,
                inputValue: "",
                confirmText,
                cancelText,
            });
        });

    const closeDialog = (result: boolean | string | null) => {
        const resolver = dialogResolverRef.current;
        dialogResolverRef.current = null;
        setDialog((prev) => ({ ...prev, open: false }));
        if (resolver) resolver(result);
    };

    const roleLabelFromBackend = (role: string | undefined) => {
        const r = String(role || "").toLowerCase();
        if (r.includes("ceo")) return "CEO";
        if (r.includes("desarrollador") || r.includes("developer") || r.includes("dev")) return "Desarrollador";
        if (r.includes("gerente") || r.includes("manager")) return "Gerente";
        if (r.includes("coordinador") || r.includes("coordinator")) return "Coordinador";
        if (r.includes("admin")) return "Administrador";
        return "Usuario";
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchData() {
            if (!userId) return;
            setLoading(true);
            try {
                const [userData, logsData] = await Promise.all([
                    getUserDetails(userId),
                    getUserLogs(userId)
                ]);
                setUser(userData);
                setLogs(Array.isArray(logsData) ? logsData : []);
            } catch (error) {
                console.error("Error cargando auditoría de usuario:", error);
                setLogs([]);
                setUser(null);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [userId]);

    const refreshUserFromServer = async () => {
        if (!userId) return;
        try {
            const nextUser = await getUserDetails(String(userId));
            if (nextUser) setUser(nextUser);
        } catch (error) {
            console.error("Error refrescando usuario:", error);
        }
    };

    const handleDelete = async () => {
        const confirmed = await askConfirm(
            "Eliminar cuenta",
            "¿Está seguro de que desea eliminar permanentemente esta cuenta? Esta acción no se puede deshacer.",
            "Eliminar",
            "Cancelar",
        );
        if (!confirmed) {
            return;
        }

        try {
            const res = await deleteUser(userId);
            if (res.success) {
                showNotice("success", "Usuario eliminado correctamente.");
                router.replace('/dashboard');
            } else {
                showNotice("error", "Error al eliminar usuario: " + res.error);
            }
        } catch (error) {
            showNotice("error", "Error crítico al eliminar usuario.");
        }
    };

    const handleRoleChange = async (value: string) => {
        const res = await changeUserRole(String(userId), value);
        if (!res.success) {
            showNotice("error", "No se pudo cambiar el rol: " + res.error);
            return;
        }
        if (res.user) {
            setUser((prev: any) => ({ ...prev, ...res.user }));
        } else {
            setUser((prev: any) => ({ ...prev, role: value }));
        }
        showNotice("success", "Rol actualizado correctamente.");
    };

    const handleAssignDeveloper = async () => {
        const pwd = await askPrompt(
            "Asignar rol Desarrollador",
            "Clave maestra requerida para asignar rol Desarrollador:",
            "password",
            "Validar",
            "Cancelar",
        );
        if (!pwd) return;
        const res = await changeUserRole(String(userId), "Desarrollador", pwd);
        if (!res.success) {
            showNotice("error", "No se pudo asignar rol Desarrollador: " + res.error);
            return;
        }
        if (res.user) {
            setUser((prev: any) => ({ ...prev, ...res.user }));
        } else {
            setUser((prev: any) => ({ ...prev, role: "Desarrollador" }));
        }
        showNotice("success", "Rol Desarrollador asignado.");
    };

    const handleSetStatus = async (status: "ACTIVO" | "INACTIVO" | "BLOQUEADO") => {
        const labels: Record<string, string> = {
            ACTIVO: "activar",
            INACTIVO: "inactivar",
            BLOQUEADO: "bloquear",
        };
        const confirmed = await askConfirm(
            "Confirmar estado",
            `¿Confirma ${labels[status]} este usuario?`,
            "Confirmar",
            "Cancelar",
        );
        if (!confirmed) {
            return;
        }

        const res = await setUserStatus(String(userId), status);
        if (!res.success) {
            showNotice("error", "No se pudo cambiar el estado: " + res.error);
            return;
        }
        await refreshUserFromServer();
        showNotice("success", `Estado actualizado: ${status}`);
    };

    const handleResetPassword = async () => {
        const newPassword = await askPrompt(
            "Restablecer clave",
            "Ingrese nueva clave (mínimo 8 caracteres):",
            "password",
            "Actualizar",
            "Cancelar",
        );
        if (!newPassword) return;
        const res = await resetUserPasswordAction(String(userId), newPassword);
        if (!res.success) {
            showNotice("error", "No se pudo resetear la clave: " + res.error);
            return;
        }
        showNotice("success", "Clave actualizada correctamente.");
    };

    const openEditModal = () => {
        setEditForm({
            usuario_corp: String(user?.usuario_corp || "").trim(),
            nombre: String(user?.nombre || "").trim(),
            apellido: String(user?.apellido || "").trim(),
            email: String(user?.email || "").trim(),
        });
        setEditOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;
        const payload = {
            usuario_corp: editForm.usuario_corp.trim(),
            nombre: editForm.nombre.trim(),
            apellido: editForm.apellido.trim(),
            email: editForm.email.trim(),
        };
        if (!payload.usuario_corp || !payload.nombre || !payload.apellido || !payload.email) {
            showNotice("error", "Completa todos los campos obligatorios.");
            return;
        }
        setSavingEdit(true);
        const res = await editUserProfileAction(String(userId), payload);
        setSavingEdit(false);
        if (!res.success) {
            showNotice("error", "No se pudo editar el usuario: " + res.error);
            return;
        }
        if (res.user) {
            setUser((prev: any) => ({ ...prev, ...res.user }));
        }
        setEditOpen(false);
        showNotice("success", "Usuario actualizado correctamente.");
    };

    if (!mounted || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-10 h-10 border-4 border-[#0da67b] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-8 text-center text-zinc-400 bg-zinc-950 min-h-screen">
                Usuario no encontrado.
                <button onClick={goBackToDashboard} className="block mx-auto mt-4 text-[#0da67b] underline">Volver</button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-zinc-950 min-h-screen font-sans text-zinc-200">
            {dialog.open && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-[#0da67b]/20 bg-zinc-900 shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-[#0da67b]/15 bg-gradient-to-r from-[#042f36] via-[#075159] to-[#0da67b]/80">
                            <h3 className="text-lg font-bold text-zinc-100">{dialog.title}</h3>
                            <p className="text-sm text-zinc-300 mt-1">{dialog.message}</p>
                        </div>
                        <div className="px-5 py-4">
                            {dialog.type === "prompt" && (
                                <input
                                    autoFocus
                                    type={dialog.inputType || "text"}
                                    value={dialog.inputValue || ""}
                                    onChange={(e) =>
                                        setDialog((prev) => ({ ...prev, inputValue: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-[#0da67b] focus:ring-2 focus:ring-[#0da67b]/30"
                                    placeholder="Escriba aqui..."
                                />
                            )}
                        </div>
                        <div className="px-5 pb-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => closeDialog(null)}
                                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                                {dialog.cancelText || "Cancelar"}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    closeDialog(dialog.type === "prompt" ? (dialog.inputValue || "").trim() : true)
                                }
                                className="px-4 py-2 rounded-lg bg-[linear-gradient(120deg,#042f36_0%,#075159_55%,#0bbf8c_100%)] text-white hover:brightness-110 transition-colors font-semibold"
                            >
                                {dialog.confirmText || "Aceptar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {notice && (
                <div className="fixed top-5 right-5 z-[120] max-w-md">
                    <div
                        className={`rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm ${
                            notice.type === "success"
                                ? "bg-emerald-900/85 border-emerald-500/50 text-emerald-100"
                                : notice.type === "error"
                                    ? "bg-[#042f36]/95 border-[#0da67b]/40 text-white"
                                    : "bg-zinc-900/90 border-zinc-600 text-zinc-100"
                        }`}
                    >
                        <p className="text-sm font-semibold tracking-wide">{notice.message}</p>
                    </div>
                </div>
            )}
            {editOpen && (
                <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-[#0da67b]/20 bg-zinc-900 shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#0da67b]/15 bg-gradient-to-r from-[#042f36] via-[#075159] to-[#0da67b]/80 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-100">Editar Usuario</h3>
                                <p className="text-sm text-zinc-400">Actualiza perfil sin cambiar gerencia ni contraseña.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditOpen(false)}
                                className="text-zinc-400 hover:text-zinc-100 text-2xl"
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 tracking-wider">Nombre</label>
                                    <input
                                        required
                                        value={editForm.nombre}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, nombre: e.target.value }))}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-[#0da67b] focus:ring-2 focus:ring-[#0da67b]/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 tracking-wider">Apellido</label>
                                    <input
                                        required
                                        value={editForm.apellido}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, apellido: e.target.value }))}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-[#0da67b] focus:ring-2 focus:ring-[#0da67b]/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 tracking-wider">Usuario corporativo</label>
                                    <input
                                        required
                                        value={editForm.usuario_corp}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, usuario_corp: e.target.value }))}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-[#0da67b] focus:ring-2 focus:ring-[#0da67b]/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 tracking-wider">Email</label>
                                    <input
                                        required
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-[#0da67b] focus:ring-2 focus:ring-[#0da67b]/30"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 tracking-wider">Gerencia (solo lectura)</label>
                                    <input
                                        value={String(user?.gerencia_depto || "Sin Asignar")}
                                        disabled
                                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-500 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditOpen(false)}
                                    className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEdit}
                                    className="px-4 py-2 rounded-lg bg-[linear-gradient(120deg,#042f36_0%,#075159_55%,#0bbf8c_100%)] text-white hover:brightness-110 transition-colors font-semibold disabled:opacity-60"
                                >
                                    {savingEdit ? "Guardando..." : "Guardar cambios"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Header / Back */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={goBackToDashboard}
                    className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Historial de Usuario</h1>
                    <p className="text-zinc-400 text-sm">Detalles y auditoría de actividad</p>
                </div>
            </div>

            {/* User Profile Card */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="w-20 h-20 rounded-full bg-[#042f36]/60 text-[#0bbf8c] flex items-center justify-center font-bold text-2xl shadow-inner">
                    {user.usuario_corp ? user.usuario_corp.substring(0, 2).toUpperCase() : <User size={32} />}
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-zinc-100">{user.nombre} {user.apellido}</h2>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-zinc-300">
                        <div className="flex items-center gap-1">
                            <Shield size={16} className="text-zinc-500" />
                            <span className="font-medium">Usuario:</span> {user.usuario_corp}
                        </div>
                        <div className="flex items-center gap-1">
                            <Activity size={16} className="text-zinc-500" />
                            <span className="font-medium">Gerencia:</span> {user.gerencia_depto}
                        </div>
                        <div className="flex items-center gap-1">
                            <Shield size={16} className="text-zinc-500" />
                            <span className="font-medium">Nivel:</span>
                            <select
                                value={roleLabelFromBackend(user.role)}
                                onChange={(e) => handleRoleChange(e.target.value)}
                                className="ml-1 min-w-[170px] rounded-lg border border-[#0da67b]/35 bg-zinc-900/95 px-3 py-2 text-sm font-semibold text-[#d9fff2] outline-none transition-colors hover:border-[#0bbf8c] focus:border-[#0bbf8c] focus:ring-2 focus:ring-[#0da67b]/30 cursor-pointer"
                            >
                                <option className="bg-zinc-900 text-[#d9fff2]">Usuario</option>
                                <option className="bg-zinc-900 text-[#d9fff2]">Administrador</option>
                                <option className="bg-zinc-900 text-[#d9fff2]">CEO</option>
                                <option className="bg-zinc-900 text-[#d9fff2]">Gerente</option>
                                <option className="bg-zinc-900 text-[#d9fff2]">Coordinador</option>
                            </select>
                            <button
                                onClick={handleAssignDeveloper}
                                className="ml-2 px-2 py-1 rounded text-[11px] font-bold bg-[#0da67b] text-white hover:bg-[#075159] transition-colors"
                                type="button"
                            >
                                DEV (Clave)
                            </button>
                        </div>
                        <div className="flex items-center gap-1">
                            <Lock size={16} className="text-zinc-500" />
                            <span className="font-medium">ID:</span> {user.id}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={openEditModal}
                        className="px-4 py-2 bg-[linear-gradient(120deg,#042f36_0%,#075159_55%,#0bbf8c_100%)] text-white rounded-lg hover:brightness-110 font-medium text-sm shadow-sm transition-all active:scale-[0.98] inline-flex items-center gap-2"
                    >
                        <Pencil size={14} />
                        Editar Usuario
                    </button>
                    {!(user?.estado === true && !user?.is_locked) && (
                        <button
                            onClick={() => handleSetStatus("ACTIVO")}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm shadow-sm transition-all active:scale-[0.98]"
                        >
                            Activar
                        </button>
                    )}
                    {user?.estado !== false || user?.is_locked ? (
                        <button
                            onClick={() => handleSetStatus("INACTIVO")}
                            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium text-sm shadow-sm transition-all active:scale-[0.98]"
                        >
                            Inactivar
                        </button>
                    ) : null}
                    {!user?.is_locked && (
                        <button
                            onClick={() => handleSetStatus("BLOQUEADO")}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm shadow-sm transition-all active:scale-[0.98]"
                        >
                            Bloquear
                        </button>
                    )}
                    <button
                        onClick={handleResetPassword}
                        className="px-4 py-2 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-800 font-medium text-sm transition-colors"
                    >
                        Reset Password
                    </button>

                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm shadow-sm transition-all active:scale-[0.98]"
                    >
                        Eliminar Cuenta
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-sm">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Total Eventos</p>
                    <p className="text-2xl font-bold text-zinc-100 mt-1">{safeLogs.length}</p>
                </div>
                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-sm">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Ultima Actividad</p>
                    <p className="text-sm font-medium text-zinc-100 mt-1 truncate">
                        {safeLogs.length > 0 ? new Date(safeLogs[0].fecha_hora).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-sm">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Logins Fallidos</p>
                    <p className="text-2xl font-bold text-[#0da67b] mt-1">
                        {typeof user?.failed_count === "number"
                            ? user.failed_count
                            : safeLogs.filter((l) => String(l?.evento || '').toLowerCase().includes('fallido') || l?.estado === 'danger').length}
                    </p>
                </div>
                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-sm">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Status</p>
                    <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded ${user?.is_locked ? "bg-red-900/30 text-red-300" : user?.estado ? "bg-green-900/30 text-green-300" : "bg-zinc-700/60 text-zinc-200"}`}>
                            {user?.is_locked ? "BLOQUEADO" : user?.estado ? "ACTIVO" : "INACTIVO"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Timeline / Logs */}
            <div className="bg-zinc-900 rounded-xl shadow-sm border border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/80">
                    <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                        <Clock size={18} className="text-zinc-500" />
                        Linea de Tiempo de Actividad
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-950 text-zinc-400 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Evento</th>
                                <th className="px-6 py-3 font-semibold">Detalles</th>
                                <th className="px-6 py-3 font-semibold">IP</th>
                                <th className="px-6 py-3 font-semibold">Fecha</th>
                                <th className="px-6 py-3 font-semibold">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {safeLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-zinc-800/40 transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-100 border-l-4 border-transparent hover:border-[#0da67b]">
                                        {log.evento}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-300">{log.detalles}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-zinc-300">{log.ip_address}</td>
                                    <td className="px-6 py-4 text-zinc-400 flex flex-col">
                                        <span className="font-medium">{new Date(log.fecha_hora).toLocaleDateString()}</span>
                                        <span className="text-xs">{new Date(log.fecha_hora).toLocaleTimeString()}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${log.estado === 'success' ? 'bg-green-900/30 text-green-300' :
                                            log.estado === 'warning' ? 'bg-amber-900/30 text-amber-300' :
                                                log.estado === 'danger' ? 'bg-red-900/30 text-red-300' :
                                                    'bg-zinc-700/60 text-zinc-200'
                                            }`}>
                                            {log.estado}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {safeLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                        No hay actividad registrada para este usuario.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

