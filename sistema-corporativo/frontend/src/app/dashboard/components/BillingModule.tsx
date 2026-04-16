"use client";
import React, { useState, useMemo } from 'react';
import { 
  Upload, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  X, 
  ChevronRight, 
  Filter,
  FileSpreadsheet
} from 'lucide-react';

export default function BillingModule({ darkMode }: { darkMode: boolean }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [filter, setFilter] = useState('all'); // all, NC, ND, error

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/billing/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error(error);
      alert('Error al procesar el archivo. Asegúrate que el servicio de facturación esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/billing/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data }),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Facturacion_Validada.xlsx';
      a.click();
    } catch (error) {
      alert('Error al exportar');
    }
  };

  const totals = useMemo(() => {
    return data.reduce((acc, item) => {
      acc.count++;
      acc.base += item.totales.baseTotal;
      acc.iva += item.totales.ivaTotal;
      acc.total += item.totales.totalVenta;
      if (item.tipoDocumento === 'NC') acc.nc++;
      if (item.tipoDocumento === 'ND') acc.nd++;
      if (!item.validacion.cuadra) acc.errors++;
      return acc;
    }, { count: 0, base: 0, iva: 0, total: 0, nc: 0, nd: 0, errors: 0 });
  }, [data]);

  const filteredData = useMemo(() => {
    switch (filter) {
      case 'NC': return data.filter(i => i.tipoDocumento === 'NC');
      case 'ND': return data.filter(i => i.tipoDocumento === 'ND');
      case 'error': return data.filter(i => !i.validacion.cuadra);
      default: return data;
    }
  }, [data, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 font-bold">Procesando Excel...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Módulo de Facturación</h2>
          <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Procesamiento de borradores Excel</p>
        </div>
        {data.length > 0 && (
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20"
          >
            <Download size={18} /> EXPORTAR FINAL
          </button>
        )}
      </header>

      {data.length === 0 ? (
        <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${darkMode ? 'border-slate-800 bg-slate-900/30 hover:border-red-900/50' : 'border-slate-200 bg-white hover:border-red-200'}`}>
          <label htmlFor="billing-upload" className="cursor-pointer">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-red-900/20 text-red-500' : 'bg-red-50 text-red-600'}`}>
              <Upload size={32} />
            </div>
            <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Cargar Archivo Excel</h3>
            <p className={darkMode ? 'text-slate-500' : 'text-slate-500'}>Selecciona el Excel borrador para iniciar la validación</p>
            <input id="billing-upload" type="file" hidden onChange={handleFileUpload} accept=".xlsx,.xls" />
          </label>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatSmall label="Registros" value={totals.count} darkMode={darkMode} />
            <StatSmall label="Base Total" value={`$${totals.base.toLocaleString()}`} darkMode={darkMode} />
            <StatSmall label="IVA Total" value={`$${totals.iva.toLocaleString()}`} darkMode={darkMode} />
            <StatSmall label="Total Venta" value={`$${totals.total.toLocaleString()}`} darkMode={darkMode} />
            <StatSmall label="Notas Crédito" value={totals.nc} darkMode={darkMode} color="text-red-500" />
            <StatSmall label="Errores" value={totals.errors} darkMode={darkMode} color={totals.errors > 0 ? "text-red-500" : "text-emerald-500"} />
          </div>

          <div className={`rounded-xl border overflow-hidden ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <div className="flex gap-2">
                <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" darkMode={darkMode} />
                <FilterTab active={filter === 'NC'} onClick={() => setFilter('NC')} label="Notas de Crédito" darkMode={darkMode} />
                <FilterTab active={filter === 'ND'} onClick={() => setFilter('ND')} label="Notas de Débito" darkMode={darkMode} />
                <FilterTab active={filter === 'error'} onClick={() => setFilter('error')} label="Con Errores" darkMode={darkMode} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className={darkMode ? 'bg-slate-950/50 text-slate-500' : 'bg-slate-50 text-slate-500'}>
                  <tr className="text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Nº Op.</th>
                    <th className="px-4 py-3">R.I.F. / Razón Social</th>
                    <th className="px-4 py-3 text-center">Tipo</th>
                    <th className="px-4 py-3 text-right">Total Venta</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {filteredData.map((item, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedItem(item)}
                      className={`cursor-pointer transition-colors ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 text-sm font-mono">{item.operacion.numero}</td>
                      <td className="px-4 py-3">
                        <div className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.operacion.rif}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">{item.operacion.nombreRazonSocial}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.tipoDocumento === 'NC' ? 'bg-red-500/20 text-red-500' : 
                          item.tipoDocumento === 'ND' ? 'bg-blue-500/20 text-blue-500' : 
                          'bg-slate-500/20 text-slate-500'
                        }`}>
                          {item.tipoDocumento}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-sm">
                        ${item.totales.totalVenta.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.validacion.cuadra ? 
                          <CheckCircle size={16} className="text-emerald-500 mx-auto" /> : 
                          <AlertCircle size={16} className="text-red-500 mx-auto" />
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight size={18} className="text-slate-600 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Side Panel for Details */}
      {selectedItem && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className={`relative w-full max-w-lg h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-slate-900 text-white' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Detalle del Registro</h2>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} className={darkMode ? 'text-slate-400' : 'text-slate-600'} />
              </button>
            </div>

            <div className="space-y-6">
              <section className={`p-4 rounded-xl border ${darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'}`}>
                <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-widest">Datos Operativos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Factura" value={selectedItem.operacion.factura} darkMode={darkMode} />
                  <DetailField label="Control" value={selectedItem.operacion.controlDocumento} darkMode={darkMode} />
                  <DetailField label="RIF" value={selectedItem.operacion.rif} darkMode={darkMode} />
                  <DetailField label="Fecha Doc." value={selectedItem.operacion.fechaDocumento} darkMode={darkMode} />
                </div>
              </section>

              <section className={`p-4 rounded-xl border ${darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'}`}>
                <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-widest">Bloque Fiscal (Contribuyente)</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-left border-b border-slate-800">
                      <th className="pb-2">Tasa</th>
                      <th className="pb-2">Base</th>
                      <th className="pb-2">IVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {selectedItem.contribuyente.map((c: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2">{c.tasa}%</td>
                        <td className="py-2">${c.base.toLocaleString()}</td>
                        <td className="py-2">${c.iva.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {!selectedItem.validacion.cuadra && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-red-500 font-bold mb-2">
                    <AlertCircle size={18} /> Error de Cuadre
                  </div>
                  <ul className="text-xs text-red-400 space-y-1">
                    {selectedItem.validacion.errores.map((err: string, i: number) => <li key={i}>• {err}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <button 
              onClick={() => setSelectedItem(null)}
              className="w-full mt-8 py-3 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-colors"
            >
              CERRAR DETALLE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatSmall({ label, value, darkMode, color }: any) {
  return (
    <div className={`p-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">{label}</div>
      <div className={`text-sm font-bold ${color || (darkMode ? 'text-white' : 'text-slate-800')}`}>{value}</div>
    </div>
  );
}

function FilterTab({ active, onClick, label, darkMode }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
        active 
          ? 'bg-red-700 text-white' 
          : darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );
}

function DetailField({ label, value, darkMode }: any) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">{label}</div>
      <div className={`text-sm truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{value || 'N/A'}</div>
    </div>
  );
}
