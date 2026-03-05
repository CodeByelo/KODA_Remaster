'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Upload, Save } from 'lucide-react';
import { getAllUsers, getGerencias, uploadDocumento } from '../../../../lib/api';
import { RoleGuard } from '../../../../components/RoleGuard';

type SendMode = 'user' | 'dept';

export default function NewDocumentoPage() {
  const router = useRouter();
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
      gerencias
        .map((g) => ({ id: String(g?.id || ''), nombre: String(g?.nombre || '').trim() }))
        .filter((g) => g.id && g.nombre),
    [gerencias],
  );

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
      window.alert('Solo se permiten archivos PDF.');
      return;
    }
    setSelectedFiles((prev) => [...prev, file]);
    if (!docName) setDocName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = sendMode === 'dept' ? targetDeptIds : targetUserIds;
    if (recipients.length === 0) {
      window.alert('Selecciona al menos un destinatario.');
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
      window.alert('Mensaje enviado correctamente.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error enviando documento:', error);
      window.alert('No se pudo enviar el mensaje.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['CEO', 'Administrativo', 'Usuario', 'Desarrollador', 'Gerente']} redirectTo="/login">
      <div className="min-h-screen bg-[#1B103B] text-white p-6 md:p-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            <h1 className="text-2xl font-bold inline-flex items-center gap-2">
              <Mail size={20} />
              Nuevo Documento Interno
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/15 bg-[#24164d] p-5 md:p-7 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSendMode('user')}
                className={`py-2.5 rounded-lg font-semibold border ${sendMode === 'user' ? 'bg-[#8C2226] border-[#8C2226]' : 'border-white/20'}`}
              >
                A Usuario
              </button>
              <button
                type="button"
                onClick={() => setSendMode('dept')}
                className={`py-2.5 rounded-lg font-semibold border ${sendMode === 'dept' ? 'bg-[#8C2226] border-[#8C2226]' : 'border-white/20'}`}
              >
                A Gerencia
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-semibold">Asunto</label>
                <input value={docName} onChange={(e) => setDocName(e.target.value)} required className="w-full px-3 py-2 rounded-lg bg-[#1B103B] border border-white/20" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Formato de documento</label>
                <select value={docCategory} onChange={(e) => setDocCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1B103B] border border-white/20">
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
                <input value={correlativo} onChange={(e) => setCorrelativo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1B103B] border border-white/20" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Adjunto PDF (opcional)</label>
                <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full px-3 py-2 rounded-lg bg-[#1B103B] border border-white/20" />
              </div>
            </div>

            <div className="rounded-lg border border-white/15 p-3">
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
                    className="w-full md:w-56 px-3 py-2 rounded-lg bg-[#1B103B] border border-white/20"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold">
                {sendMode === 'user' ? 'Destinatarios (usuarios)' : 'Destinatarios (gerencias)'}
              </label>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-white/15 p-3 space-y-2 bg-[#1B103B]">
                {(sendMode === 'user' ? userOptions : deptOptions).map((item: any) => (
                  <label key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sendMode === 'user' ? targetUserIds.includes(item.id) : targetDeptIds.includes(item.id)}
                      onChange={() => (sendMode === 'user' ? toggleUser(item.id) : toggleDept(item.id))}
                    />
                    <span className="text-sm">{item.label || item.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-semibold">Mensaje / contenido</label>
              <textarea
                rows={6}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1B103B] border border-white/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => router.push('/dashboard')} className="px-5 py-2 rounded-lg border border-white/20">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#8C2226] hover:bg-[#a12a2f] font-semibold disabled:opacity-60">
                {loading ? 'Enviando...' : (<><Save size={16} /> Guardar y Enviar</>)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}

