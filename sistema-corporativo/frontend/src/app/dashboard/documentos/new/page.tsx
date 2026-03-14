'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Save, Search } from 'lucide-react';
import { getAllUsers, getGerencias, uploadDocumento } from '../../../../lib/api';
import { RoleGuard } from '../../../../components/RoleGuard';
import { uiAlert } from '../../../../lib/ui-dialog';

type SendMode = 'user' | 'dept';

export default function NewDocumentoPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [gerencias, setGerencias] = useState<any[]>([]);
  const [sendMode, setSendMode] = useState<SendMode>('user');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('Informe');
  const [correlativo, setCorrelativo] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [priorityEnabled, setPriorityEnabled] = useState(false);
  const [priorityDays, setPriorityDays] = useState(3);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [targetDeptIds, setTargetDeptIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [u, g] = await Promise.all([getAllUsers(), getGerencias()]);
        setUsers(Array.isArray(u) ? u : []);
        setGerencias(Array.isArray(g) ? g : []);
      } catch (error) {
        console.error('Error cargando usuarios/gerencias:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedTheme = localStorage.getItem('dashboard_theme_2026');
      setDarkMode(storedTheme !== 'light');
    } catch (error) {
      console.error('No se pudo leer el tema del dashboard:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const userOptions = useMemo(
    () =>
      users
        .map((u) => ({
          id: String(u?.id || ''),
          label: `${u?.nombre || ''} ${u?.apellido || ''} (${u?.usuario_corp || u?.username || 'usuario'})`.trim(),
        }))
        .filter((x) => x.id),
    [users],
  );

  const deptOptions = useMemo(
    () =>
      (() => {
        const normalize = (value: string) =>
          value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        const map = new Map<string, { id: string; nombre: string }>();
        gerencias.forEach((g) => {
          const id = String(g?.id || '');
          const nombre = String(g?.nombre || '').trim();
          if (!id || !nombre) return;
          const key = normalize(nombre);
          if (!map.has(key)) map.set(key, { id, nombre });
        });
        return Array.from(map.values());
      })(),
    [gerencias],
  );

  const filteredUserOptions = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    if (!query) return userOptions;
    return userOptions.filter((item) => item.label.toLowerCase().includes(query));
  }, [recipientSearch, userOptions]);

  const filteredDeptOptions = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    if (!query) return deptOptions;
    return deptOptions.filter((item) => item.nombre.toLowerCase().includes(query));
  }, [recipientSearch, deptOptions]);

  const toggleUser = (id: string) => {
    setTargetUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleDept = (id: string) => {
    setTargetDeptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      void uiAlert('Solo se permiten archivos PDF.', 'Adjuntos');
      return;
    }
    setSelectedFiles((prev) => [...prev, file]);
    if (!docName) setDocName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = sendMode === 'dept' ? targetDeptIds : targetUserIds;
    if (recipients.length === 0) {
      void uiAlert('Selecciona al menos un destinatario.', 'Mensajería');
      return;
    }

    setLoading(true);
    try {
      const priorityValue = priorityEnabled ? 'control' : 'media';
      const manualId = correlativo.trim();
      const uploads = recipients.map((recipient) => {
        const formData = new FormData();
        formData.append('titulo', docName || 'Mensaje sin asunto');
        formData.append('tipo_documento', docCategory);
        formData.append('prioridad', priorityValue);
        formData.append('contenido', messageContent);

        if (manualId) formData.append('correlativo', manualId);
        if (priorityEnabled && priorityDays > 0) {
          formData.append('tiempo_maximo_dias', String(priorityDays));
        }

        if (sendMode === 'dept') {
          formData.append('receptor_gerencia_id', recipient);
        } else {
          formData.append('receptor_id', recipient);
        }

        selectedFiles.forEach((f) => formData.append('archivos', f));
        return uploadDocumento(formData);
      });

      await Promise.all(uploads);
      void uiAlert('Mensaje enviado correctamente.', 'Mensajería');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error enviando documento:', error);
      void uiAlert('No se pudo enviar el mensaje.', 'Mensajería');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['CEO', 'Administrativo', 'Usuario', 'Desarrollador', 'Gerente']} redirectTo="/login">
      <div className={`min-h-screen p-6 md:p-10 ${darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${darkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-slate-300 hover:bg-slate-100'}`}
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            <h1 className="text-2xl font-bold inline-flex items-center gap-2">
              <Mail size={20} />
              Nuevo Documento Interno
            </h1>
          </div>

          <form onSubmit={handleSubmit} className={`rounded-2xl border p-5 md:p-7 space-y-5 ${darkMode ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setSendMode('user');
                  setRecipientSearch('');
                }}
                className={`py-2.5 rounded-lg font-semibold border ${sendMode === 'user' ? 'bg-red-700 border-red-700 text-white' : darkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-slate-300 hover:bg-slate-100'}`}
              >
                A Usuario
              </button>
              <button
                type="button"
                onClick={() => {
                  setSendMode('dept');
                  setRecipientSearch('');
                }}
                className={`py-2.5 rounded-lg font-semibold border ${sendMode === 'dept' ? 'bg-red-700 border-red-700 text-white' : darkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-slate-300 hover:bg-slate-100'}`}
              >
                A Gerencia
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-semibold">Asunto</label>
                <input
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Formato de documento</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                >
                  <option>Informe</option>
                  <option>Memorando</option>
                  <option>Circular</option>
                  <option>Solicitud</option>
                  <option>Otros</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-semibold">Correlativo (manual)</label>
                <input
                  value={correlativo}
                  onChange={(e) => setCorrelativo(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Adjunto PDF (opcional)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900 file:text-slate-900'}`}
                />
              </div>
            </div>

            <div className={`rounded-lg border p-3 ${darkMode ? 'border-zinc-800' : 'border-slate-200 bg-slate-50'}`}>
              <label className="inline-flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={priorityEnabled} onChange={(e) => setPriorityEnabled(e.target.checked)} />
                Control de seguimiento (prioridad)
              </label>

              {priorityEnabled && (
                <div className="mt-3">
                  <label className="block mb-1 text-sm">Tiempo máximo (días)</label>
                  <input
                    type="number"
                    min={1}
                    value={priorityDays}
                    onChange={(e) => setPriorityDays(Math.max(1, Number(e.target.value || 1)))}
                    className={`w-full md:w-56 px-3 py-2 rounded-lg border ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold">
                {sendMode === 'user' ? 'Destinatarios (usuarios)' : 'Destinatarios (gerencias)'}
              </label>
              <div className="relative mb-3">
                <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-zinc-500' : 'text-slate-500'}`} />
                <input
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder={sendMode === 'user' ? 'Buscar usuario o corporativo...' : 'Buscar gerencia...'}
                  className={`w-full pl-10 pr-3 py-2 rounded-lg border placeholder:text-zinc-500 ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500'}`}
                />
              </div>
              <div className={`max-h-56 overflow-y-auto rounded-lg border p-3 space-y-2 ${darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-slate-200 bg-slate-50'}`}>
                {(sendMode === 'user' ? filteredUserOptions : filteredDeptOptions).map((item: any) => (
                  <label key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sendMode === 'user' ? targetUserIds.includes(item.id) : targetDeptIds.includes(item.id)}
                      onChange={() => (sendMode === 'user' ? toggleUser(item.id) : toggleDept(item.id))}
                    />
                    <span className="text-sm">{item.label || item.nombre}</span>
                  </label>
                ))}
                {(sendMode === 'user' ? filteredUserOptions : filteredDeptOptions).length === 0 && (
                  <div className={`py-4 text-sm italic ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                    No se encontraron destinatarios con ese filtro.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-semibold">Mensaje / Contenido</label>
              <textarea
                rows={6}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className={`px-5 py-2 rounded-lg border ${darkMode ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-red-700 hover:bg-red-800 font-semibold disabled:opacity-60 text-white"
              >
                {loading ? (
                  'Enviando...'
                ) : (
                  <>
                    <Save size={16} /> Guardar y Enviar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
