import React, { useState, useMemo } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  ChevronRight,
  Filter
} from 'lucide-react';

export default function BillingModule() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState('all'); // all, NC, ND, error

  // --- Manejo de Archivos ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      setData(result);
    } catch (error) {
      alert('Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/export', {
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

  // --- Lógica de Negocio ---
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

  const updateItem = (id, field, value) => {
    setData(prev => prev.map(item => {
      if (item.id === id) {
        // En una app real, aquí recalcularíamos el cuadre al editar
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // --- Renderizado ---
  return (
    <div className="app-container">
      <header>
        <div className="title-section">
          <h1>Módulo de Facturación</h1>
          <p>Revisión y validación de documentos fiscales</p>
        </div>
        <div className="actions">
          {data.length > 0 && (
            <button className="btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={18} /> Exportar Excel Final
            </button>
          )}
        </div>
      </header>

      {data.length === 0 ? (
        <div className="dropzone">
          <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
            <Upload size={48} color="#2563eb" style={{ marginBottom: '1rem' }} />
            <h2>Cargar Excel Borrador</h2>
            <p>Arrastra tu archivo aquí o haz clic para buscar</p>
            <input id="file-upload" type="file" hidden onChange={handleFileUpload} accept=".xlsx, .xls" />
          </label>
        </div>
      ) : (
        <>
          <div className="summary-grid">
            <StatCard label="Total Registros" value={totals.count} />
            <StatCard label="Base Imponible" value={`$${totals.base.toLocaleString()}`} />
            <StatCard label="Total IVA" value={`$${totals.iva.toLocaleString()}`} />
            <StatCard label="Total General" value={`$${totals.total.toLocaleString()}`} />
            <StatCard label="Notas de Crédito" value={totals.nc} color="var(--nc-text)" />
            <StatCard label="Registros con Error" value={totals.errors} color={totals.errors > 0 ? 'var(--error)' : 'var(--success)'} />
          </div>

          <div className="table-container">
            <div className="table-header">
              <div className="filters">
                <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterBtn>
                <FilterBtn active={filter === 'NC'} onClick={() => setFilter('NC')}>Notas de Crédito</FilterBtn>
                <FilterBtn active={filter === 'ND'} onClick={() => setFilter('ND')}>Notas de Débito</FilterBtn>
                <FilterBtn active={filter === 'error'} onClick={() => setFilter('error')}>Con Errores</FilterBtn>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Nº Op.</th>
                  <th>Fecha</th>
                  <th>RIF / Razón Social</th>
                  <th>Tipo</th>
                  <th>Total Venta</th>
                  <th>Base</th>
                  <th>IVA</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(item => (
                  <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                    <td>{item.operacion.numero}</td>
                    <td>{item.operacion.fechaDocumento}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.operacion.rif}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.operacion.nombreRazonSocial}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${item.tipoDocumento.toLowerCase()}`}>
                        {item.tipoDocumento}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>${item.totales.totalVenta.toLocaleString()}</td>
                    <td>${item.totales.baseTotal.toLocaleString()}</td>
                    <td>${item.totales.ivaTotal.toLocaleString()}</td>
                    <td>
                      {item.validacion.cuadra ? 
                        <span className="badge badge-ok"><CheckCircle2 size={14} /> Cuadra</span> : 
                        <span className="badge badge-error"><AlertCircle size={14} /> Error</span>
                      }
                    </td>
                    <td><ChevronRight size={18} color="var(--text-muted)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Panel Lateral de Detalle */}
      <div className={`detail-overlay ${selectedItem ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Detalle de Documento</h2>
          <button onClick={() => setSelectedItem(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {selectedItem && (
          <div className="detail-content">
            <div className="fiscal-group">
              <h3>DATOS OPERATIVOS</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <Field label="Nº de Factura" value={selectedItem.operacion.factura} />
                <Field label="Nº Control" value={selectedItem.operacion.controlDocumento} />
                <Field label="RIF" value={selectedItem.operacion.rif} />
                <Field label="Razón Social" value={selectedItem.operacion.nombreRazonSocial} />
              </div>
            </div>

            <div className="fiscal-group">
              <h3>BLOQUES FISCALES (CONTRIBUYENTE)</h3>
              <table className="fiscal-table">
                <thead>
                  <tr>
                    <th>Tasa</th>
                    <th>Base</th>
                    <th>IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.contribuyente.map((c, i) => (
                    <tr key={i}>
                      <td>{c.tasa}%</td>
                      <td><input type="number" defaultValue={c.base} /></td>
                      <td><input type="number" defaultValue={c.iva} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!selectedItem.validacion.cuadra && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fee2e2', borderRadius: '0.5rem', color: '#991b1b' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={18} /> Error de Validación
                </h4>
                <ul style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                  {selectedItem.validacion.errores.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            
            <button className="btn-primary" style={{ width: '100%', marginTop: '2rem' }} onClick={() => setSelectedItem(null)}>
              Guardar Cambios
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-componentes auxiliares
function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <span className="label">{label}</span>
      <span className="value" style={{ color: color }}>{value}</span>
    </div>
  );
}

function FilterBtn({ children, active, onClick }) {
  return (
    <button className={`filter-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</label>
      <input type="text" defaultValue={value} />
    </div>
  );
}
