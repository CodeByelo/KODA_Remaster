'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { createTicket } from '../../../../lib/api';
import { RoleGuard } from '../../../../components/RoleGuard';
import { useAuth } from '../../../../hooks/useAuth';

const TECH_DEPT = 'Gerencia Nacional de Tecnologias de la Informacion y la Comunicacion';

export default function NewTicketPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'ALTA' | 'MEDIA' | 'BAJA'>('MEDIA');
  const [observations, setObservations] = useState('');

  const effectivePriority = useMemo(() => {
    if (String(user?.role || '').toLowerCase() === 'usuario') return 'MEDIA';
    return priority;
  }, [priority, user?.role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      window.alert('Titulo y descripcion son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      await createTicket({
        titulo: title.trim(),
        descripcion: description.trim(),
        prioridad: effectivePriority.toLowerCase(),
        observaciones: observations.trim(),
      });
      window.alert('Ticket creado correctamente.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error creando ticket:', error);
      window.alert('No se pudo crear el ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['CEO', 'Administrativo', 'Usuario', 'Desarrollador', 'Gerente']} redirectTo="/login">
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            <h1 className="text-2xl font-bold inline-flex items-center gap-2">
              <Plus size={20} />
              Nuevo Ticket
            </h1>
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:p-7 space-y-5">
            <div>
              <label className="block mb-1 text-sm font-semibold">Titulo de la Solicitud</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700"
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-semibold">Descripcion Detallada</label>
              <textarea
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-semibold">Area Destino</label>
                <input
                  value={TECH_DEPT}
                  disabled
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 opacity-80"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Prioridad</label>
                <select
                  value={effectivePriority}
                  onChange={(e) => setPriority(e.target.value as 'ALTA' | 'MEDIA' | 'BAJA')}
                  disabled={String(user?.role || '').toLowerCase() === 'usuario'}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700"
                >
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-semibold">Observaciones</label>
              <textarea
                rows={4}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-5 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-red-700 hover:bg-red-800 font-semibold disabled:opacity-60 text-white"
              >
                {loading ? (
                  'Guardando...'
                ) : (
                  <>
                    <Save size={16} /> Crear Ticket
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
