'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MapIcon,
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
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RutaUser {
  id: string;
  nombre: string;
  apellido: string;
  usuario_corp?: string;
  username?: string;
}

export interface Ruta {
  id: string;
  asunto: string;
  fechaLimite: string; // ISO string
  acciones: string[];
  destinatarioId: string;
  destinatarioNombre: string;
  creadoEn: string;
}

interface HojaDeRutaProps {
  darkMode: boolean;
  users: RutaUser[];
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

// ─── Modal "Otros" ────────────────────────────────────────────────────────────
const OtrosModal: React.FC<{
  darkMode: boolean;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}> = ({ darkMode, onConfirm, onCancel }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
          darkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Acción personalizada</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className={`text-sm ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
          Escribe la acción que deseas añadir. Se revisará la ortografía automáticamente.
        </p>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={true}
          lang="es"
          rows={3}
          placeholder="Ej: Revisar el informe y enviar observaciones..."
          className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-600 ${
            darkMode
              ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
          }`}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              darkMode ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Añadir acción
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Formulario Nueva Ruta ────────────────────────────────────────────────────
const NuevaRutaForm: React.FC<{
  darkMode: boolean;
  users: RutaUser[];
  onSave: (ruta: Ruta) => void;
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cierra el dropdown si se hace clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        ...u,
        label: `${u.nombre} ${u.apellido} (${u.usuario_corp || u.username || 'usuario'})`.trim(),
      })),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return userOptions;
    return userOptions.filter((u) => u.label.toLowerCase().includes(q));
  }, [recipientSearch, userOptions]);

  const toggleAccion = (accion: string) => {
    setCheckedAcciones((prev) =>
      prev.includes(accion) ? prev.filter((a) => a !== accion) : [...prev, accion],
    );
  };

  const removeCustomAccion = (accion: string) => {
    setCustomAcciones((prev) => prev.filter((a) => a !== accion));
    setCheckedAcciones((prev) => prev.filter((a) => a !== accion));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asunto.trim() || !fecha || !selectedUser) return;

    const todasAcciones = [...checkedAcciones];
    const ruta: Ruta = {
      id: crypto.randomUUID(),
      asunto: asunto.trim(),
      fechaLimite: `${fecha}T${hora || '23:59'}`,
      acciones: todasAcciones,
      destinatarioId: selectedUser.id,
      destinatarioNombre: `${selectedUser.nombre} ${selectedUser.apellido}`.trim(),
      creadoEn: new Date().toISOString(),
    };
    onSave(ruta);
  };

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-600 ${
    darkMode
      ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
  }`;

  const labelClass = `block mb-1 text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`;

  const allAcciones = [...ACCIONES_PREDEFINIDAS, ...customAcciones];

  return (
    <>
      {showOtrosModal && (
        <OtrosModal
          darkMode={darkMode}
          onConfirm={(text) => {
            setCustomAcciones((prev) => [...prev, text]);
            setCheckedAcciones((prev) => [...prev, text]);
            setShowOtrosModal(false);
          }}
          onCancel={() => setShowOtrosModal(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ArrowLeft size={15} />
            Volver
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Plus size={18} className="text-red-500" />
            Nueva Hoja de Ruta
          </h2>
        </div>

        <div
          className={`rounded-2xl border p-5 md:p-7 space-y-5 ${
            darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Asunto */}
          <div>
            <label className={labelClass}>
              <FileText size={12} className="inline mr-1" />
              Asunto
            </label>
            <input
              required
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Escribe el asunto de la hoja de ruta..."
              className={inputClass}
            />
          </div>

          {/* Fecha y hora límite */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                <Calendar size={12} className="inline mr-1" />
                Fecha límite
              </label>
              <input
                required
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                <Clock size={12} className="inline mr-1" />
                Hora límite (opcional)
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Destinatario */}
          <div>
            <label className={labelClass}>
              <User2 size={12} className="inline mr-1" />
              Destinatario
            </label>
            <div className="relative" ref={dropdownRef}>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  darkMode
                    ? 'bg-zinc-950 border-zinc-700 hover:border-zinc-500'
                    : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                }`}
                onClick={() => setDropdownOpen((v) => !v)}
              >
                <Search size={14} className={darkMode ? 'text-zinc-500' : 'text-slate-400'} />
                <input
                  value={selectedUser ? `${selectedUser.nombre} ${selectedUser.apellido}` : recipientSearch}
                  onChange={(e) => {
                    setRecipientSearch(e.target.value);
                    setSelectedUser(null);
                    setDropdownOpen(true);
                  }}
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(true); }}
                  placeholder="Buscar usuario..."
                  className={`flex-1 bg-transparent text-sm focus:outline-none ${
                    darkMode ? 'text-zinc-100 placeholder:text-zinc-500' : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                {selectedUser && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedUser(null); setRecipientSearch(''); }}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <X size={14} />
                  </button>
                )}
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''} ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`} />
              </div>

              {dropdownOpen && (
                <div
                  className={`absolute z-20 w-full mt-1 rounded-lg border shadow-xl max-h-52 overflow-y-auto ${
                    darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
                  }`}
                >
                  {filteredUsers.length === 0 ? (
                    <div className={`px-4 py-3 text-sm italic ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                      No se encontraron usuarios
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(u);
                          setRecipientSearch('');
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          darkMode
                            ? 'hover:bg-zinc-800 text-zinc-200'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div>
            <label className={labelClass}>
              <CheckSquare size={12} className="inline mr-1" />
              Acciones a tomar
            </label>
            <div
              className={`rounded-lg border divide-y ${
                darkMode ? 'border-zinc-800 divide-zinc-800' : 'border-slate-200 divide-slate-100'
              }`}
            >
              {allAcciones.map((accion) => {
                const isCustom = customAcciones.includes(accion);
                return (
                  <label
                    key={accion}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      darkMode ? 'hover:bg-zinc-800/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedAcciones.includes(accion)}
                      onChange={() => toggleAccion(accion)}
                      className="accent-red-600 w-4 h-4 shrink-0"
                    />
                    <span className={`text-sm flex-1 ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`}>
                      {accion}
                    </span>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); removeCustomAccion(accion); }}
                        className="text-zinc-500 hover:text-red-500 transition-colors ml-2"
                        title="Eliminar acción personalizada"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                );
              })}

              {/* Otros */}
              <button
                type="button"
                onClick={() => setShowOtrosModal(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  darkMode
                    ? 'text-red-400 hover:bg-zinc-800/60'
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <Plus size={16} />
                Otros (acción personalizada)
              </button>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                darkMode ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!asunto.trim() || !fecha || !selectedUser}
              className="px-5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Guardar Ruta
            </button>
          </div>
        </div>
      </form>
    </>
  );
};

