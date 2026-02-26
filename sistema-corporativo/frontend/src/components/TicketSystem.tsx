"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MoreVertical, UsersRound, Clock, CheckCircle, FileText } from 'lucide-react';
import { logTicketActivity } from '../app/dashboard/security/actions';
import { UserRole } from '../context/AuthContext';
import { createTicket as apiCreateTicket, updateTicket as apiUpdateTicket, updateTicketStatus as apiUpdateTicketStatus, deleteTicket as apiDeleteTicket } from '../lib/api';

type TicketStatus = 'ABIERTO' | 'EN-PROCESO' | 'RESUELTO';
type TicketPriority = 'ALTA' | 'MEDIA' | 'BAJA';
type TicketArea = string;

export interface Ticket {
    id: number;
    title: string;
    description: string;
    area: TicketArea;
    priority: TicketPriority;
    status: TicketStatus;
    createdAt: string;
    ownerId?: string;
    resolvedAt?: string;
    owner: string;
    observations?: string;
    takenBy?: string;
    takenAt?: string;
}

const TECH_DEPT = "Gerencia Nacional de Tecnologias de la informacion y la comunicacion";

export default function TicketSystem({
    darkMode,
    orgStructure = [],
    currentUser = 'Admin. General',
    currentUserId = '',
    userRole = 'Usuario',
    userDept = '',
    tickets = [],
    hasPermission,
    refreshTickets
}: {
    darkMode: boolean;
    orgStructure?: any[];
    currentUser?: string;
    currentUserId?: string;
    userRole?: UserRole;
    userDept?: string;
    tickets?: Ticket[];
    hasPermission: (permission: string) => boolean;
    refreshTickets?: () => Promise<void> | void;
}) {
    const PERMISSIONS_MASTER = {
        TICKETS_CREATE: 'TICKETS_CREATE',
        TICKETS_EDIT: 'TICKETS_EDIT',
        TICKETS_DELETE: 'TICKETS_DELETE',
        TICKETS_VIEW_ALL: 'TICKETS_VIEW_ALL',
        TICKETS_VIEW_DEPT: 'TICKETS_VIEW_DEPT',
        TICKETS_MOVE_KANBAN: 'TICKETS_MOVE_KANBAN',
        TICKETS_RESOLVE: 'TICKETS_RESOLVE',
    };

    const normalizeText = (value: string) => (value || '').toLowerCase().trim();
    const isTechUser = normalizeText(userDept).includes('tecnolog');

    const [filterArea, setFilterArea] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
    const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

    const allAreas = useMemo(() => orgStructure.flatMap((group: any) => group.items), [orgStructure]);

    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newArea, setNewArea] = useState<TicketArea>(TECH_DEPT);
    const [newPriority, setNewPriority] = useState<TicketPriority>('MEDIA');
    const [newObservations, setNewObservations] = useState('');

    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!newArea) setNewArea(TECH_DEPT);
    }, [newArea]);

    const refreshFromServer = async () => {
        if (refreshTickets) {
            await refreshTickets();
        }
    };

    const toApiPriority = (value: TicketPriority) => value.toLowerCase();
    const toApiStatus = (value: TicketStatus) => {
        if (value === 'EN-PROCESO') return 'en-proceso';
        if (value === 'RESUELTO') return 'resuelto';
        return 'abierto';
    };

    const logAction = async (
        action: string,
        ticketTitle: string,
        status: 'success' | 'warning' | 'danger' | 'info' = 'success',
    ) => {
        await logTicketActivity({
            username: currentUser,
            evento: 'GESTION DE TICKETS',
            detalles: `Ticket "${ticketTitle}": ${action}`,
            estado: status
        });
    };

    const startEdit = (e: React.MouseEvent, ticket: Ticket) => {
        e.stopPropagation();
        setEditingTicket(ticket);
        setNewTitle(ticket.title);
        setNewDesc(ticket.description);
        setNewArea(ticket.area);
        setNewPriority(ticket.priority);
        setNewObservations(ticket.observations || '');
        setShowModal(true);
        setMenuOpenId(null);
    };

    const deleteTicket = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!hasPermission(PERMISSIONS_MASTER.TICKETS_DELETE)) {
            alert("No tienes permiso para eliminar tickets.");
            return;
        }
        const ticket = tickets.find(t => t.id === id);
        if (ticket && confirm(`¿Estás seguro de que deseas eliminar el ticket "${ticket.title}"?`)) {
            await apiDeleteTicket(id);
            await refreshFromServer();
            setMenuOpenId(null);
            logAction('ELIMINACION', ticket.title, 'danger');
        }
    };

    const filteredTickets = useMemo(() => {
        return tickets.filter((t) => {
            const canViewAll = hasPermission(PERMISSIONS_MASTER.TICKETS_VIEW_ALL);
            const canViewDept = hasPermission(PERMISSIONS_MASTER.TICKETS_VIEW_DEPT);

            if (!canViewAll) {
                if (canViewDept) {
                    if (normalizeText(t.area) !== normalizeText(userDept)) return false;
                } else {
                    if (!t.ownerId || String(t.ownerId) !== String(currentUserId)) return false;
                }
            }

            const matchesSearch =
                normalizeText(t.title).includes(normalizeText(searchTerm)) ||
                normalizeText(t.description).includes(normalizeText(searchTerm));
            const matchesArea = filterArea === 'all' || normalizeText(t.area) === normalizeText(filterArea);
            const matchesPriority = filterPriority === 'all' || normalizeText(t.priority) === normalizeText(filterPriority);
            return matchesSearch && matchesArea && matchesPriority;
        });
    }, [tickets, searchTerm, filterArea, filterPriority, currentUserId, userDept, hasPermission]);

    const updateStatus = async (id: number, status: TicketStatus) => {
        const ticket = tickets.find(t => t.id === id);
        if (!ticket) return;

        if (status === 'EN-PROCESO' && !isTechUser) {
            alert('Solo personal de la Gerencia de Tecnologia puede tomar tickets.');
            return;
        }

        if (status === 'RESUELTO' && !isTechUser) {
            alert('Solo personal de la Gerencia de Tecnologia puede resolver tickets.');
            return;
        }

        if (ticket.status !== status) {
            logAction(`CAMBIO DE ESTADO (A ${status})`, ticket.title, 'info');
        }
        await apiUpdateTicketStatus(id, {
            estado: toApiStatus(status),
            observaciones: ticket.observations || '',
        });
        await refreshFromServer();
    };

    const handleDragStart = (e: React.DragEvent, id: number) => {
        e.dataTransfer.setData("ticketId", id.toString());
    };

    const handleDrop = async (e: React.DragEvent, status: TicketStatus) => {
        e.preventDefault();
        if (!hasPermission(PERMISSIONS_MASTER.TICKETS_MOVE_KANBAN)) return;
        const idString = e.dataTransfer.getData("ticketId");
        if (!idString) return;
        await updateStatus(parseInt(idString, 10), status);
    };

    const handleSaveTicket = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingTicket) {
            await apiUpdateTicket(editingTicket.id, {
                titulo: newTitle,
                descripcion: newDesc,
                prioridad: toApiPriority(newPriority),
                observaciones: newObservations,
            });
            logAction('EDICION', newTitle, 'info');
            await refreshFromServer();
        } else {
            const activeTickets = tickets.filter(t =>
                String(t.ownerId || '') === String(currentUserId) && (t.status === 'ABIERTO' || t.status === 'EN-PROCESO')
            ).length;

            if (userRole === 'Usuario' && activeTickets >= 3) {
                alert("Has alcanzado el limite maximo de 3 tickets activos.");
                return;
            }

            await apiCreateTicket({
                titulo: newTitle,
                descripcion: newDesc,
                prioridad: toApiPriority(userRole === 'Usuario' ? 'MEDIA' : newPriority),
                observaciones: newObservations,
            });
            await refreshFromServer();
            logAction('CREACION', newTitle, 'success');
        }

        setShowModal(false);
        setEditingTicket(null);
        setNewTitle('');
        setNewDesc('');
        setNewArea(TECH_DEPT);
        setNewPriority('MEDIA');
        setNewObservations('');
    };

    const getPriorityStyles = (p: TicketPriority) => {
        switch (p) {
            case 'ALTA': return darkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200';
            case 'MEDIA': return darkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
            case 'BAJA': return darkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <div className={`flex items-center px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Search size={16} className="text-slate-500 mr-2" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por titulo..."
                            className="bg-transparent border-none outline-none text-sm w-48 transition-all focus:w-64"
                        />
                    </div>
                    <select
                        value={filterArea}
                        onChange={(e) => setFilterArea(e.target.value)}
                        className={`px-3 py-2 rounded-lg border text-sm focus:outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                        <option value="all">Todas las Areas</option>
                        {[TECH_DEPT, ...allAreas.filter((a: string) => normalizeText(a) !== normalizeText(TECH_DEPT))].map(area => (
                            <option key={area} value={area}>{area}</option>
                        ))}
                    </select>
                    <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className={`px-3 py-2 rounded-lg border text-sm focus:outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                        <option value="all">Prioridades</option>
                        <option value="ALTA">Alta</option>
                        <option value="MEDIA">Media</option>
                        <option value="BAJA">Baja</option>
                    </select>
                </div>
                {hasPermission(PERMISSIONS_MASTER.TICKETS_CREATE) && (
                    <button
                        onClick={() => { setEditingTicket(null); setShowModal(true); }}
                        className="px-8 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-red-900/40"
                    >
                        <Plus size={18} /> NUEVO TICKET
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] pb-8">
                {(['ABIERTO', 'EN-PROCESO', 'RESUELTO'] as TicketStatus[]).map((status) => (
                    <div
                        key={status}
                        className={`flex flex-col rounded-xl border shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, status)}
                    >
                        <div className={`p-4 flex justify-between items-center border-b-2 ${status === 'ABIERTO' ? 'border-blue-500' : status === 'EN-PROCESO' ? 'border-amber-500' : 'border-emerald-500'}`}>
                            <h2 className="text-xs font-bold uppercase tracking-widest">{status === 'EN-PROCESO' ? 'EN PROCESO' : status}</h2>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                                {filteredTickets.filter(t => t.status === status).length}
                            </span>
                        </div>

                        <div className="p-3 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                            {filteredTickets.filter(t => t.status === status).map((ticket) => (
                                <div
                                    key={ticket.id}
                                    draggable={hasPermission(PERMISSIONS_MASTER.TICKETS_MOVE_KANBAN)}
                                    onDragStart={(e) => handleDragStart(e, ticket.id)}
                                    className={`group relative p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing hover:shadow-lg ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80' : 'bg-white border-slate-200 hover:border-red-200'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${getPriorityStyles(ticket.priority)}`}>
                                            {ticket.priority}
                                        </span>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === ticket.id ? null : ticket.id); }}
                                                className={`p-1 rounded-md transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                                            >
                                                <MoreVertical size={14} />
                                            </button>
                                            {menuOpenId === ticket.id && (
                                                <div className={`absolute right-0 top-full mt-1 w-32 rounded-lg shadow-xl z-20 border py-1 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                    {hasPermission(PERMISSIONS_MASTER.TICKETS_EDIT) && (
                                                        <button
                                                            onClick={(e) => startEdit(e, ticket)}
                                                            className={`w-full px-3 py-2 text-xs font-semibold text-left ${darkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                                        >
                                                            Editar
                                                        </button>
                                                    )}
                                                    {hasPermission(PERMISSIONS_MASTER.TICKETS_DELETE) && (
                                                        <button
                                                            onClick={(e) => deleteTicket(e, ticket.id)}
                                                            className={`w-full px-3 py-2 text-xs font-semibold text-left text-red-500 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className={`font-semibold text-sm mb-1 leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{ticket.title}</h3>
                                    <p className={`text-xs mb-3 line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{ticket.description}</p>

                                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800/30">
                                        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold font-mono uppercase tracking-tighter w-full overflow-hidden">
                                            <UsersRound size={11} className="text-slate-400 shrink-0" />
                                            <span className="truncate">SOPORTE TECNICO</span>
                                        </div>
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                                <Clock size={12} className="text-slate-400" />
                                                {ticket.createdAt}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-red-500/70 font-bold uppercase tracking-wider">
                                                <div className="w-1 h-1 rounded-full bg-red-500" />
                                                {ticket.owner ? ticket.owner.split(' ')[0] : 'S/I'}
                                            </div>
                                        </div>

                                        {ticket.takenBy && (
                                            <div className="w-full mt-1 p-2 rounded bg-blue-500/5 border border-blue-500/20">
                                                <p className="text-[10px] text-blue-400/90 font-bold uppercase tracking-wider">
                                                    Tecnico asignado: {ticket.takenBy}
                                                </p>
                                                {ticket.takenAt && (
                                                    <p className="text-[10px] text-slate-500">Tomado: {ticket.takenAt}</p>
                                                )}
                                            </div>
                                        )}

                                        {ticket.observations && (
                                            <div className="w-full mt-1 p-2 rounded bg-amber-500/5 border border-amber-500/10">
                                                <p className="text-[10px] text-amber-500/80 italic leading-tight line-clamp-2">
                                                    Obs: {ticket.observations}
                                                </p>
                                            </div>
                                        )}

                                        {ticket.resolvedAt && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold w-full mt-1 uppercase tracking-widest">
                                                <CheckCircle size={12} />
                                                Resuelto: {ticket.resolvedAt}
                                            </div>
                                        )}
                                    </div>

                                    {ticket.status !== 'RESUELTO' && (
                                        <div className="mt-4 pt-3 border-t border-slate-800/30 flex gap-2">
                                            {ticket.status === 'ABIERTO' && hasPermission(PERMISSIONS_MASTER.TICKETS_EDIT) && isTechUser && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(ticket.id, 'EN-PROCESO'); }}
                                                    className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider"
                                                >
                                                    ATENDER
                                                </button>
                                            )}
                                            {ticket.status === 'EN-PROCESO' && hasPermission(PERMISSIONS_MASTER.TICKETS_RESOLVE) && isTechUser && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(ticket.id, 'RESUELTO'); }}
                                                    className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider"
                                                >
                                                    RESOLVER
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {filteredTickets.filter(t => t.status === status).length === 0 && (
                                <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/20 rounded-xl">
                                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Sin Tickets</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                        <div className={`p-6 border-b flex justify-between items-center ${editingTicket ? 'bg-blue-600' : 'bg-red-600'}`}>
                            <h2 className="text-white font-bold flex items-center gap-2 uppercase tracking-tight">
                                {editingTicket ? <FileText size={20} /> : <Plus size={20} />}
                                {editingTicket ? 'EDITAR SOLICITUD' : 'NUEVA SOLICITUD'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSaveTicket} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Titulo de la Solicitud</label>
                                <input
                                    required
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className={`w-full px-4 py-3 rounded-lg border outline-none ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Descripcion Detallada</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    className={`w-full px-4 py-3 rounded-lg border outline-none ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Area Destino</label>
                                    <select
                                        disabled
                                        value={newArea}
                                        onChange={(e) => setNewArea(e.target.value)}
                                        className={`w-full px-4 py-3 rounded-lg border outline-none cursor-not-allowed opacity-70 grayscale-[0.5] ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                                    >
                                        <option value={TECH_DEPT}>{TECH_DEPT}</option>
                                    </select>
                                    <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">
                                        Todos los tickets se enrutan a Soporte Tecnico
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Prioridad</label>
                                    <select
                                        disabled={!hasPermission(PERMISSIONS_MASTER.TICKETS_EDIT) && !editingTicket}
                                        value={newPriority}
                                        onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                                        className={`w-full px-4 py-3 rounded-lg border outline-none ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                                    >
                                        <option value="ALTA">Alta</option>
                                        <option value="MEDIA">Media</option>
                                        <option value="BAJA">Baja</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Observaciones (Soporte Tecnico)</label>
                                <textarea
                                    rows={2}
                                    value={newObservations}
                                    onChange={(e) => setNewObservations(e.target.value)}
                                    disabled={!isTechUser}
                                    className={`w-full px-4 py-3 rounded-lg border outline-none ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                                />
                                {!isTechUser && (
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">
                                        Solo la Gerencia TIC puede registrar observaciones
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 pt-6">
                                <button type="button" onClick={() => setShowModal(false)} className={`flex-1 py-3 rounded-lg font-bold text-xs tracking-widest border ${darkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    CANCELAR
                                </button>
                                <button type="submit" className={`flex-1 py-3 rounded-lg font-bold text-xs tracking-widest text-white ${editingTicket ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                    {editingTicket ? 'GUARDAR CAMBIOS' : 'CREAR TICKET'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
