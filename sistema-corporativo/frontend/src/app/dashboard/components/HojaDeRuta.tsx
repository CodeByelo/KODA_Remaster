'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  ArrowLeft,
  Calendar,
  Clock,
  User2,
  Search,
  CheckSquare,
  ChevronDown,
  FileText,
  Trash2,
  X,
  Map as MapIcon,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { getHojasDeRuta, createHojaDeRuta, deleteHojaDeRuta, ApiHojaDeRuta } from '../../../lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RutaUser {
  id: string;
  nombre?: string;
  apellido?: string;
  usuario_corp?: string;
  username?: string;
}

export interface HojaDeRutaProps {
  darkMode: boolean;
  users: RutaUser[];
  userRole: string;
  currentUserId: string;
}

// ─── Acciones predefinidas ────────────────────────────────────────────────────
const ACCIONES_PREDEFINIDAS = [
  'Asistir en mi representación',
  'Contactar al funcionario para aclarar alcance',
  'Convocar a reunión sobre el asunto',
  'Coordinar acciones / Tramitar / Procesar',
  'Elaborar informe',
  'En cuenta / Archivar para su resguardo y custodia',
  'Evaluar requerimiento y presentar propuesta',
  'Favor hacerme llegar más detalle sobre el tema',
  'Formalizar documento',
  'Para presentar en Junta Directiva',
  'Para su información y fines pertinentes',
  'Para su revisión',
  'Preparar punto de Cuenta',
  'Preparar punto de Información',
  'Preparar respuesta para mi firma',
];

// ─── Temporizador con colores ─────────────────────────────────────────────────
function useTicker() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

interface TimerBadgeProps {
  createdAt: string;
  fechaLimite: string;
  darkMode: boolean;
}

const TimerBadge: React.FC<TimerBadgeProps> = ({ createdAt, fechaLimite, darkMode }) => {
  useTicker();
  const now = Date.now();
  const start = new Date(createdAt).getTime();
  const end = new Date(fechaLimite).getTime();
  const total = end - start;
  const remaining = end - now;

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-900/40 text-red-400 border border-red-800">
        <AlertTriangle size={11} />
        Vencida
      </span>
    );
  }

  const remainingHours = remaining / (1000 * 60 * 60);
  const pct = total > 0 ? remaining / total : 1;

  // Color: rojo ≤ 24h, amarillo ≤ 50%, verde > 50%
  let color: 'green' | 'yellow' | 'red';
  if (remainingHours <= 24) color = 'red';
  else if (pct <= 0.5) color = 'yellow';
  else color = 'green';

  const colorMap = {
    green: { bg: 'bg-emerald-900/30 border-emerald-700 text-emerald-400', dot: 'bg-emerald-400' },
    yellow: { bg: 'bg-amber-900/30 border-amber-700 text-amber-400', dot: 'bg-amber-400' },
    red: { bg: 'bg-red-900/30 border-red-700 text-red-400', dot: 'bg-red-400' },
  };

  // Format remaining
  let label = '';
  const days = Math.floor(remainingHours / 24);
  const hours = Math.floor(remainingHours % 24);
  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${mins}m`;
  else label = `${mins}m`;

  const { bg, dot } = colorMap[color];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dot}`} />
      <Clock size={11} />
      {label}
    </span>
  );
};

