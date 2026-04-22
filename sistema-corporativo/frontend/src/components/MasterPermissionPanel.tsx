"use client";

import React, { useState, useEffect } from 'react';
import { Shield, Save, CheckCircle, Info } from 'lucide-react';
import { PERMISSIONS_MASTER, DEFAULT_SCOPES, PERMISSION_LABELS } from '../permissions/constants';
import { useAuth } from '../hooks/useAuth';
import { getAllUsers, getCommunityChannels, saveCommunityChannels, updateUserPermissions } from '../lib/api';
import { uiAlert } from '../lib/ui-dialog';
import { COMMUNITY_ROLE_OPTIONS, DEFAULT_COMMUNITY_CHANNELS, type CommunityChannelConfig, type CommunityRole } from '../config/communityChannels';

export default function MasterPermissionPanel({ darkMode }: { darkMode: boolean }) {
    const { user } = useAuth();
    const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [communityChannels, setCommunityChannels] = useState<CommunityChannelConfig[]>(DEFAULT_COMMUNITY_CHANNELS);
    const allPermissions = Object.values(PERMISSIONS_MASTER);

    useEffect(() => {
        const savedScope = localStorage.getItem('admin_scope_2026');
        if (savedScope) {
            setAdminPermissions(JSON.parse(savedScope));
        } else {
            setAdminPermissions(DEFAULT_SCOPES['Administrativo'] || []);
        }

        const loadCommunityChannels = async () => {
            try {
                const response = await getCommunityChannels();
                if (Array.isArray(response?.channels) && response.channels.length > 0) {
                    setCommunityChannels(response.channels as CommunityChannelConfig[]);
                }
            } catch (error) {
                console.error("No se pudieron cargar los canales de comunidad", error);
            }
        };

        void loadCommunityChannels();
    }, []);

    const togglePermission = (perm: string) => {
        setAdminPermissions(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
        setSaved(false);
    };

    const enableAllPermissions = () => {
        setAdminPermissions([...allPermissions]);
        setSaved(false);
    };

    const clearAllPermissions = () => {
        setAdminPermissions([]);
        setSaved(false);
    };

    const updateChannelVisibility = (channelId: string, visibility: "public" | "private") => {
        setCommunityChannels((prev) =>
            prev.map((channel) => {
                if (channel.id !== channelId) return channel;
                return {
                    ...channel,
                    visibility,
                    allowed_roles:
                        visibility === "public"
                            ? [...COMMUNITY_ROLE_OPTIONS]
                            : channel.allowed_roles.length > 0
                                ? channel.allowed_roles
                                : ["Desarrollador"],
                };
            }),
        );
        setSaved(false);
    };

    const toggleChannelRole = (channelId: string, role: CommunityRole) => {
        setCommunityChannels((prev) =>
            prev.map((channel) => {
                if (channel.id !== channelId) return channel;
                const exists = channel.allowed_roles.includes(role);
                const allowedRoles = exists
                    ? channel.allowed_roles.filter((currentRole) => currentRole !== role)
                    : [...channel.allowed_roles, role];

                return {
                    ...channel,
                    allowed_roles: allowedRoles.length > 0 ? allowedRoles : ["Desarrollador"],
                };
            }),
        );
        setSaved(false);
    };

    const saveAdminScope = async () => {
        try {
            setSaving(true);
            localStorage.setItem('admin_scope_2026', JSON.stringify(adminPermissions));

            const users = await getAllUsers();
            const admins = (users || []).filter((u: any) => {
                const role = String(u.role || '').toLowerCase();
                return role === 'administrativo' || role === 'admin' || role === 'administrador';
            });

            await Promise.all(
                admins.map((a: any) => updateUserPermissions(String(a.id), adminPermissions))
            );

            await saveCommunityChannels(communityChannels);

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            void uiAlert(`AdminScope aplicado. Administradores actualizados: ${admins.length}. Canales piloto sincronizados: ${communityChannels.length}`, "AdminScope");
        } catch (e) {
            console.error("Error guardando AdminScope", e);
            void uiAlert("No se pudo aplicar AdminScope global o guardar canales piloto. Revisa backend/permisos.", "AdminScope");
        } finally {
            setSaving(false);
        }
    };

    if (user?.role !== 'Desarrollador') {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-[#075159] font-bold">
                <Shield size={48} className="mb-4" />
                ACCESO DENEGADO - NIVEL RAIZ REQUERIDO (DEV)
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-zinc-900/50 border-[#0da67b]/20' : 'bg-white border-[#0da67b]/15 shadow-xl'}`}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-[linear-gradient(135deg,#042f36_0%,#075159_58%,#0bbf8c_100%)] rounded-xl text-white shadow-lg shadow-[#075159]/25">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Panel de Configuracion DEV (Nivel Raiz)</h2>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Definicion de AdminScope</p>
                        </div>
                    </div>
                    <button
                        onClick={saveAdminScope}
                        disabled={saving}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all transform active:scale-95 ${saved ? 'bg-[#0bbf8c] text-white' : 'bg-[linear-gradient(120deg,#042f36_0%,#075159_58%,#0bbf8c_100%)] hover:brightness-110 text-white shadow-lg shadow-[#075159]/20'}`}
                    >
                        {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                        {saving ? 'APLICANDO...' : saved ? 'GUARDADO' : 'GUARDAR ADMIN_SCOPE'}
                    </button>
                </div>

                <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 ${darkMode ? 'bg-[#0da67b]/10 border border-[#0da67b]/20' : 'bg-[#e7f9f3] border border-[#0da67b]/20'}`}>
                    <Info size={18} className="text-[#0da67b] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#075159] leading-relaxed font-medium">
                        Selecciona permisos para el rol Administrativo. Solo cuentas con rango Desarrollador pueden agregar o quitar permisos a usuarios Administrativos.
                    </p>
                </div>

                <div className={`p-4 rounded-xl mb-6 border ${darkMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Control Rapido de Permisos
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={enableAllPermissions}
                            className="px-4 py-2 rounded-lg text-xs font-black bg-[#0da67b] text-white hover:bg-[#075159] transition-colors"
                        >
                            ACTIVAR TODOS LOS PERMISOS
                        </button>
                        <button
                            onClick={clearAllPermissions}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-colors ${darkMode ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                        >
                            QUITAR TODOS
                        </button>
                        <span className={`text-xs font-bold self-center ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {adminPermissions.length} / {allPermissions.length} activos
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <PermissionGroup
                        title="1. Navegacion y Visibilidad"
                        permissions={allPermissions.filter(k => k.startsWith('VIEW_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                    />
                    <PermissionGroup
                        title="2. Acciones Operativas"
                        permissions={allPermissions.filter(k => !k.startsWith('VIEW_') && !k.startsWith('ORG_') && !k.startsWith('SYS_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                    />
                    <PermissionGroup
                        title="3. Datos y Estructura"
                        permissions={allPermissions.filter(k => k.startsWith('ORG_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                    />
                    <PermissionGroup
                        title="4. Funciones Criticas"
                        permissions={allPermissions.filter(k => k.startsWith('SYS_'))}
                        selected={adminPermissions}
                        onToggle={togglePermission}
                        darkMode={darkMode}
                        isCritical
                    />
                </div>

                <div className={`mt-8 rounded-2xl border p-5 ${darkMode ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="mb-4">
                        <h3 className={`text-sm font-black uppercase tracking-widest ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            Canales de Comunidad - Fase Piloto
                        </h3>
                        <p className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Cada módulo del sidebar se comporta como un canal. Si está en modo público conserva la lógica actual; si lo pones privado, solo entran los roles marcados.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {communityChannels.map((channel) => {
                            const isPrivate = channel.visibility === 'private';
                            return (
                                <div key={channel.id} className={`rounded-xl border p-4 ${darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{channel.label}</p>
                                            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{channel.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => updateChannelVisibility(channel.id, 'public')}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${!isPrivate ? 'bg-[#0da67b] text-white' : darkMode ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                                            >
                                                PUBLICO
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateChannelVisibility(channel.id, 'private')}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${isPrivate ? 'bg-[#042f36] text-white' : darkMode ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                                            >
                                                PRIVADO
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            Roles con acceso {isPrivate ? 'privado' : 'base'}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {COMMUNITY_ROLE_OPTIONS.map((role) => {
                                                const checked = channel.allowed_roles.includes(role);
                                                return (
                                                    <button
                                                        key={`${channel.id}-${role}`}
                                                        type="button"
                                                        onClick={() => toggleChannelRole(channel.id, role)}
                                                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${checked ? 'bg-[#075159] text-white border-[#075159]' : darkMode ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500' : 'bg-white text-slate-700 border-slate-300 hover:border-[#0da67b]'}`}
                                                    >
                                                        {role}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PermissionGroup({ title, permissions, selected, onToggle, darkMode, isCritical }: any) {
    return (
        <div className={`p-5 rounded-xl border ${darkMode ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-xs font-black uppercase tracking-tighter mb-4 flex items-center gap-2 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-[#042f36]' : 'bg-[#0da67b]'}`} />
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
                            <div className={`w-10 h-6 rounded-full transition-colors ${selected.includes(perm) ? (isCritical ? 'bg-[#042f36]' : 'bg-[#0da67b]') : (darkMode ? 'bg-zinc-800' : 'bg-slate-300')}`} />
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