// ─── Tarjeta de ruta guardada ─────────────────────────────────────────────────
const RutaCard: React.FC<{ ruta: Ruta; darkMode: boolean; onDelete: (id: string) => void }> = ({
  ruta,
  darkMode,
  onDelete,
}) => {
  const fechaObj = new Date(ruta.fechaLimite);
  const fechaStr = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  const horaStr = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const isExpired = fechaObj < new Date();

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-all ${
        darkMode ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm truncate ${darkMode ? 'text-zinc-100' : 'text-slate-900'}`}>
            {ruta.asunto}
          </h3>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
            Para: <span className="font-medium">{ruta.destinatarioNombre}</span>
          </p>
        </div>
        <button
          onClick={() => onDelete(ruta.id)}
          className="text-zinc-500 hover:text-red-500 transition-colors shrink-0"
          title="Eliminar ruta"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className={`flex items-center gap-1.5 text-xs ${isExpired ? 'text-red-500' : darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
        <Calendar size={12} />
        <span>{fechaStr}</span>
        <Clock size={12} className="ml-1" />
        <span>{horaStr}</span>
        {isExpired && <span className="ml-1 font-semibold">(Vencida)</span>}
      </div>

      {ruta.acciones.length > 0 && (
        <div className="space-y-1">
          {ruta.acciones.slice(0, 3).map((a) => (
            <div key={a} className={`flex items-center gap-2 text-xs ${darkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="truncate">{a}</span>
            </div>
          ))}
          {ruta.acciones.length > 3 && (
            <p className={`text-xs italic ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
              +{ruta.acciones.length - 3} acciones más
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────
export const HojaDeRuta: React.FC<HojaDeRutaProps> = ({ darkMode, users }) => {
  const [view, setView] = useState<'list' | 'new'>('list');
  const [rutas, setRutas] = useState<Ruta[]>([]);

  const handleSave = (ruta: Ruta) => {
    setRutas((prev) => [ruta, ...prev]);
    setView('list');
  };

  if (view === 'new') {
    return (
      <NuevaRutaForm
        darkMode={darkMode}
        users={users}
        onSave={handleSave}
        onCancel={() => setView('list')}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabecera con botón */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${darkMode ? 'bg-red-900/20 text-red-500' : 'bg-red-50 text-red-600'}`}>
            <MapIcon size={20} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Hoja de Ruta
            </h2>
            <p className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
              Gestiona instrucciones y rutas de acción institucionales
            </p>
          </div>
        </div>
        <button
          onClick={() => setView('new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          <Plus size={16} />
          Nueva Ruta
        </button>
      </div>

      {/* Lista de rutas */}
      {rutas.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center py-20 gap-3 rounded-xl border ${
            darkMode ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'
          }`}
        >
          <MapIcon size={40} className="opacity-30" />
          <p className="text-sm font-medium">No hay hojas de ruta registradas</p>
          <p className="text-xs">Haz clic en "Nueva Ruta" para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rutas.map((r) => (
            <RutaCard
              key={r.id}
              ruta={r}
              darkMode={darkMode}
              onDelete={(id) => setRutas((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
};