// ─── Modal "Otros" ────────────────────────────────────────────────────────────
const OtrosModal: React.FC<{
  darkMode: boolean;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}> = ({ darkMode, onConfirm, onCancel }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${darkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Acción personalizada</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200"><X size={18} /></button>
        </div>
        <p className={`text-sm ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
          Escribe la acción que deseas añadir. La corrección ortográfica está activa.
        </p>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={true}
          lang="es"
          rows={3}
          placeholder="Ej: Revisar el informe y enviar observaciones..."
          className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-600 ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className={`px-4 py-2 rounded-lg border text-sm font-medium ${darkMode ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>Cancelar</button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} disabled={!value.trim()} className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-50">Añadir acción</button>
        </div>
      </div>
    </div>
  );
};

// ─── Formulario Nueva Ruta ────────────────────────────────────────────────────
const NuevaRutaForm: React.FC<{
  darkMode: boolean;
  users: RutaUser[];
  onSave: () => void;
  onCancel: () => void;
}> = ({ darkMode, users, onSave, onCancel }) => {
  const [asunto, setAsunto] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [checkedAcciones, setCheckedAcciones] = useState<string[]>([]);
  const [customAcciones, setCustomAcciones] = useState<string[]>([]);
  const [showOtrosModal, setShowOtrosModal] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<RutaUser | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const userOptions = useMemo(() =>
    users.map((u) => ({
      ...u,
      label: `${u.nombre || ''} ${u.apellido || ''} (${u.usuario_corp || u.username || 'usuario'})`.trim(),
    })), [users]);

  const filteredUsers = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    return q ? userOptions.filter((u) => u.label.toLowerCase().includes(q)) : userOptions;
  }, [recipientSearch, userOptions]);

  const toggleAccion = (accion: string) =>
    setCheckedAcciones((prev) => prev.includes(accion) ? prev.filter((a) => a !== accion) : [...prev, accion]);

  const removeCustom = (accion: string) => {
    setCustomAcciones((prev) => prev.filter((a) => a !== accion));
    setCheckedAcciones((prev) => prev.filter((a) => a !== accion));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asunto.trim() || !fecha || !selectedUser) return;
    setLoading(true);
    try {
      const fechaLimite = `${fecha}T${hora || '23:59'}:00`;
      await createHojaDeRuta({
        asunto: asunto.trim(),
        fecha_limite: fechaLimite,
        acciones: checkedAcciones,
        destinatario_id: selectedUser.id,
        destinatario_nombre: `${selectedUser.nombre || ''} ${selectedUser.apellido || ''}`.trim(),
      });
      onSave();
    } catch (err) {
      console.error('Error creando hoja de ruta:', err);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-600 ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'}`;
  const labelClass = `block mb-1 text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`;
  const allAcciones = [...ACCIONES_PREDEFINIDAS, ...customAcciones];

  return (
    <>
      {showOtrosModal && (
        <OtrosModal
          darkMode={darkMode}
          onConfirm={(text) => { setCustomAcciones((p) => [...p, text]); setCheckedAcciones((p) => [...p, text]); setShowOtrosModal(false); }}
          onCancel={() => setShowOtrosModal(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'}`}>
            <ArrowLeft size={15} /> Volver
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2"><Plus size={18} className="text-red-500" />Nueva Hoja de Ruta</h2>
        </div>

        <div className={`rounded-2xl border p-5 md:p-7 space-y-5 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
          {/* Asunto */}
          <div>
            <label className={labelClass}><FileText size={12} className="inline mr-1" />Asunto</label>
            <input required value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Escribe el asunto..." className={inputClass} />
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><Calendar size={12} className="inline mr-1" />Fecha límite</label>
              <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}><Clock size={12} className="inline mr-1" />Hora límite (opcional)</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Destinatario */}
          <div>
            <label className={labelClass}><User2 size={12} className="inline mr-1" />Destinatario</label>
            <div className="relative" ref={dropdownRef}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${darkMode ? 'bg-zinc-950 border-zinc-700 hover:border-zinc-500' : 'bg-slate-50 border-slate-300 hover:border-slate-400'}`} onClick={() => setDropdownOpen((v) => !v)}>
                <Search size={14} className={darkMode ? 'text-zinc-500' : 'text-slate-400'} />
                <input
                  value={selectedUser ? `${selectedUser.nombre || ''} ${selectedUser.apellido || ''}`.trim() : recipientSearch}
                  onChange={(e) => { setRecipientSearch(e.target.value); setSelectedUser(null); setDropdownOpen(true); }}
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(true); }}
                  placeholder="Buscar usuario..."
                  className={`flex-1 bg-transparent text-sm focus:outline-none ${darkMode ? 'text-zinc-100 placeholder:text-zinc-500' : 'text-slate-900 placeholder:text-slate-400'}`}
                />
                {selectedUser && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedUser(null); setRecipientSearch(''); }} className="text-zinc-400 hover:text-zinc-200"><X size={14} /></button>
                )}
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''} ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`} />
              </div>
              {dropdownOpen && (
                <div className={`absolute z-20 w-full mt-1 rounded-lg border shadow-xl max-h-52 overflow-y-auto ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'}`}>
                  {filteredUsers.length === 0
                    ? <div className={`px-4 py-3 text-sm italic ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>No se encontraron usuarios</div>
                    : filteredUsers.map((u) => (
                      <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setRecipientSearch(''); setDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${darkMode ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-50 text-slate-800'}`}>
                        {u.label}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div>
            <label className={labelClass}><CheckSquare size={12} className="inline mr-1" />Acciones a tomar</label>
            <div className={`rounded-lg border divide-y ${darkMode ? 'border-zinc-800 divide-zinc-800' : 'border-slate-200 divide-slate-100'}`}>
              {allAcciones.map((accion) => {
                const isCustom = customAcciones.includes(accion);
                return (
                  <label key={accion} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${darkMode ? 'hover:bg-zinc-800/60' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={checkedAcciones.includes(accion)} onChange={() => toggleAccion(accion)} className="accent-red-600 w-4 h-4 shrink-0" />
                    <span className={`text-sm flex-1 ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`}>{accion}</span>
                    {isCustom && (
                      <button type="button" onClick={(e) => { e.preventDefault(); removeCustom(accion); }} className="text-zinc-500 hover:text-red-500 ml-2"><X size={14} /></button>
                    )}
                  </label>
                );
              })}
              <button type="button" onClick={() => setShowOtrosModal(true)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${darkMode ? 'text-red-400 hover:bg-zinc-800/60' : 'text-red-600 hover:bg-red-50'}`}>
                <Plus size={16} />Otros (acción personalizada)
              </button>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className={`px-5 py-2 rounded-lg border text-sm font-medium ${darkMode ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>Cancelar</button>
            <button type="submit" disabled={!asunto.trim() || !fecha || !selectedUser || loading}
              className="px-5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar Ruta'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
};

// ─── Tabla de hojas de ruta ───────────────────────────────────────────────────
const RutaTable: React.FC<{
  rutas: ApiHojaDeRuta[];
  darkMode: boolean;
  currentUserId: string;
  onDelete: (id: string) => void;
}> = ({ rutas, darkMode, currentUserId, onDelete }) => {
  const thClass = `px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`;
  const tdClass = `px-4 py-3 text-sm align-middle ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`;

  return (
    <div className={`rounded-xl border overflow-x-auto ${darkMode ? 'border-zinc-800' : 'border-slate-200'}`}>
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr className={`border-b ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
            <th className={thClass}>Asunto</th>
            <th className={thClass}>Remitente</th>
            <th className={thClass}>Destinatario</th>
            <th className={thClass}>Fecha de entrada</th>
            <th className={thClass}>Fecha límite</th>
            <th className={thClass}>Tiempo restante</th>
            <th className={thClass + ' text-right'}>Acciones</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${darkMode ? 'divide-zinc-800' : 'divide-slate-100'}`}>
          {rutas.map((r) => {
            const entradaStr = new Date(r.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const limiteStr = new Date(r.fecha_limite).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const canDelete = r.remitente_id === currentUserId;

            return (
              <tr key={r.id} className={`transition-colors ${darkMode ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50'}`}>
                <td className={tdClass}>
                  <div className="font-semibold max-w-[180px] truncate" title={r.asunto}>{r.asunto}</div>
                  {r.acciones.length > 0 && (
                    <div className={`mt-1 text-xs ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                      {r.acciones.length} acción{r.acciones.length !== 1 ? 'es' : ''}
                    </div>
                  )}
                </td>
                <td className={tdClass}>{r.remitente_nombre || '—'}</td>
                <td className={tdClass}>{r.destinatario_nombre || '—'}</td>
                <td className={tdClass + ' whitespace-nowrap'}>{entradaStr}</td>
                <td className={tdClass + ' whitespace-nowrap'}>{limiteStr}</td>
                <td className={tdClass}>
                  <TimerBadge createdAt={r.created_at} fechaLimite={r.fecha_limite} darkMode={darkMode} />
                </td>
                <td className={`${tdClass} text-right`}>
                  {canDelete && (
                    <button onClick={() => onDelete(r.id)} className="text-zinc-500 hover:text-red-500 transition-colors p-1 rounded" title="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────
const PRIVILEGED_ROLES = new Set(['ceo', 'administrativo', 'admin', 'gerente', 'desarrollador', 'dev', 'desarrollador']);

export const HojaDeRuta: React.FC<HojaDeRutaProps> = ({ darkMode, users, userRole, currentUserId }) => {
  const [view, setView] = useState<'list' | 'new'>('list');
  const [rutas, setRutas] = useState<ApiHojaDeRuta[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreate = PRIVILEGED_ROLES.has(userRole.toLowerCase());

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHojasDeRuta();
      setRutas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando hojas de ruta:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchRutas(); }, [fetchRutas]);

  const handleDelete = async (id: string) => {
    try {
      await deleteHojaDeRuta(id);
      setRutas((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Error eliminando hoja de ruta:', err);
    }
  };

  if (view === 'new') {
    return (
      <NuevaRutaForm
        darkMode={darkMode}
        users={users}
        onSave={() => { void fetchRutas(); setView('list'); }}
        onCancel={() => setView('list')}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${darkMode ? 'bg-red-900/20 text-red-500' : 'bg-red-50 text-red-600'}`}>
            <MapIcon size={20} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Hoja de Ruta</h2>
            <p className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
              {canCreate ? 'Gestiona y asigna instrucciones institucionales' : 'Instrucciones asignadas a tu usuario'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRutas} className={`p-2 rounded-lg border transition-colors ${darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-400' : 'border-slate-300 hover:bg-slate-100 text-slate-500'}`} title="Actualizar">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {canCreate && (
            <button onClick={() => setView('new')} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">
              <Plus size={16} />Nueva Ruta
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className={`flex items-center justify-center py-20 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
          <RefreshCw size={24} className="animate-spin mr-2" />
          <span className="text-sm">Cargando hojas de ruta...</span>
        </div>
      ) : rutas.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 gap-3 rounded-xl border ${darkMode ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'}`}>
          <MapIcon size={40} className="opacity-30" />
          <p className="text-sm font-medium">No hay hojas de ruta registradas</p>
          {canCreate && <p className="text-xs">Haz clic en "Nueva Ruta" para comenzar</p>}
        </div>
      ) : (
        <RutaTable
          rutas={rutas}
          darkMode={darkMode}
          currentUserId={currentUserId}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};
