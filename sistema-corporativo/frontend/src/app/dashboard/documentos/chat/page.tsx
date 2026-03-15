'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { RoleGuard } from '../../../../components/RoleGuard';
import { useAuth } from '../../../../hooks/useAuth';
import { getDocumentos, markAsRead, uploadDocumento } from '../../../../lib/api';
import { uiAlert } from '../../../../lib/ui-dialog';

type Document = {
  id: number;
  idDoc?: string;
  name?: string;
  category?: string;
  uploadedBy?: string;
  receivedBy?: string;
  receptor_id?: string;
  receptor_gerencia_id?: number;
  remitente_id?: string;
  receptor_gerencia_id_usuario?: number;
  receptor_gerencia_nombre_usuario?: string;
  remitente_gerencia_id?: number;
  remitente_gerencia_nombre?: string;
  uploadDate?: string;
  uploadTime?: string;
  signatureStatus?: string;
  targetDepartment?: string;
  fileUrl?: string;
  archivos?: string[];
  contenido?: string;
  leido?: boolean;
};

const API_FALLBACK = 'https://corpoelect-backend.onrender.com';

function parseFlexibleDateGlobal(value?: string) {
  if (!value) return null;
  const raw = String(value).trim();
  const latin = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (latin) {
    const [, dRaw, mRaw, y, hh = '00', mm = '00', ss = '00'] = latin;
    const d = dRaw.padStart(2, '0');
    const m = mRaw.padStart(2, '0');
    const date = new Date(`${y}-${m}-${d}T${hh.padStart(2, '0')}:${mm}:${ss}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function MensajeriaChatClient() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [sending, setSending] = useState(false);

  const conversationKey = searchParams.get('key') || '';
  const conversationLabel = searchParams.get('label') || 'Conversación';
  const docView = searchParams.get('view') || 'inbox';

  const currentUserId = user?.id ? String(user.id) : '';

  const getDocTimestamp = useCallback((doc: Document) => {
    const combined = [doc.uploadDate, doc.uploadTime].filter(Boolean).join(' ');
    const parsed =
      parseFlexibleDateGlobal(combined) ||
      parseFlexibleDateGlobal(doc.uploadDate) ||
      null;
    return parsed ? parsed.getTime() : 0;
  }, []);

  const getConversationKey = useCallback(
    (doc: Document) => {
      const senderId = doc.remitente_id ? String(doc.remitente_id) : '';
      const receiverId = doc.receptor_id ? String(doc.receptor_id) : '';
      if (senderId && receiverId) {
        const otherId =
          senderId === currentUserId
            ? receiverId
            : receiverId === currentUserId
              ? senderId
              : receiverId;
        if (otherId) return `user:${otherId}`;
      }
      if (doc.receptor_gerencia_id) return `dept:${doc.receptor_gerencia_id}`;
      const deptName = String(doc.targetDepartment || '')
        .toLowerCase()
        .trim();
      return deptName ? `dept-name:${deptName}` : `misc:${doc.id}`;
    },
    [currentUserId],
  );

  const canMarkDocAsRead = useCallback(
    (doc: Document) => {
      const isDirectRecipient =
        !!doc.receptor_id && !!currentUserId && String(doc.receptor_id) === currentUserId;
      if (isDirectRecipient) return true;
      const isDeptRecipient =
        !!doc.receptor_gerencia_id &&
        !!user?.gerencia_id &&
        String(doc.receptor_gerencia_id) === String(user.gerencia_id);
      if (isDeptRecipient) return true;
      const docDept = String(doc.targetDepartment || '').toLowerCase().trim();
      const userDeptLower = String(user?.gerencia_depto || '').toLowerCase().trim();
      return !!docDept && !!userDeptLower && docDept === userDeptLower;
    },
    [currentUserId, user?.gerencia_depto, user?.gerencia_id],
  );

  const conversationDocs = useMemo(() => {
    if (!conversationKey) return [];
    return documents
      .filter((doc) => getConversationKey(doc) === conversationKey)
      .sort((a, b) => getDocTimestamp(a) - getDocTimestamp(b));
  }, [conversationKey, documents, getConversationKey, getDocTimestamp]);

  const refreshDocuments = useCallback(async () => {
    try {
      const data = await getDocumentos();
      const mapped = data.map((d: any) => {
        let uploadDate = 'N/A';
        let uploadTime = 'N/A';
        if (d.fecha_creacion || d.uploadDate) {
          try {
            if (d.uploadDate) {
              uploadDate = d.uploadDate;
              uploadTime = d.uploadTime || 'N/A';
            } else {
              const date = new Date(d.fecha_creacion);
              if (!Number.isNaN(date.getTime())) {
                uploadDate = date.toLocaleDateString('es-ES');
                uploadTime = date.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
              }
            }
          } catch {
            // ignore
          }
        }
        const signatureStatusValue =
          d.estado ?? d.signatureStatus ?? d.signaturestatus ?? d.status ?? 'en-proceso';
        const normalizedSignatureStatus = String(signatureStatusValue)
          .toLowerCase()
          .trim()
          .replaceAll('_', '-')
          .replaceAll(' ', '-');

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || API_FALLBACK;
        const normalizeUrl = (url?: string) =>
          url ? (url.startsWith('http') ? url : `${baseUrl}${url}`) : undefined;

        const rawCorrelativo =
          d.correlativo ??
          d.idDoc ??
          d.iddoc ??
          d.numero_documento ??
          d.numeroDocumento;
        const correlativoValue =
          rawCorrelativo !== null && rawCorrelativo !== undefined && String(rawCorrelativo).trim() !== ''
            ? String(rawCorrelativo).trim()
            : 'N/A';

        return {
          id: d.id,
          idDoc: correlativoValue,
          name: d.titulo || d.title || d.name || 'Sin Título',
          category: d.tipo_documento || d.category || 'Otros',
          uploadedBy: d.uploadedBy || d.remitente_nombre || 'Desconocido',
          receivedBy: d.receptor_nombre || d.receivedBy || 'Pendiente',
          receptor_id: d.receptor_id ? String(d.receptor_id) : undefined,
          receptor_gerencia_id: d.receptor_gerencia_id ? Number(d.receptor_gerencia_id) : undefined,
          remitente_id: d.remitente_id ? String(d.remitente_id) : undefined,
          receptor_gerencia_id_usuario: d.receptor_gerencia_id_usuario
            ? Number(d.receptor_gerencia_id_usuario)
            : undefined,
          receptor_gerencia_nombre_usuario: d.receptor_gerencia_nombre_usuario,
          remitente_gerencia_id: d.remitente_gerencia_id ? Number(d.remitente_gerencia_id) : undefined,
          remitente_gerencia_nombre: d.remitente_gerencia_nombre,
          uploadDate,
          uploadTime,
          signatureStatus: normalizedSignatureStatus,
          targetDepartment:
            d.targetDepartment ||
            d.receptor_gerencia_nombre ||
            d.receptor_gerencia_nombre_usuario ||
            'Sin Asignar',
          fileUrl: normalizeUrl(d.fileUrl) || (d.archivos && d.archivos.length > 0 ? normalizeUrl(d.archivos[0]) : undefined),
          archivos: (d.archivos || []).map((url: string) => normalizeUrl(url)).filter(Boolean) as string[],
          contenido: d.contenido,
          leido: d.leido,
        } satisfies Document;
      });
      setDocuments(mapped);
    } catch (error) {
      console.error('Error fetching documents', error);
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    const unreadIds = conversationDocs
      .filter((doc) => !doc.leido && canMarkDocAsRead(doc))
      .map((doc) => doc.id);
    if (unreadIds.length === 0) return;
    setDocuments((prev) =>
      prev.map((d) =>
        unreadIds.includes(d.id)
          ? { ...d, leido: true, signatureStatus: d.signatureStatus === 'en-proceso' ? 'recibido' : d.signatureStatus }
          : d,
      ),
    );
    void Promise.allSettled(unreadIds.map((id) => markAsRead(id)));
  }, [canMarkDocAsRead, conversationDocs]);

  const sendReply = async () => {
    const content = replyDraft.trim();
    if (!content) {
      void uiAlert('Escribe un mensaje antes de enviar.', 'Mensajería');
      return;
    }
    let recipientType: 'user' | 'dept' | 'dept-name' | null = null;
    let recipientValue = '';
    if (conversationKey.startsWith('user:')) {
      recipientType = 'user';
      recipientValue = conversationKey.slice(5);
    } else if (conversationKey.startsWith('dept:')) {
      recipientType = 'dept';
      recipientValue = conversationKey.slice(5);
    } else if (conversationKey.startsWith('dept-name:')) {
      recipientType = 'dept-name';
      recipientValue = conversationKey.slice(10);
    }
    if (!recipientType || !recipientValue) {
      void uiAlert('No se pudo determinar el destinatario de esta conversación.', 'Mensajería');
      return;
    }
    try {
      setSending(true);
      const formData = new FormData();
      formData.append('titulo', `Respuesta - ${conversationLabel}`.trim());
      formData.append('tipo_documento', 'Mensaje');
      formData.append('prioridad', 'media');
      formData.append('contenido', content);
      if (recipientType === 'user') {
        formData.append('receptor_id', recipientValue);
      } else if (recipientType === 'dept') {
        formData.append('receptor_gerencia_id', recipientValue);
      } else {
        formData.append('receptor_gerencia_nombre', recipientValue);
      }
      await uploadDocumento(formData);
      await refreshDocuments();
      setReplyDraft('');
    } catch (error) {
      console.error('Error sending reply:', error);
      void uiAlert('No se pudo enviar el mensaje.', 'Mensajería');
    } finally {
      setSending(false);
    }
  };

  return (
    <RoleGuard
      allowedRoles={['CEO', 'Administrativo', 'Usuario', 'Desarrollador', 'Gerente']}
      redirectTo="/login"
    >
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.close()}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                Cerrar ventana
              </button>
              <div>
                <h1 className="text-xl font-bold">Mensajería Interna</h1>
                <p className="text-xs text-slate-400">
                  Conversación con {conversationLabel} • {docView}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col min-h-[70vh]">
            <div className="flex-1 p-6 space-y-4 overflow-y-auto no-scrollbar">
              {conversationDocs.length === 0 && (
                <div className="text-slate-400 italic">No hay mensajes en esta conversación.</div>
              )}
              {conversationDocs.map((msg) => {
                const isMine = currentUserId && msg.remitente_id && String(msg.remitente_id) === currentUserId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                        isMine
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-100 rounded-bl-none'
                      }`}
                    >
                      <div className={`text-[11px] mb-2 ${isMine ? 'text-emerald-100/80' : 'text-slate-400'}`}>
                        {msg.uploadedBy || 'Remitente'} • {msg.uploadDate} {msg.uploadTime}
                      </div>
                      {msg.contenido ? (
                        <div>{msg.contenido}</div>
                      ) : (
                        <div className="italic opacity-80">Sin contenido de mensaje en texto.</div>
                      )}
                      {(msg.fileUrl || (msg.archivos || []).length > 0) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {msg.fileUrl && (
                            <a
                              href={msg.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
                                isMine
                                  ? 'border-white/30 text-white hover:bg-white/10'
                                  : 'border-slate-600 text-slate-200 hover:bg-slate-700/50'
                              }`}
                            >
                              Ver archivo
                            </a>
                          )}
                          {(msg.archivos || []).map((file: string, idx: number) => (
                            <a
                              key={`${file}-${idx}`}
                              href={file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
                                isMine
                                  ? 'border-white/30 text-white hover:bg-white/10'
                                  : 'border-slate-600 text-slate-200 hover:bg-slate-700/50'
                              }`}
                            >
                              Adjunto {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <div className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                  placeholder="Escribe tu respuesta..."
                  className="flex-1 rounded-full px-4 py-2 text-sm outline-none resize-none bg-slate-950 border border-slate-800 text-slate-200"
                />
                <button
                  onClick={() => void sendReply()}
                  disabled={!replyDraft.trim() || sending}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${
                    sending ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Enviar"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}

export default function MensajeriaChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MensajeriaChatClient />
    </Suspense>
  );
}
