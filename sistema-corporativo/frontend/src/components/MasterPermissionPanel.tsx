"use client";

import React, { useState, useEffect } from 'react';
import { Shield, Save, CheckCircle, Info } from 'lucide-react';
import { PERMISSIONS_MASTER, DEFAULT_SCOPES, PERMISSION_LABELS } from '../permissions/constants';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../context/AuthContext';

export default function MasterPermissionPanel({ darkMode }: { darkMode: boolean }) {
    const { user } = useAuth();
    const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);

    // Load AdminScope from localStorage or defaults
    useEffect(() => {
        const savedScope = localStorage.getItem('admin_scope_2026');
        if (savedScope) {
            setAdminPermissions(JSON.parse(savedScope));
        } else {
            setAdminPermissions(DEFAULT_SCOPES['Administrativo'] || []);
        }
    }, []);

    const togglePermission = (perm: string) => {
        setAdminPermissions(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
        setSaved(false);
    };

    const saveAdminScope = () => {
        localStorage.setItem('admin_scope_2026', JSON.stringify(adminPermissions));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        // Note: In a real app, this would update the DB for all Admin users
        alert("Se ha actualizado el 'AdminScope'. Los administradores ahora tendrán estos permisos asignados.");
    };

    if (user?.role !== 'Desarrollador') {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-red-500 font-bold">
                <Shield size={48} className="mb-4" />
                ACCESO DENEGADO - NIVEL RAÍZ REQUERIDO (DEV)
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-zinc-900/50 border-red-900/30' : 'bg-white border-red-100 shadow-xl'}`}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-600 rounded-xl text-white shadow-lg shadow-red-900/40">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Panel de Configuración DEV (Nivel Raíz)</h2>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Definición de AdminScope - Regla 1</p>
                        </div>
                    </div>
                    <button
                        onClick={saveAdminScope}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all transform active:scale-95 ${saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'}`}
                    >
                        {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                        {saved ? 'GUARDADO' : 'GUARDAR ADMIN_SCOPE'}
                    </button>
                </div>

                <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 ${darkMode ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                    <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-500/90 leading-relaxed font-medium">
                        <strong>Instrucciones:</strong> Seleccione los permisos que el **Administrador** heredará. Según la jerarquía del sistema, el Administrador (Nivel Operativo) solo podrá gestionar a otros usuarios (CEO/USR) utilizando este subconjunto de permisos.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* GRUPOS DE PERMISOS */}
                    <PermissionGroup
                        title="1. Navegación y Visibilidad"
                        permissions={Object.keys(PERMISSIONS_MASTER).filter(k => k.startsWith('VIEW_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                    />
                    <PermissionGroup
                        title="2. Acciones Operativas"
                        permissions={Object.keys(PERMISSIONS_MASTER).filter(k => !k.startsWith('VIEW_') && !k.startsWith('ORG_') && !k.startsWith('SYS_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                    />
                    <PermissionGroup
                        title="3. Datos y Estructura"
                        permissions={Object.keys(PERMISSIONS_MASTER).filter(k => k.startsWith('ORG_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                    />
                    <PermissionGroup
                        title="4. Funciones Críticas (Suelo Dev)"
                        permissions={Object.keys(PERMISSIONS_MASTER).filter(k => k.startsWith('SYS_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                        isCritical
                    />
                </div>
            </div>
        </div>
    );
}

function PermissionGroup({ title, permissions, selected, onToggle, darkMode, isCritical }: any) {
    return (
        <div className={`p-5 rounded-xl border ${darkMode ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-xs font-black uppercase tracking-tighter mb-4 flex items-center gap-2 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-500' : 'bg-zinc-600'}`} />
                {title}
            </h3>
            <div className="space-y-3">
                {permissions.map((perm: string) => (
                    <label key={perm} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={selected.includes(perm)}
                                onChange={() => onToggle(perm)}
                                className="sr-only"
                            />
                            <div className={`w-10 h-6 rounded-full transition-colors ${selected.includes(perm) ? (isCritical ? 'bg-red-600' : 'bg-blue-600') : (darkMode ? 'bg-zinc-800' : 'bg-slate-300')}`} />
                            <div className={`absolute w-4 h-4 rounded-full bg-white transition-all shadow-sm ${selected.includes(perm) ? 'translate-x-5' : 'translate-x-1'}`} />
                        </div>
                        <span className={`text-[11px] font-bold transition-colors ${selected.includes(perm) ? (darkMode ? 'text-white' : 'text-slate-900') : 'text-slate-500 group-hover:text-slate-400'}`}>
                            {PERMISSION_LABELS[perm] || perm}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
