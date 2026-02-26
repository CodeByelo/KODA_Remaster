'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Activity, Users, Lock, ChevronRight, ChevronLeft, Search, Download, Filter, FileText, Edit2, Trash2, Plus, Briefcase, Zap, Factory, Save, X, CheckCircle } from 'lucide-react';
import {
    getAllUsers,
    getAnnouncement,
    getSecurityLogs,
    saveAnnouncement,
    saveOrgStructure,
    updateUserPermissions,
    updateUserRole,
} from '../../../lib/api';
import { PERMISSIONS_MASTER, DEFAULT_SCOPES, PERMISSION_LABELS } from '../../../permissions/constants';
import { useAuth } from '../../../hooks/useAuth';
import { UserRole } from '../../../context/AuthContext';

// Mapping icons for serialization support
const ORG_ICONS: Record<string, React.ElementType> = {
    Shield,
    Briefcase,
    Zap,
    Users,
    Factory
};

interface SecurityModuleProps {
    darkMode: boolean;
    announcement: any;
    setAnnouncement: (data: any) => void;
    documents: any[];
    setDocuments: (docs: any[]) => void;
    userRole: string;
    orgStructure: any[];
    setOrgStructure: (data: any[]) => void;
}

export default function SecurityModule({ darkMode, announcement, setAnnouncement, documents, setDocuments, userRole, orgStructure, setOrgStructure }: SecurityModuleProps) {
    const [activeTab, setActiveTab] = useState('docLogs');
    const [logs, setLogs] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [selectedUserForPerms, setSelectedUserForPerms] = useState<any | null>(null);
    const { hasPermission, user: currentUserObj } = useAuth();
    const [isClient, setIsClient] = useState(false); // Nuevo estado para hidratación

    // Search states
    const [logSearch, setLogSearch] = useState('');
    const [docSearch, setDocSearch] = useState('');

    const filteredLogs = logs.filter(log =>
        log.username.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.evento.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.detalles.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.estado.toLowerCase().includes(logSearch.toLowerCase())
    );

    const filteredDocs = documents.filter(doc =>
        doc.name.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.category.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.idDoc.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.uploadedBy.toLowerCase().includes(docSearch.toLowerCase())
    );

    const scrollRef = React.useRef<HTMLDivElement>(null);

    const scrollTabs = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { scrollLeft } = scrollRef.current;
            const scrollAmount = 250;
            scrollRef.current.scrollTo({
                left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // Hook para marcar que estamos en el cliente
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [logsData, usersData] = await Promise.all([
                    getSecurityLogs(),
                    getAllUsers(),
                ]);
                setLogs(logsData as any[]);
                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching security data:", error);
            }
            setLoading(false);
        }
        fetchData();
    }, [activeTab]);

    const theme = {
        bg: darkMode ? 'bg-zinc-900' : 'bg-white',
        text: darkMode ? 'text-white' : 'text-slate-900',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        card: darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200',
        header: darkMode ? 'bg-zinc-950/50' : 'bg-slate-50/50',
        rowHover: darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50',
        input: darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900',
        th: darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500',
        td: darkMode ? 'text-slate-300' : 'text-slate-700'
    };

    // Función auxiliar para contar eventos de hoy (solo en cliente)
    const getEventsToday = () => {
        if (!isClient) return 0;
        const today = new Date().toLocaleDateString();
        return logs.filter(l => new Date(l.fecha_hora).toLocaleDateString() === today).length;
    };

    // Función auxiliar para contar alertas (solo en cliente)
    const getSecurityAlerts = () => {
        if (!isClient) return 0;
        return logs.filter(l => l.estado === 'danger').length;
    };

    const handleExport = () => {
        if (activeTab === 'docLogs') {
            const headers = ['Tipo', 'ID', 'Título', 'Fecha', 'Hora', 'Enviado Por', 'Recibido Por'];
            const csvRows = [
                headers.join(','),
                ...documents.map(l => [l.category, l.idDoc, l.name, l.uploadDate, l.uploadTime, l.uploadedBy, l.receivedBy].join(','))
            ];
            const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `logs_documentos_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const deleteDocument = (id: number, name: string) => {
        if (confirm(`¿Estás seguro de eliminar el documento "${name}"? Esta acción no se puede deshacer.`)) {
            setDocuments(documents.filter(d => d.id !== id));
            alert("Documento eliminado correctamente.");
        }
    };

    const [editingDept, setEditingDept] = useState<{ groupIdx: number, itemIdx: number } | null>(null);
    const [newDeptName, setNewDeptName] = useState('');
    const [newGroupIdx, setNewGroupIdx] = useState(0);
    const [newModuleName, setNewModuleName] = useState('');
    const [announcementDraft, setAnnouncementDraft] = useState<any>(announcement);
    const [isAnnouncementDirty, setIsAnnouncementDirty] = useState(false);

    useEffect(() => {
        if (!isAnnouncementDirty) {
            setAnnouncementDraft(announcement);
        }
    }, [announcement, isAnnouncementDirty]);

    useEffect(() => {
        return () => {
            localStorage.removeItem("announcement_editing");
        };
    }, []);

    const handleAddDept = () => {
        if (!newDeptName) return;
        const newOrg = [...orgStructure];
        newOrg[newGroupIdx].items.push(newDeptName);
        setOrgStructure(newOrg);
        setNewDeptName('');
        saveOrgStructure(newOrg).catch(() => undefined);
    };

    const handleAddModule = () => {
        if (!newModuleName.trim()) return;
        const newOrg = [...orgStructure, { category: newModuleName.trim(), icon: 'Briefcase', items: [] }];
        setOrgStructure(newOrg);
        setNewModuleName('');
        saveOrgStructure(newOrg).catch(() => undefined);
    };

    const handleEditModule = (groupIdx: number) => {
        const newName = prompt("Nuevo nombre para el modulo:", orgStructure[groupIdx].category);
        if (!newName?.trim()) return;
        const newOrg = [...orgStructure];
        newOrg[groupIdx].category = newName.trim();
        setOrgStructure(newOrg);
        saveOrgStructure(newOrg).catch(() => undefined);
    };

    const handleDeleteModule = (groupIdx: number) => {
        if (!confirm("Estas seguro de eliminar este modulo y todas sus gerencias?")) return;
        const newOrg = orgStructure.filter((_, idx) => idx !== groupIdx);
        setOrgStructure(newOrg);
        saveOrgStructure(newOrg).catch(() => undefined);
    };

    const handleDeleteDept = (groupIdx: number, itemIdx: number) => {
        if (confirm("¿Estás seguro de eliminar esta gerencia?")) {
            const newOrg = [...orgStructure];
            newOrg[groupIdx].items.splice(itemIdx, 1);
            setOrgStructure(newOrg);
            saveOrgStructure(newOrg).catch(() => undefined);
        }
    };

    const handleEditDept = (groupIdx: number, itemIdx: number) => {
        const newName = prompt("Nuevo nombre para la gerencia:", orgStructure[groupIdx].items[itemIdx]);
        if (newName) {
            const newOrg = [...orgStructure];
            newOrg[groupIdx].items[itemIdx] = newName;
            setOrgStructure(newOrg);
            saveOrgStructure(newOrg).catch(() => undefined);
        }
    };

    return (
        <div className={`space-y-6 font-sans pt-2 ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`}>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${theme.card}`}>
                    <div>
                        <p className={`text-sm font-medium uppercase tracking-wider ${theme.subtext}`}>Docs Tramitados</p>
                        <h3 className={`text-3xl font-bold mt-1 ${theme.text}`}>{documents.length}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                        <FileText size={24} />
                    </div>
                </div>
                <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${theme.card}`}>
                    <div>
                        <p className={`text-sm font-medium uppercase tracking-wider ${theme.subtext}`}>Cuentas Activas</p>
                        <h3 className={`text-3xl font-bold mt-1 ${theme.text}`}>{users.length}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <Users size={24} />
                    </div>
                </div>
                <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${theme.card}`}>
                    <div>
                        <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Eventos Hoy</p>
                        <h3 className={`text-3xl font-bold mt-1 ${theme.text}`}>{getEventsToday()}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
                        <Activity size={24} />
                    </div>
                </div>
                <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${theme.card}`}>
                    <div>
                        <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Alertas Seguridad</p>
                        <h3 className={`text-3xl font-bold mt-1 ${theme.text}`}>{getSecurityAlerts()}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                        <Lock size={24} />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs with Arrows */}
            <div className="relative group/tabs mb-1">
                <button
                    onClick={() => scrollTabs('left')}
                    className={`absolute left-0 top-0 bottom-0 z-10 px-1 flex items-center bg-gradient-to-r ${darkMode ? 'from-zinc-900 via-zinc-900/80 to-transparent' : 'from-white via-white/80 to-transparent'} opacity-40 hover:opacity-100 transition-opacity`}
                >
                    <ChevronLeft size={20} className="text-red-600" />
                </button>

                <div
                    ref={scrollRef}
                    className={`flex border-b overflow-x-auto no-scrollbar scroll-smooth ${darkMode ? 'border-zinc-800' : 'border-slate-200'}`}
                >
                    {hasPermission(PERMISSIONS_MASTER.SECURITY_VIEW_LOGS) && (
                        <button
                            onClick={() => setActiveTab('docLogs')}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'docLogs' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            LOGS DE DOCUMENTOS
                        </button>
                    )}
                    {hasPermission(PERMISSIONS_MASTER.SECURITY_ANNOUNCEMENTS) && (
                        <button
                            onClick={() => setActiveTab('anuncios')}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'anuncios' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            GESTIÓN DE ANUNCIOS
                        </button>
                    )}
                    {hasPermission(PERMISSIONS_MASTER.SECURITY_VIEW_LOGS) && (
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'logs' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            HISTORIAL DE ACCESOS
                        </button>
                    )}
                    {hasPermission(PERMISSIONS_MASTER.SECURITY_MANAGE_USERS) && (
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'users' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            GESTIÓN DE USUARIOS
                        </button>
                    )}
                    {hasPermission(PERMISSIONS_MASTER.SYS_DEV_TOOLS) && (
                        <button
                            onClick={() => setActiveTab('orgMgmt')}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'orgMgmt' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            ESTRUCTURA ORGANIZATIVA
                        </button>
                    )}
                </div>

                <button
                    onClick={() => scrollTabs('right')}
                    className={`absolute right-0 top-0 bottom-0 z-10 px-1 flex items-center bg-gradient-to-l ${darkMode ? 'from-zinc-900 via-zinc-900/80 to-transparent' : 'from-white via-white/80 to-transparent'} opacity-40 hover:opacity-100 transition-opacity`}
                >
                    <ChevronRight size={20} className="text-red-600" />
                </button>
            </div>

            {/* Content Area */}
            <div className={`rounded-xl shadow-sm border overflow-hidden min-h-[500px] ${theme.card}`}>
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* TAB: GESTIÓN DE ANUNCIOS */}
                        {activeTab === 'anuncios' && (
                            <div className="animate-in fade-in duration-500">
                                <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <Activity className="text-red-600" size={20} />
                                        <div>
                                            <h3 className={`font-bold ${theme.text}`}>Editor de Comunicado Principal</h3>
                                            <p className={`text-[10px] ${theme.subtext}`}>Modifica el banner que visualizan todos los usuarios en el Dashboard General</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Etiqueta (Badge)</label>
                                                <input
                                                    type="text"
                                                    value={announcementDraft.badge}
                                                    onChange={(e) => {
                                                        setIsAnnouncementDirty(true);
                                                        localStorage.setItem("announcement_editing", "1");
                                                        setAnnouncementDraft({ ...announcementDraft, badge: e.target.value });
                                                    }}
                                                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`}
                                                    placeholder="Ej: Comunicado del Día"
                                                />
                                            </div>
                                            <div>
                                                <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Título del Anuncio</label>
                                                <input
                                                    type="text"
                                                    value={announcementDraft.title}
                                                    onChange={(e) => {
                                                        setIsAnnouncementDirty(true);
                                                        localStorage.setItem("announcement_editing", "1");
                                                        setAnnouncementDraft({ ...announcementDraft, title: e.target.value });
                                                    }}
                                                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Contenido / Descripción</label>
                                                <textarea
                                                    rows={4}
                                                    value={announcementDraft.description}
                                                    onChange={(e) => {
                                                        setIsAnnouncementDirty(true);
                                                        localStorage.setItem("announcement_editing", "1");
                                                        setAnnouncementDraft({ ...announcementDraft, description: e.target.value });
                                                    }}
                                                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Urgencia</label>
                                                <select
                                                    value={announcementDraft.urgency}
                                                    onChange={(e) => {
                                                        setIsAnnouncementDirty(true);
                                                        localStorage.setItem("announcement_editing", "1");
                                                        setAnnouncementDraft({ ...announcementDraft, urgency: e.target.value });
                                                    }}
                                                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`}
                                                >
                                                    <option value="Alta">Alta</option>
                                                    <option value="Media">Media</option>
                                                    <option value="Baja">Baja</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Estado del Sistema</label>
                                                <select
                                                    value={announcementDraft.status}
                                                    onChange={(e) => {
                                                        setIsAnnouncementDirty(true);
                                                        localStorage.setItem("announcement_editing", "1");
                                                        setAnnouncementDraft({ ...announcementDraft, status: e.target.value });
                                                    }}
                                                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`}
                                                >
                                                    <option value="Activo">Activo</option>
                                                    <option value="Mantenimiento">Mantenimiento</option>
                                                    <option value="Alerta">Alerta</option>
                                                </select>
                                            </div>

                                            <div className={`p-6 rounded-xl border-2 border-dashed ${darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-slate-200 bg-slate-50'}`}>
                                                <p className={`text-xs font-bold uppercase mb-4 text-center ${theme.subtext}`}>Vista Previa en Vivo</p>
                                                <div className="space-y-2 opacity-80 scale-90 origin-top">
                                                    <span className="inline-block px-2 py-0.5 rounded-full bg-red-600 text-white text-[8px] font-bold uppercase">{announcementDraft.badge}</span>
                                                    <h4 className="font-bold text-sm tracking-tight">{announcementDraft.title}</h4>
                                                    <p className="text-[10px] line-clamp-2 leading-relaxed">{announcementDraft.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-end">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await saveAnnouncement(announcementDraft);
                                                    const latest = await getAnnouncement();
                                                    setAnnouncement(latest);
                                                    setAnnouncementDraft(latest);
                                                    setIsAnnouncementDirty(false);
                                                    localStorage.removeItem("announcement_editing");
                                                    localStorage.setItem("announcement_updated_at", String(Date.now()));
                                                    window.dispatchEvent(new Event("announcement-updated"));
                                                    alert('Anuncio guardado correctamente para todas las cuentas.');
                                                } catch (e) {
                                                    console.error("Error saving announcement", e);
                                                    alert('No se pudo guardar el anuncio. Intenta de nuevo.');
                                                }
                                            }}
                                            className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
                                        >
                                            GUARDAR ANUNCIO
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: DOC LOGS */}
                        {activeTab === 'docLogs' && (
                            <div>
                                <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
                                    <h3 className={`font-bold ${theme.text}`}>Trazabilidad Documental</h3>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                value={docSearch}
                                                onChange={(e) => setDocSearch(e.target.value)}
                                                placeholder="Buscar documento..."
                                                className={`pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 ${theme.input}`}
                                            />
                                        </div>
                                        <button
                                            onClick={handleExport}
                                            className={`px-4 py-2 border rounded-lg font-medium flex items-center gap-2 ${darkMode ? 'bg-zinc-800 border-zinc-700 text-slate-300 hover:bg-zinc-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <Download size={16} />
                                            Exportar
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className={`uppercase ${theme.th}`}>
                                            <tr>
                                                <th className="px-6 py-3 font-semibold">Categoría / ID</th>
                                                <th className="px-6 py-3 font-semibold">Nombre Documento</th>
                                                <th className="px-6 py-3 font-semibold">Fecha</th>
                                                <th className="px-6 py-3 font-semibold">Hora</th>
                                                <th className="px-6 py-3 font-semibold">Enviado Por</th>
                                                <th className="px-6 py-3 font-semibold">Receptor Actual</th>
                                                <th className="px-6 py-3 font-semibold text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${darkMode ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                                            {filteredDocs.map((log) => (
                                                <tr key={log.id} className={`${theme.rowHover} transition-colors`}>
                                                    <td className={`px-6 py-4 flex flex-col ${theme.text}`}>
                                                        <span className="font-bold text-xs text-red-500">{log.category}</span>
                                                        <span className="font-mono text-[10px] opacity-70">{log.idDoc}</span>
                                                    </td>
                                                    <td className={`px-6 py-4 font-medium ${theme.text}`}>{log.name}</td>
                                                    <td className={`px-6 py-4 ${theme.subtext}`}>{log.uploadDate}</td>
                                                    <td className={`px-6 py-4 ${theme.subtext}`}>{log.uploadTime}</td>
                                                    <td className={`px-6 py-4 ${theme.text}`}>{log.uploadedBy}</td>
                                                    <td className={`px-6 py-4 ${theme.text}`}>{log.receivedBy}</td>
                                                    <td className={`px-6 py-4 text-center`}>
                                                        {hasPermission(PERMISSIONS_MASTER.SYS_DEV_TOOLS) && (
                                                            <button
                                                                onClick={() => deleteDocument(log.id, log.name)}
                                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                                                title="Eliminar Documento"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* TAB: LOGS */}
                        {activeTab === 'logs' && (
                            <div>
                                <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
                                    <h3 className={`font-bold ${theme.text}`}>Registro de Actividad Reciente</h3>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            value={logSearch}
                                            onChange={(e) => setLogSearch(e.target.value)}
                                            placeholder="Buscar evento..."
                                            className={`pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 ${theme.input}`}
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className={`uppercase ${theme.th}`}>
                                            <tr>
                                                <th className="px-6 py-3 font-semibold">Usuario</th>
                                                <th className="px-6 py-3 font-semibold">Evento</th>
                                                <th className="px-6 py-3 font-semibold">Detalles</th>
                                                <th className="px-6 py-3 font-semibold">IP Address</th>
                                                <th className="px-6 py-3 font-semibold">Fecha / Hora</th>
                                                <th className="px-6 py-3 font-semibold">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${darkMode ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                                            {filteredLogs.map((log) => (
                                                <tr key={log.id} className={`${theme.rowHover} transition-colors`}>
                                                    <td className={`px-6 py-4 font-medium border-l-4 border-transparent hover:border-red-500 ${theme.text}`}>
                                                        {log.username}
                                                    </td>
                                                    <td className={`px-6 py-4 ${theme.text}`}>{log.evento}</td>
                                                    <td className={`px-6 py-4 ${theme.subtext}`}>{log.detalles}</td>
                                                    <td className="px-6 py-4 font-mono text-xs opacity-70">{log.ip_address}</td>
                                                    <td className={`px-6 py-4 ${theme.subtext}`}>
                                                        {isClient ? (
                                                            <>
                                                                {new Date(log.fecha_hora).toLocaleDateString()} <span className="text-xs opacity-70">{new Date(log.fecha_hora).toLocaleTimeString()}</span>
                                                            </>
                                                        ) : (
                                                            <span>--</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${log.estado === 'success' ? (darkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700') :
                                                            log.estado === 'warning' ? (darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-700') :
                                                                log.estado === 'danger' ? (darkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700') :
                                                                    (darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                                                            }`}>
                                                            {log.estado}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {logs.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                        No hay registros de actividad disponibles.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* TAB: USERS */}
                        {activeTab === 'users' && (
                            <div className="animate-in fade-in duration-500">
                                <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
                                    <h3 className={`font-bold ${theme.text}`}>Directorio de Usuarios</h3>
                                    {hasPermission(PERMISSIONS_MASTER.SECURITY_MANAGE_USERS) && (
                                        <a href="/registro" className="text-sm text-white bg-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 flex items-center gap-1 transition-colors">
                                            <span>+</span> Crear Usuario
                                        </a>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className={`uppercase ${theme.th}`}>
                                            <tr>
                                                <th className="px-6 py-3 font-semibold">Usuario</th>
                                                <th className="px-6 py-3 font-semibold">Nombre Completo</th>
                                                <th className="px-6 py-3 font-semibold">Gerencia</th>
                                                <th className="px-6 py-3 font-semibold">Nivel Permiso</th>
                                                <th className="px-6 py-3 font-semibold text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${darkMode ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                                            {users.map((u) => {
                                                const isCurrentDev = currentUserObj?.role === 'Desarrollador';
                                                const canManageThisUser = u.id !== currentUserObj?.id && (isCurrentDev || u.role !== 'Desarrollador');
                                                return (
                                                    <tr key={u.id} className={`${theme.rowHover} transition-colors`}>
                                                        <td className={`px-6 py-4 font-bold flex items-center gap-2 ${theme.text}`}>
                                                            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs uppercase">
                                                                {u.usuario_corp ? u.usuario_corp.substring(0, 2) : '??'}
                                                            </div>
                                                            {u.usuario_corp}
                                                        </td>
                                                        <td className={`px-6 py-4 ${theme.text}`}>{u.nombre} {u.apellido}</td>
                                                        <td className={`px-6 py-4 ${theme.subtext}`}>{u.gerencia_depto}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${u.role === 'Desarrollador' ? 'bg-red-600 text-white' : (u.role === 'Administrativo' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200')}`}>
                                                                {u.role || 'Usuario'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-3">
                                                                {canManageThisUser && hasPermission(PERMISSIONS_MASTER.SECURITY_MANAGE_USERS) ? (
                                                                    <button
                                                                        onClick={() => setSelectedUserForPerms(u)}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg text-xs font-bold border border-blue-500/20 transition-all"
                                                                    >
                                                                        <Lock size={12} /> GESTIONAR PERMISOS
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Solo Lectura (DEV/PROPIO)</span>
                                                                )}
                                                                <a
                                                                    href={`/dashboard/security/user/${u.id}`}
                                                                    className="p-2 text-slate-400 hover:text-white transition-colors"
                                                                    title="Ver Auditoría"
                                                                >
                                                                    <Activity size={16} />
                                                                </a>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {selectedUserForPerms && (
                                    <UserPermissionsModal
                                        user={selectedUserForPerms}
                                        onClose={() => setSelectedUserForPerms(null)}
                                        darkMode={darkMode}
                                        currentUserPerms={currentUserObj?.permissions || []}
                                    />
                                )}
                            </div>
                        )}

                        {/* TAB: ESTRUCTURA ORGANIZATIVA */}
                        {activeTab === 'orgMgmt' && (
                            <div className="space-y-6 animate-in fade-in duration-500 p-6">
                                <div className={`p-6 rounded-xl border ${theme.card}`}>
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Briefcase size={20} className="text-red-600" /> ANADIR NUEVO MODULO
                                    </h3>
                                    <div className="flex flex-wrap gap-4 items-end">
                                        <div className="flex-1 min-w-[300px]">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Modulo</label>
                                            <input
                                                value={newModuleName}
                                                onChange={(e) => setNewModuleName(e.target.value)}
                                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 ${theme.input} outline-none`}
                                                placeholder="Ej: VII. Gestion Comercial"
                                            />
                                        </div>
                                        <button
                                            onClick={handleAddModule}
                                            className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20 active:scale-95 transition-transform"
                                        >
                                            CREAR MODULO
                                        </button>
                                    </div>
                                </div>
                                <div className={`p-6 rounded-xl border ${theme.card}`}>
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Plus size={20} className="text-red-600" /> AÑADIR NUEVA GERENCIA
                                    </h3>
                                    <div className="flex flex-wrap gap-4 items-end">
                                        <div className="flex-1 min-w-[300px]">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre de la Gerencia</label>
                                            <input
                                                value={newDeptName}
                                                onChange={(e) => setNewDeptName(e.target.value)}
                                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 ${theme.input} outline-none`}
                                                placeholder="Ej: Gerencia Nacional de Logística"
                                            />
                                        </div>
                                        <div className="w-64">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Categoría Jerárquica</label>
                                            <select
                                                value={newGroupIdx}
                                                onChange={(e) => setNewGroupIdx(parseInt(e.target.value))}
                                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 ${theme.input} outline-none`}
                                            >
                                                {orgStructure.map((g: any, i: number) => (
                                                    <option key={i} value={i}>{g.category}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={handleAddDept}
                                            className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20 active:scale-95 transition-transform"
                                        >
                                            GUARDAR
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {orgStructure.map((group: any, groupIdx: number) => (
                                        <div key={groupIdx} className={`p-5 rounded-xl border shadow-sm ${theme.card}`}>
                                            <div className="flex items-center gap-2 mb-4 border-b pb-3 border-zinc-800/50">
                                                {(() => {
                                                    const IconComp = ORG_ICONS[group.icon] || Shield;
                                                    return <IconComp size={20} className="text-red-500" />;
                                                })()}
                                                <h4 className="font-bold text-sm tracking-tight flex-1">{group.category}</h4>
                                                <button
                                                    onClick={() => handleEditModule(groupIdx)}
                                                    className={`p-1.5 rounded-md hover:bg-blue-500/20 hover:text-blue-400 transition-colors ${theme.subtext}`}
                                                    title="Editar modulo"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteModule(groupIdx)}
                                                    className={`p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors ${theme.subtext}`}
                                                    title="Eliminar modulo"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {group.items.map((item: string, itemIdx: number) => (
                                                    <div key={itemIdx} className={`group flex justify-between items-center p-3 rounded-lg border transition-all ${darkMode ? 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-700/40' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-sm'}`}>
                                                        <span className={`text-sm font-medium ${theme.text}`}>{item}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEditDept(groupIdx, itemIdx)}
                                                                className={`p-1.5 rounded-md hover:bg-blue-500/20 hover:text-blue-400 transition-colors ${theme.subtext}`}
                                                            >
                                                                <Edit2 size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteDept(groupIdx, itemIdx)}
                                                                className={`p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors ${theme.subtext}`}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {group.items.length === 0 && (
                                                    <p className="text-xs text-center py-4 text-slate-500 italic">No hay gerencias en esta categoría</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Upload Document Slide-over Panel */}
            {isUploadPanelOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className={`w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-500 ${theme.card}`}>
                        <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
                            <h3 className={`text-xl font-bold ${theme.text}`}>Subir Documento</h3>
                            <button
                                onClick={() => setIsUploadPanelOpen(false)}
                                className={`p-2 rounded-full hover:bg-slate-800 transition-colors ${theme.subtext}`}
                            >
                                <span className="font-bold">X</span>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className={`p-10 border-2 border-dashed rounded-xl text-center transition-colors ${darkMode ? 'border-zinc-800 bg-zinc-950/30 hover:border-red-500/50' : 'border-slate-200 bg-slate-50 hover:border-red-500/50'}`}>
                                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                    <Download size={24} />
                                </div>
                                <p className={`text-sm font-medium ${theme.text}`}>Haz clic para subir o arrastra un archivo</p>
                                <p className={`text-xs mt-1 ${theme.subtext}`}>PDF, Word, Excel (Max 10MB)</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Tipo de Documento</label>
                                    <select className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`}>
                                        <option>Circular</option>
                                        <option>Oficio</option>
                                        <option>Informe</option>
                                        <option>Memorando</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Gerencia Destino</label>
                                    <input type="text" className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`} placeholder="Escriba la gerencia..." />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase mb-2 ${theme.subtext}`}>Observaciones</label>
                                    <textarea rows={3} className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none ${theme.input}`} placeholder="Opcional..."></textarea>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsUploadPanelOpen(false)}
                                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 active:scale-[0.98]"
                            >
                                Procesar Documento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function UserPermissionsModal({ user, onClose, darkMode, currentUserPerms }: { user: any, onClose: () => void, darkMode: boolean, currentUserPerms: string[] }) {
    const [userPerms, setUserPerms] = useState<string[]>(user.permissions || user.permisos || []);
    const [saved, setSaved] = useState(false);

    // Jerarquía: Los permisos disponibles para asignar son solo aquellos que el admin posee
    const availablePermissions = Object.values(PERMISSIONS_MASTER).filter(p => currentUserPerms.includes(p));

    const togglePermission = (perm: string) => {
        setUserPerms(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
        setSaved(false);
    };

    const enableAllForUser = () => {
        setUserPerms([...availablePermissions]);
        setSaved(false);
    };

    const clearAllForUser = () => {
        setUserPerms([]);
        setSaved(false);
    };

    const [selectedRole, setSelectedRole] = useState(user.role || 'Usuario'); // Roles: 'Usuario', 'Administrativo', 'CEO', 'Desarrollador'
    const roles = ['Usuario', 'Administrativo', 'CEO', 'Desarrollador'];

    const handleSave = async () => {
        try {
            // Actualizar Rol
            let rolId = 3; // Usuario
            if (selectedRole === 'Administrativo') rolId = 2;
            if (selectedRole === 'CEO') rolId = 1;
            if (selectedRole === 'Desarrollador') rolId = 4;

            await Promise.all([
                updateUserRole(user.id, rolId),
                updateUserPermissions(String(user.id), userPerms),
            ]);
            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                onClose();
            }, 1500);
            alert(`Permisos y Rol actualizados para ${user.nombre}.`);
        } catch (error) {
            alert("Error al actualizar: " + error);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                            <Lock size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold">Gestión de Permisos Granulares</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{user.nombre} {user.apellido} ({user.rol || 'Usuario'})</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar space-y-6">
                    {/* SECCIÓN DE ROL */}
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-100'}`}>
                        <h4 className={`text-xs font-bold uppercase mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rol del Usuario</h4>
                        <div className="flex gap-2">
                            {roles.map(role => (
                                <button
                                    key={role}
                                    onClick={() => setSelectedRole(role)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedRole === role
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                                        : (darkMode ? 'bg-zinc-800 text-slate-400 hover:bg-zinc-700' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100')
                                        }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                            <button
                                onClick={enableAllForUser}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                                ACTIVAR TODOS
                            </button>
                            <button
                                onClick={clearAllForUser}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${darkMode ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                            >
                                QUITAR TODOS
                            </button>
                            <span className="text-[11px] font-bold text-slate-500">
                                {userPerms.length} / {availablePermissions.length} activos
                            </span>
                        </div>
                        {availablePermissions.length > 0 ? (
                            availablePermissions.map(perm => (
                                <label key={perm} className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer group transition-all ${userPerms.includes(perm) ? (darkMode ? 'bg-blue-600/10 border-blue-500/50' : 'bg-blue-50 border-blue-200') : (darkMode ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-100')}`}>
                                    <div>
                                        <p className={`text-[11px] font-bold ${userPerms.includes(perm) ? (darkMode ? 'text-blue-400' : 'text-blue-700') : 'text-slate-500'}`}>
                                            {PERMISSION_LABELS[perm] || perm}
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={userPerms.includes(perm)}
                                            onChange={() => togglePermission(perm)}
                                            className="sr-only"
                                        />
                                        <div className={`w-10 h-6 rounded-full transition-colors ${userPerms.includes(perm) ? 'bg-blue-600' : (darkMode ? 'bg-zinc-800' : 'bg-slate-300')}`} />
                                        <div className={`absolute w-4 h-4 rounded-full bg-white transition-all shadow-sm ${userPerms.includes(perm) ? 'translate-x-5' : 'translate-x-1'} top-1`} />
                                    </div>
                                </label>
                            ))
                        ) : (
                            <div className="col-span-2 py-10 text-center italic text-slate-500 text-sm">
                                Tu AdminScope no permite asignar permisos adicionales.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-zinc-800/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">CANCELAR</button>
                    <button
                        onClick={handleSave}
                        className={`px-8 py-2 rounded-xl text-sm font-bold transition-all transform active:scale-95 flex items-center gap-2 ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/40'}`}
                    >
                        {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                        {saved ? 'GUARDADO' : 'APLICAR CAMBIOS'}
                    </button>
                </div>
            </div>
        </div>
    );
}

