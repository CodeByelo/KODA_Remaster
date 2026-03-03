'use client';

import React, { useEffect, useMemo, useState } from 'react';

type DialogKind = 'alert' | 'confirm' | 'prompt';

type DialogRequest = {
  kind: DialogKind;
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  resolve: (value: unknown) => void;
};

let enqueueDialog: ((request: DialogRequest) => void) | null = null;

function fallbackAlert(message: string) {
  if (typeof window !== 'undefined') window.alert(message);
}

function fallbackConfirm(message: string): boolean {
  if (typeof window !== 'undefined') return window.confirm(message);
  return false;
}

function fallbackPrompt(message: string, defaultValue = ''): string | null {
  if (typeof window !== 'undefined') return window.prompt(message, defaultValue);
  return null;
}

export function uiAlert(message: string, title = 'Mensaje'): Promise<void> {
  return new Promise((resolve) => {
    if (!enqueueDialog) {
      fallbackAlert(message);
      resolve();
      return;
    }
    enqueueDialog({ kind: 'alert', title, message, resolve: () => resolve() });
  });
}

export function uiConfirm(message: string, title = 'Confirmar'): Promise<boolean> {
  return new Promise((resolve) => {
    if (!enqueueDialog) {
      resolve(fallbackConfirm(message));
      return;
    }
    enqueueDialog({ kind: 'confirm', title, message, resolve });
  });
}

export function uiPrompt(
  message: string,
  defaultValue = '',
  title = 'Ingresar valor',
  placeholder = 'Escriba aqui...',
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!enqueueDialog) {
      resolve(fallbackPrompt(message, defaultValue));
      return;
    }
    enqueueDialog({ kind: 'prompt', title, message, defaultValue, placeholder, resolve });
  });
}

export function SystemDialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [inputValue, setInputValue] = useState('');
  const current = queue[0] || null;

  useEffect(() => {
    enqueueDialog = (request: DialogRequest) => {
      setQueue((prev) => [...prev, request]);
    };
    return () => {
      enqueueDialog = null;
    };
  }, []);

  useEffect(() => {
    if (current?.kind === 'prompt') {
      setInputValue(current.defaultValue || '');
    } else {
      setInputValue('');
    }
  }, [current]);

  const close = (result: unknown) => {
    if (!current) return;
    current.resolve(result);
    setQueue((prev) => prev.slice(1));
  };

  const confirmLabel = useMemo(() => {
    if (!current) return 'Aceptar';
    if (current.kind === 'confirm') return 'Confirmar';
    if (current.kind === 'prompt') return 'Aplicar';
    return 'Aceptar';
  }, [current]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-r from-red-900/40 via-zinc-900 to-zinc-900">
          <h3 className="text-lg font-bold text-zinc-100">{current.title || 'Mensaje'}</h3>
          <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap">{current.message}</p>
        </div>
        {current.kind === 'prompt' && (
          <div className="px-5 py-4">
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') close(inputValue.trim());
                if (e.key === 'Escape') close(null);
              }}
              placeholder={current.placeholder || 'Escriba aqui...'}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
            />
          </div>
        )}
        <div className="px-5 py-5 flex justify-end gap-3">
          {current.kind !== 'alert' && (
            <button
              type="button"
              onClick={() => close(current.kind === 'confirm' ? false : null)}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (current.kind === 'confirm') close(true);
              else if (current.kind === 'prompt') close(inputValue.trim());
              else close(undefined);
            }}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-semibold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

