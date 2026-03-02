'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Shield, Clock, Activity, FileText, Lock, Calendar } from 'lucide-react';
import { changeUserRole, deleteUser, getUserDetails, getUserLogs, resetUserPasswordAction, unlockUserAccount } from '../../actions';

export default function UserHistoryPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const [user, setUser] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [mounted, setMounted] = useState(false);
    const userId = params?.id;
    const DEV_ROLE_MASTER_PASSWORD = "JJDKoda**";

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
            const [userData, logsData] = await Promise.all([
                getUserDetails(userId),
                getUserLogs(userId)
            ]);
            setUser(userData);
            setLogs(logsData);
            setLoading(false);
        }
        fetchData();
    }, [userId]);

    const handleDelete = async () => {
        if (!window.confirm("¿Está seguro de que desea eliminar permanentemente esta cuenta? Esta acción no se puede deshacer.")) {
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
            alert("Error crítico al eliminar usuario.");
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
        if (pwd !== DEV_ROLE_MASTER_PASSWORD) {
            alert("Clave maestra incorrecta.");
            return;
        }
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

    const handleUnlock = async () => {
        const res = await unlockUserAccount(String(userId));
        if (!res.success) {
            alert("No se pudo desbloquear: " + res.error);
            return;
        }
        setUser((prev: any) => ({ ...prev, is_locked: false, estado: true, failed_count: 0 }));
        alert("Cuenta desbloqueada.");
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
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-8 text-center text-slate-500">
                Usuario no encontrado.
                <button onClick={() => router.back()} className="block mx-auto mt-4 text-red-600 underline">Volver</button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            {/* Header / Back */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.push('/dashboard?tab=seguridad')}
                    className="p-2 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Historial de Usuario</h1>
                    <p className="text-slate-500 text-sm">Detalles y auditoría de actividad</p>
                </div>
            </div>

            {/* User Profile Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-2xl shadow-inner">
                    {user.usuario_corp ? user.usuario_corp.substring(0, 2).toUpperCase() : <User size={32} />}
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900">{user.nombre} {user.apellido}</h2>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                            <Shield size={16} className="text-slate-400" />
                            <span className="font-medium">Usuario:</span> {user.usuario_corp}
                        </div>
                        <div className="flex items-center gap-1">
                            <Activity size={16} className="text-slate-400" />
                            <span className="font-medium">Gerencia:</span> {user.gerencia_depto}
                        </div>
                        <div className="flex items-center gap-1">
                            <Shield size={16} className="text-slate-400" />
                            <span className="font-medium">Nivel:</span>
                            <select
                                value={roleLabelFromBackend(user.role)}
                                onChange={(e) => handleRoleChange(e.target.value)}
                                className="bg-transparent border-none text-sm font-medium outline-none text-slate-600 cursor-pointer"
                            >
                                <option>Usuario</option>
                                <option>Administrador</option>
                                <option>CEO</option>
                                <option>Gerente</option>
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
                            <Lock size={16} className="text-slate-400" />
                            <span className="font-medium">ID:</span> {user.id}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleResetPassword}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors"
                    >
                        Reset Password
                    </button>
                    {(user?.is_locked || user?.estado === false) && (
                        <button
                            onClick={handleUnlock}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm shadow-sm transition-all active:scale-[0.98]"
                        >
                            Desbloquear Cuenta
                        </button>
                    )}

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
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Eventos</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{logs.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Última Actividad</p>
                    <p className="text-sm font-medium text-slate-900 mt-1 truncate">
                        {logs.length > 0 ? new Date(logs[0].fecha_hora).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Logins Fallidos</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                        {typeof user?.failed_count === "number"
                            ? user.failed_count
                            : logs.filter(l => l.evento.toLowerCase().includes('fallido') || l.estado === 'danger').length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</p>
                    <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded ${user?.is_locked ? "bg-red-100 text-red-700" : user?.estado ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                            {user?.is_locked ? "BLOQUEADO" : user?.estado ? "ACTIVO" : "INACTIVO"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Timeline / Logs */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Clock size={18} className="text-slate-400" />
                        Línea de Tiempo de Actividad
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Evento</th>
                                <th className="px-6 py-3 font-semibold">Detalles</th>
                                <th className="px-6 py-3 font-semibold">IP</th>
                                <th className="px-6 py-3 font-semibold">Fecha</th>
                                <th className="px-6 py-3 font-semibold">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 border-l-4 border-transparent hover:border-red-500">
                                        {log.evento}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{log.detalles}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{log.ip_address}</td>
                                    <td className="px-6 py-4 text-slate-500 flex flex-col">
                                        <span className="font-medium">{new Date(log.fecha_hora).toLocaleDateString()}</span>
                                        <span className="text-xs">{new Date(log.fecha_hora).toLocaleTimeString()}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${log.estado === 'success' ? 'bg-green-100 text-green-700' :
                                            log.estado === 'warning' ? 'bg-amber-100 text-amber-700' :
                                                log.estado === 'danger' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-100 text-slate-600'
                                            }`}>
                                            {log.estado}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
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
