const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

/**
 * Mapeo de columnas basado en el encabezado sugerido.
 * En una versión productiva, esto podría ser configurable.
 */
const COLUMNS = {
  NUM_OP: 'Nº Op.',
  FECHA_DOC: 'Fecha del documento',
  RIF: 'Nº R.I.F.',
  RAZON_SOCIAL: 'Nombre o Razón Social',
  FACTURA: 'Nº de Factura',
  CONTROL: 'Nº Control del Documento',
  NOTA_DEBITO: 'Nº de Nota de Débito',
  NOTA_CREDITO: 'Nº de Nota de Crédito',
  TIPO_TRANS: 'Tipo de Transacción',
  FACTURA_AFECTADA: 'Nº de Factura Afectada',
  TOTAL_VENTA: 'Total Venta',
  BASE_16: 'Base 16,00 %',
  IVA_16: 'IVA 16,00 %',
  // ... añadir más según sea necesario
};

/**
 * Lógica para determinar si es factura, NC o ND
 */
function getDocumentType(row) {
  if (row.notaCredito || row.tipoTrans === '03' || (row.notaCredito && row.notaCredito !== '')) return 'NC';
  if (row.notaDebito || row.tipoTrans === '02') return 'ND';
  return 'NORMAL';
}

/**
 * Procesa un buffer de Excel y lo convierte al modelo interno
 */
async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  const data = [];
  const headers = {};

  // Leer encabezados (asumiendo que están en la fila 1 o similar)
  // Nota: En Excels contables complejos, a veces hay que buscar la fila de encabezado.
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[cell.value] = colNumber;
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Saltar encabezado

    const getVal = (headerName) => row.getCell(headers[headerName])?.value;

    const record = {
      id: rowNumber,
      operacion: {
        numero: getVal('Nº Op.'),
        fechaDocumento: getVal('Fecha del documento'),
        rif: getVal('Nº R.I.F.'),
        nombreRazonSocial: getVal('Nombre o Razón Social'),
        factura: getVal('Nº de Factura'),
        controlDocumento: getVal('Nº Control del Documento'),
        notaDebito: getVal('Nº de Nota de Débito'),
        notaCredito: getVal('Nº de Nota de Crédito'),
        tipoTransaccion: getVal('Tipo de Transacción'),
        facturaAfectada: getVal('Nº de Factura Afectada'),
      },
      totales: {
        totalVenta: parseFloat(getVal('Total Venta') || 0),
        baseTotal: 0,
        ivaTotal: 0,
        totalCalculado: 0
      },
      contribuyente: [
        { tasa: 16, base: parseFloat(getVal('Base 16,00 %') || 0), iva: parseFloat(getVal('IVA 16,00 %') || 0) },
        // ... otras tasas
      ],
      noContribuyente: [
        { tasa: 16, base: 0, iva: 0 }, // Simplificado para V1
      ],
      validacion: {
        cuadra: true,
        errores: []
      }
    };

    // Lógica de validación y tipo
    record.tipoDocumento = getDocumentType(record.operacion);
    
    // Cálculo de totales internos
    record.totales.baseTotal = record.contribuyente.reduce((acc, c) => acc + c.base, 0);
    record.totales.ivaTotal = record.contribuyente.reduce((acc, c) => acc + c.iva, 0);
    record.totales.totalCalculado = record.totales.baseTotal + record.totales.ivaTotal;

    // Validación de cuadre
    const diff = Math.abs(record.totales.totalVenta - record.totales.totalCalculado);
    if (diff > 0.01) {
      record.validacion.cuadra = false;
      record.validacion.errores.push(`Diferencia de ${diff.toFixed(2)} entre Total Venta y cálculo Base+IVA`);
    }

    data.push(record);
  });

  return data;
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No se subió ningún archivo');
    const data = await parseExcel(req.file.buffer);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error procesando el Excel');
  }
});

app.post('/api/export', async (req, res) => {
  try {
    const { items } = req.body;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Facturación Final');

    // Reconstruir encabezados basándonos en la estructura original
    // En una V1 creamos un formato limpio pero compatible
    const headers = [
      'Nº Op.', 'Fecha del documento', 'Nº R.I.F.', 'Nombre o Razón Social', 
      'Nº de Factura', 'Nº Control', 'Tipo Trans.', 'Total Venta', 'Base 16%', 'IVA 16%'
    ];
    
    worksheet.addRow(headers);
    
    items.forEach(item => {
      worksheet.addRow([
        item.operacion.numero,
        item.operacion.fechaDocumento,
        item.operacion.rif,
        item.operacion.nombreRazonSocial,
        item.operacion.factura,
        item.operacion.controlDocumento,
        item.tipoDocumento,
        item.totales.totalVenta,
        item.contribuyente[0].base,
        item.contribuyente[0].iva
      ]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Facturacion_Final.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando el Excel');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
