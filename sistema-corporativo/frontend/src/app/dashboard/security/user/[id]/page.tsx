'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Shield, Clock, Activity, FileText, Lock, Calendar } from 'lucide-react';
import { changeUserRole, deleteUser, getUserDetails, getUserLogs, resetUserPasswordAction, setUserStatus } from '../../actions';

export default function UserHistoryPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const [user, setUser] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [mounted, setMounted] = useState(false);
    const userId = params?.id;

    const roleLabelFromBackend = (role: string | undefined) => {
        const r = String(role || "").toLowerCase();
        if (r.includes("ceo")) return "CEO";
        if (r.includes("desarrollador") || r.includes("developer") || r.includes("dev")) return "Desarrollador";
        if (r.includes("gerente") || r.includes("manager")) return "Gerente";
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
                console.error("Error cargando auditoria de usuario:", error);
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
        if (!window.confirm("¿Esta seguro de que desea eliminar permanentemente esta cuenta? Esta accion no se puede deshacer.")) {
            return;
        }

        try {
            const res = await deleteUser(userId);
            if (res.success) {
                alert("Usuario eliminado correctamente.");
                router.push('/dashboard?tab=seguridad');
            } else {
                alert("Error al eliminar usuario: " + res.error);
            }
        } catch (error) {
            alert("Error critico al eliminar usuario.");
        }
    };

    const handleRoleChange = async (value: string) => {
        const res = await changeUserRole(String(userId), value);
        if (!res.success) {
            alert("No se pudo cambiar el rol: " + res.error);
            return;
        }
        if (res.user) {
            setUser((prev: any) => ({ ...prev, ...res.user }));
        } else {
            setUser((prev: any) => ({ ...prev, role: value }));
        }
        alert("Rol actualizado correctamente.");
    };

    const handleAssignDeveloper = async () => {
        const pwd = window.prompt("Clave maestra requerida para asignar rol Desarrollador:");
        if (!pwd) return;
        const res = await changeUserRole(String(userId), "Desarrollador", pwd);
        if (!res.success) {
            alert("No se pudo asignar rol Desarrollador: " + res.error);
            return;
        }
        if (res.user) {
            setUser((prev: any) => ({ ...prev, ...res.user }));
        } else {
            setUser((prev: any) => ({ ...prev, role: "Desarrollador" }));
        }
        alert("Rol Desarrollador asignado.");
    };

    const handleSetStatus = async (status: "ACTIVO" | "INACTIVO" | "BLOQUEADO") => {
        const labels: Record<string, string> = {
            ACTIVO: "activar",
            INACTIVO: "inactivar",
            BLOQUEADO: "bloquear",
        };
        if (!window.confirm(`¿Confirma ${labels[status]} este usuario?`)) {
            return;
        }

        const res = await setUserStatus(String(userId), status);
        if (!res.success) {
            alert("No se pudo cambiar el estado: " + res.error);
            return;
        }
        await refreshUserFromServer();
        alert(`Estado actualizado: ${status}`);
    };

    const handleResetPassword = async () => {
        const newPassword = window.prompt("Ingrese nueva clave (minimo 8 caracteres):");
        if (!newPassword) return;
        const res = await resetUserPasswordAction(String(userId), newPassword);
        if (!res.success) {
            alert("No se pudo resetear la clave: " + res.error);
            return;
        }
        alert("Clave actualizada correctamente.");
    };

    if (!mounted || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-8 text-center text-zinc-400 bg-zinc-950 min-h-screen">
                Usuario no encontrado.
                <button onClick={() => router.back()} className="block mx-auto mt-4 text-red-600 underline">Volver</button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-zinc-950 min-h-screen font-sans text-zinc-200">
            {/* Header / Back */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.push('/dashboard?tab=seguridad')}
                    className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Historial de Usuario</h1>
                    <p className="text-zinc-400 text-sm">Detalles y auditoria de actividad</p>
                </div>
            </div>

            {/* User Profile Card */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="w-20 h-20 rounded-full bg-red-900/30 text-red-400 flex items-center justify-center font-bold text-2xl shadow-inner">
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
                                className="ml-1 min-w-[170px] rounded-lg border border-red-500/40 bg-zinc-900/95 px-3 py-2 text-sm font-semibold text-red-100 outline-none transition-colors hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-500/30 cursor-pointer"
                            >
                                <option className="bg-zinc-900 text-red-100">Usuario</option>
                                <option className="bg-zinc-900 text-red-100">Administrador</option>
                                <option className="bg-zinc-900 text-red-100">CEO</option>
                                <option className="bg-zinc-900 text-red-100">Gerente</option>
                            </select>
                            <button
                                onClick={handleAssignDeveloper}
                                className="ml-2 px-2 py-1 rounded text-[11px] font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
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
                    <p className="text-2xl font-bold text-zinc-100 mt-1">{logs.length}</p>
                </div>
                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-sm">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Ultima Actividad</p>
                    <p className="text-sm font-medium text-zinc-100 mt-1 truncate">
                        {logs.length > 0 ? new Date(logs[0].fecha_hora).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-sm">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Logins Fallidos</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                        {typeof user?.failed_count === "number"
                            ? user.failed_count
                            : logs.filter(l => l.evento.toLowerCase().includes('fallido') || l.estado === 'danger').length}
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
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-zinc-800/40 transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-100 border-l-4 border-transparent hover:border-red-500">
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
                            {logs.length === 0 && (
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

