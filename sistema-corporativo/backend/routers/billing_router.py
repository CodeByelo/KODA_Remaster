from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import openpyxl
from io import BytesIO
import json

router = APIRouter(prefix="/billing", tags=["billing"])

def get_document_type(nota_credito, nota_debito, tipo_trans):
    if nota_credito or tipo_trans == '03':
        return 'NC'
    if nota_debito or tipo_trans == '02':
        return 'ND'
    return 'NORMAL'

@router.post("/upload")
async def upload_billing_excel(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado")
    
    content = await file.read()
    wb = openpyxl.load_workbook(BytesIO(content), data_only=True)
    ws = wb.active

    headers = {}
    for cell in ws[1]:
        headers[cell.value] = cell.column

    data = []
    for row_idx, row in enumerate(ws.iter_rows(min_row=2), start=2):
        def get_val(name):
            col = headers.get(name)
            return row[col-1].value if col else None

        record = {
            "id": row_idx,
            "operacion": {
                "numero": get_val('Nº Op.'),
                "fechaDocumento": str(get_val('Fecha del documento') or ''),
                "rif": get_val('Nº R.I.F.'),
                "nombreRazonSocial": get_val('Nombre o Razón Social'),
                "factura": get_val('Nº de Factura'),
                "controlDocumento": get_val('Nº Control del Documento'),
                "notaDebito": get_val('Nº de Nota de Débito'),
                "notaCredito": get_val('Nº de Nota de Crédito'),
                "tipoTransaccion": get_val('Tipo de Transacción'),
            },
            "totales": {
                "totalVenta": float(get_val('Total Venta') or 0),
                "baseTotal": 0,
                "ivaTotal": 0,
                "totalCalculado": 0
            },
            "contribuyente": [
                { 
                    "tasa": 16, 
                    "base": float(get_val('Base 16,00 %') or 0), 
                    "iva": float(get_val('IVA 16,00 %') or 0) 
                }
            ],
            "validacion": {
                "cuadra": True,
                "errores": []
            }
        }

        record["tipoDocumento"] = get_document_type(
            record["operacion"]["notaCredito"], 
            record["operacion"]["notaDebito"], 
            record["operacion"]["tipoTransaccion"]
        )

        record["totales"]["baseTotal"] = sum(c["base"] for c in record["contribuyente"])
        record["totales"]["ivaTotal"] = sum(c["iva"] for c in record["contribuyente"])
        record["totales"]["totalCalculado"] = record["totales"]["baseTotal"] + record["totales"]["ivaTotal"]

        diff = abs(record["totales"]["totalVenta"] - record["totales"]["totalCalculado"])
        if diff > 0.01:
            record["validacion"]["cuadra"] = False
            record["validacion"]["errores"].append(f"Diferencia de {diff:.2f} entre Total Venta y cálculo Base+IVA")

        data.append(record)

    return data

@router.post("/export")
async def export_billing_excel(data: dict):
    items = data.get("items", [])
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Facturacion Final"

    headers = [
        'Nº Op.', 'Fecha del documento', 'Nº R.I.F.', 'Nombre o Razón Social', 
        'Nº de Factura', 'Nº Control', 'Tipo Trans.', 'Total Venta', 'Base 16%', 'IVA 16%'
    ]
    ws.append(headers)

    for item in items:
        ws.append([
            item['operacion']['numero'],
            item['operacion']['fechaDocumento'],
            item['operacion']['rif'],
            item['operacion']['nombreRazonSocial'],
            item['operacion']['factura'],
            item['operacion']['controlDocumento'],
            item['tipoDocumento'],
            item['totales']['totalVenta'],
            item['contribuyente'][0]['base'],
            item['contribuyente'][0]['iva']
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Facturacion_Final.xlsx"}
    )
