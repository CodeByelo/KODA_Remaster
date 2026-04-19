'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  ArrowLeft,
  Calendar,
  Clock,
  CheckSquare,
  FileText,
  Trash2,
  X,
  Map as MapIcon,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import { getHojasDeRuta, createHojaDeRuta, deleteHojaDeRuta, ApiHojaDeRuta } from '../../../lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface HojaDeRutaProps {
  darkMode: boolean;
  users: unknown[];   // mantenido por compatibilidad con page.tsx
  userRole: string;
  currentUserId: string;
}

// ─── Coordinaciones disponibles ──────────────────────────────────────────────
const COORDINACIONES = [
  'Coordinación Aplicaciones',
  'Coordinación Soporte Técnico',
  'Coordinación Infraestructura',
];

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

// ─── Generador de PDF (ventana de impresión) ──────────────────────────────────
function generateHojaDeRutaPDF(data: {
  asunto: string;
  fechaLimite: string;
  acciones: string[];
  customAcciones: string[];
  coordinaciones: string[];
  remitente: string;
  createdAt: string;
}) {
  const allAcciones = [...ACCIONES_PREDEFINIDAS, ...data.customAcciones];
  const fechaDoc = new Date(data.createdAt).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const fechaLimiteStr = new Date(data.fechaLimite).toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const accionesRows = allAcciones.map((a, i) => {
    const checked = data.acciones.includes(a);
    return `
      <tr>
        <td style="width:30px; text-align:center; padding:3px 6px; border-bottom:1px solid #ddd; font-size:10pt;">
          ${checked ? '&#10003;' : '&#9633;'}
        </td>
        <td style="padding:3px 8px; border-bottom:1px solid #ddd; font-size:9.5pt;">${i + 1}. ${a}</td>
      </tr>`;
  }).join('');

  const coordRows = COORDINACIONES.map((c) => {
    const checked = data.coordinaciones.includes(c);
    return `
      <tr>
        <td style="width:30px; text-align:center; padding:5px 6px; border-bottom:1px solid #ddd; font-size:11pt;">
          ${checked ? '&#10003;' : '&#9633;'}
        </td>
        <td style="padding:5px 8px; border-bottom:1px solid #ddd; font-size:9.5pt;">${c}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Hoja de Ruta Institucional</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; background: #fff; padding: 15mm 18mm; }
    .outer-border { border: 2px solid #000; }
    .header-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 2px solid #000; }
    .company-block { flex: 1; }
    .company-name { font-size: 13pt; font-weight: bold; color: #b00; letter-spacing: .5px; }
    .company-sub { font-size: 8.5pt; color: #555; margin-top: 2px; }
    .doc-title { text-align: center; padding: 7px 10px; background: #222; color: #fff; font-size: 11pt; font-weight: bold; letter-spacing: 1px; border-bottom: 2px solid #000; }
    .info-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #000; }
    .info-table td { padding: 5px 10px; font-size: 9.5pt; border-right: 1px solid #ccc; }
    .info-table td.lbl { background: #eee; font-weight: bold; width: 130px; font-size: 8.5pt; text-transform: uppercase; }
    .info-table tr + tr td { border-top: 1px solid #ccc; }
    .section-header { background: #333; color: #fff; padding: 5px 10px; font-size: 9.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: .5px; }
    .two-col { display: flex; border-top: none; }
    .col-left { flex: 1; border-right: 2px solid #000; }
    .col-right { width: 220px; }
    .action-table { width: 100%; border-collapse: collapse; }
    .action-table td { vertical-align: middle; }
    .signatures { display: flex; gap: 40px; padding: 18px 14px 10px; border-top: 2px solid #000; }
    .sig-item { flex: 1; text-align: center; }
    .sig-line { border-top: 1px solid #000; margin-top: 28px; padding-top: 4px; font-size: 8.5pt; font-weight: bold; }
    @media print { body { padding: 10mm 12mm; } }
  </style>
</head>
<body>
<div class="outer-border">

  <!-- ENCABEZADO -->
  <div class="header-row">
    <div style="width:52px; height:52px; border:1px solid #aaa; display:flex; align-items:center; justify-content:center; font-size:8pt; color:#888; text-align:center;">LOGO</div>
    <div class="company-block">
      <div class="company-name">KODA REMASTER</div>
      <div class="company-sub">Sistema de Gestión Institucional</div>
    </div>
    <div style="text-align:right; font-size:8.5pt; color:#555;">
      Fecha: <strong>${fechaDoc}</strong>
    </div>
  </div>

  <!-- TÍTULO -->
  <div class="doc-title">HOJA DE RUTA INSTITUCIONAL</div>

  <!-- INFO -->
  <table class="info-table">
    <tr>
      <td class="lbl">Asunto</td>
      <td colspan="3" style="font-weight:600;">${data.asunto}</td>
    </tr>
    <tr>
      <td class="lbl">Elaborado por</td>
      <td>${data.remitente}</td>
      <td class="lbl" style="border-left:1px solid #ccc;">Fecha límite</td>
      <td>${fechaLimiteStr}</td>
    </tr>
  </table>

  <!-- DOS COLUMNAS -->
  <div class="two-col">
    <!-- ACCIONES A SEGUIR -->
    <div class="col-left">
      <div class="section-header">Acciones a Seguir</div>
      <table class="action-table">
        ${accionesRows}
      </table>
    </div>
    <!-- REMITIDO A LA COORDINACIÓN(ES) -->
    <div class="col-right">
      <div class="section-header">Remitido a la Coordinación(es)</div>
      <table class="action-table">
        ${coordRows}
      </table>
    </div>
  </div>

  <!-- FIRMAS -->
  <div class="signatures">
    <div class="sig-item">
      <div class="sig-line">Firma del Remitente</div>
    </div>
    <div class="sig-item">
      <div class="sig-line">Fecha y Hora de Entrega</div>
    </div>
    <div class="sig-item">
      <div class="sig-line">Firma del Receptor</div>
    </div>
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.addEventListener('load', () => win.print());
  }
}

// ─── Temporizador con reloj SVG (igual que Control de Seguimiento) ────────────
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
  const elapsed = Math.max(0, now - start);
  const progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 1;

  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const isOverdue = remaining <= 0;
  const remainingHours = remaining / (1000 * 60 * 60);
  const pct = total > 0 ? remaining / total : 0;
  const isCritical = !isOverdue && remainingHours <= 24;
  const isNearDue = !isOverdue && !isCritical && pct <= 0.5;

  const ringColor = isOverdue || isCritical ? '#ef4444' : isNearDue ? '#f59e0b' : '#22c55e';

  let label = '';
  if (isOverdue) {
    label = 'Vencida';
  } else {
    const days = Math.floor(remainingHours / 24);
    const hours = Math.floor(remainingHours % 24);
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) label = `${days}d`;
    else if (hours > 0) label = `${hours}h`;
    else label = `${mins}m`;
  }

  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" aria-hidden="true">
        {/* Track */}
        <circle cx="20" cy="20" r={radius} stroke={darkMode ? '#334155' : '#cbd5e1'} strokeWidth="3" fill="none" />
        {/* Progress arc */}
        {isOverdue ? (
          <circle cx="20" cy="20" r={radius} stroke={ringColor} strokeWidth="3" fill="none" />
        ) : (
          <circle
            cx="20" cy="20" r={radius}
            stroke={ringColor} strokeWidth="3" fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 20 20)"
          />
        )}
        {/* Center dot */}
        <circle cx="20" cy="20" r="1.8" fill={ringColor} />
        {/* Minute hand (animated) */}
        <g>
          <line x1="20" y1="20" x2="20" y2="9" stroke={ringColor} strokeWidth="1.8" strokeLinecap="round" />
          {!isOverdue && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 20 20"
              to="360 20 20"
              dur="8s"
              repeatCount="indefinite"
            />
          )}
        </g>
        {/* Hour hand */}
        <line x1="20" y1="20" x2="27" y2="20" stroke={ringColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      </svg>
      <span className={`text-[11px] font-semibold ${isOverdue ? 'text-red-400' : darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
        {label}
      </span>
    </div>
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
  currentUserName: string;
  onSave: (data: {
    asunto: string;
    fechaLimite: string;
    acciones: string[];
    customAcciones: string[];
    coordinaciones: string[];
    remitente: string;
    createdAt: string;
  }) => void;
  onCancel: () => void;
}> = ({ darkMode, currentUserName, onSave, onCancel }) => {
  const [asunto, setAsunto] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [checkedAcciones, setCheckedAcciones] = useState<string[]>([]);
  const [customAcciones, setCustomAcciones] = useState<string[]>([]);
  const [showOtrosModal, setShowOtrosModal] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleAccion = (accion: string) =>
    setCheckedAcciones((prev) => prev.includes(accion) ? prev.filter((a) => a !== accion) : [...prev, accion]);

  const toggleCoord = (coord: string) =>
    setSelectedCoords((prev) => prev.includes(coord) ? prev.filter((c) => c !== coord) : [...prev, coord]);

  const removeCustom = (accion: string) => {
    setCustomAcciones((prev) => prev.filter((a) => a !== accion));
    setCheckedAcciones((prev) => prev.filter((a) => a !== accion));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asunto.trim() || !fecha || selectedCoords.length === 0) return;
    setLoading(true);
    try {
      const fechaLimite = `${fecha}T${hora || '23:59'}:00`;
      const created = await createHojaDeRuta({
        asunto: asunto.trim(),
        fecha_limite: fechaLimite,
        acciones: checkedAcciones,
        coordinaciones: selectedCoords,
      });
      onSave({
        asunto: asunto.trim(),
        fechaLimite: created.fecha_limite,
        acciones: checkedAcciones,
        customAcciones,
        coordinaciones: selectedCoords,
        remitente: currentUserName,
        createdAt: created.created_at,
      });
    } catch (err) {
      console.error('Error creando hoja de ruta:', err);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-600 ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'}`;
  const labelClass = `block mb-1 text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`;
  const allAcciones = [...ACCIONES_PREDEFINIDAS, ...customAcciones];
  const canSubmit = asunto.trim() && fecha && selectedCoords.length > 0 && !loading;

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

          {/* Coordinaciones destinatarias */}
          <div>
            <label className={labelClass}><CheckSquare size={12} className="inline mr-1" />Remitido a la Coordinación(es)</label>
            <div className={`rounded-lg border divide-y ${darkMode ? 'border-zinc-800 divide-zinc-800' : 'border-slate-200 divide-slate-100'}`}>
              {COORDINACIONES.map((coord) => (
                <label key={coord} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${darkMode ? 'hover:bg-zinc-800/60' : 'hover:bg-slate-50'}`}>
                  <input
                    type="checkbox"
                    checked={selectedCoords.includes(coord)}
                    onChange={() => toggleCoord(coord)}
                    className="accent-red-600 w-4 h-4 shrink-0"
                  />
                  <span className={`text-sm ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`}>{coord}</span>
                </label>
              ))}
            </div>
            {selectedCoords.length === 0 && (
              <p className={`mt-1 text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>Selecciona al menos una coordinación</p>
            )}
          </div>

          {/* Acciones a seguir */}
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
            <button type="submit" disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-50">
              <FileDown size={15} />
              {loading ? 'Guardando...' : 'Guardar y generar PDF'}
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
  onDownload: (r: ApiHojaDeRuta) => void;
}> = ({ rutas, darkMode, currentUserId, onDelete, onDownload }) => {
  const thClass = `px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`;
  const tdClass = `px-4 py-3 text-sm align-middle ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`;

  return (
    <div className={`rounded-xl border overflow-x-auto ${darkMode ? 'border-zinc-800' : 'border-slate-200'}`}>
      <table className="w-full min-w-[750px] border-collapse">
        <thead>
          <tr className={`border-b ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
            <th className={thClass}>Asunto</th>
            <th className={thClass}>Remitente</th>
            <th className={thClass}>Coordinación(es)</th>
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
            const coords = Array.isArray(r.coordinaciones) ? r.coordinaciones : [];

            return (
              <tr key={r.id} className={`transition-colors ${darkMode ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50'}`}>
                <td className={tdClass}>
                  <div className="font-semibold max-w-[160px] truncate" title={r.asunto}>{r.asunto}</div>
                  {r.acciones.length > 0 && (
                    <div className={`mt-1 text-xs ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                      {r.acciones.length} acción{r.acciones.length !== 1 ? 'es' : ''}
                    </div>
                  )}
                </td>
                <td className={tdClass}>{r.remitente_nombre || '—'}</td>
                <td className={tdClass}>
                  {coords.length > 0
                    ? <div className="flex flex-col gap-1">
                        {coords.map((c) => (
                          <span key={c} className={`inline-block text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>{c}</span>
                        ))}
                      </div>
                    : <span className={darkMode ? 'text-zinc-500' : 'text-slate-400'}>—</span>
                  }
                </td>
                <td className={tdClass + ' whitespace-nowrap'}>{entradaStr}</td>
                <td className={tdClass + ' whitespace-nowrap'}>{limiteStr}</td>
                <td className={tdClass}>
                  <TimerBadge createdAt={r.created_at} fechaLimite={r.fecha_limite} darkMode={darkMode} />
                </td>
                <td className={`${tdClass} text-right`}>
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => onDownload(r)} className="text-zinc-500 hover:text-blue-500 transition-colors p-1 rounded" title="Descargar PDF">
                      <FileDown size={15} />
                    </button>
                    {canDelete && (
                      <button onClick={() => onDelete(r.id)} className="text-zinc-500 hover:text-red-500 transition-colors p-1 rounded" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
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
const PRIVILEGED_ROLES = new Set(['ceo', 'administrativo', 'admin', 'gerente', 'desarrollador', 'dev']);

export const HojaDeRuta: React.FC<HojaDeRutaProps> = ({ darkMode, userRole, currentUserId }) => {
  const [view, setView] = useState<'list' | 'new'>('list');
  const [tab, setTab] = useState<'todos' | 'enviados'>('todos');
  const [rutas, setRutas] = useState<ApiHojaDeRuta[]>([]);
  const [loading, setLoading] = useState(true);
  // currentUserName is read from token/localStorage on mount to pass to the form
  const [currentUserName, setCurrentUserName] = useState('');

  const canCreate = PRIVILEGED_ROLES.has(userRole.toLowerCase());

  useEffect(() => {
    try {
      const token = localStorage.getItem('token') || '';
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const nombre = payload.nombre || payload.name || '';
        const apellido = payload.apellido || payload.family_name || '';
        setCurrentUserName(`${nombre} ${apellido}`.trim() || payload.sub || '');
      }
    } catch { /* ignore */ }
  }, []);

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

  const handleDownload = (r: ApiHojaDeRuta) => {
    generateHojaDeRutaPDF({
      asunto: r.asunto,
      fechaLimite: r.fecha_limite,
      acciones: r.acciones ?? [],
      customAcciones: (r.acciones ?? []).filter((a) => !ACCIONES_PREDEFINIDAS.includes(a)),
      coordinaciones: r.coordinaciones ?? [],
      remitente: r.remitente_nombre || '',
      createdAt: r.created_at,
    });
  };

  if (view === 'new') {
    return (
      <NuevaRutaForm
        darkMode={darkMode}
        currentUserName={currentUserName}
        onSave={(pdfData) => {
          void fetchRutas();
          setView('list');
          generateHojaDeRutaPDF(pdfData);
        }}
        onCancel={() => setView('list')}
      />
    );
  }

  const displayedRutas = tab === 'enviados'
    ? rutas.filter((r) => r.remitente_id === currentUserId)
    : rutas;

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
              {canCreate ? 'Gestiona y asigna instrucciones institucionales' : 'Instrucciones asignadas a las coordinaciones'}
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

      {/* Tabs (solo roles privilegiados) */}
      {canCreate && (
        <div className={`flex gap-1 p-1 rounded-lg w-fit ${darkMode ? 'bg-zinc-800' : 'bg-slate-100'}`}>
          {(['todos', 'enviados'] as const).map((t) => {
            const labels = { todos: 'Todos', enviados: 'Enviados' };
            const counts = { todos: rutas.length, enviados: rutas.filter((r) => r.remitente_id === currentUserId).length };
            const isActive = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive
                    ? darkMode ? 'bg-zinc-700 text-white shadow' : 'bg-white text-slate-900 shadow'
                    : darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {labels[t]}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? darkMode ? 'bg-red-700 text-white' : 'bg-red-600 text-white'
                    : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-slate-200 text-slate-500'
                }`}>
                  {counts[t]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <div className={`flex items-center justify-center py-20 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
          <RefreshCw size={24} className="animate-spin mr-2" />
          <span className="text-sm">Cargando hojas de ruta...</span>
        </div>
      ) : displayedRutas.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 gap-3 rounded-xl border ${darkMode ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'}`}>
          <MapIcon size={40} className="opacity-30" />
          <p className="text-sm font-medium">
            {tab === 'enviados' ? 'No has enviado ninguna hoja de ruta' : 'No hay hojas de ruta registradas'}
          </p>
          {canCreate && tab === 'todos' && <p className="text-xs">Haz clic en "Nueva Ruta" para comenzar</p>}
        </div>
      ) : (
        <RutaTable
          rutas={displayedRutas}
          darkMode={darkMode}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};
