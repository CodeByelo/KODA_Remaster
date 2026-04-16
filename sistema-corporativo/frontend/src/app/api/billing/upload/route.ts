import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://corpoelect-backend.onrender.com";

// POST /api/billing/upload — recibe el FormData y lo reenvía al backend Python
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const backendRes = await fetch(`${BACKEND_URL}/billing/upload`, {
      method: "POST",
      body: formData,
    });

    const text = await backendRes.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { detail: "Respuesta inválida del backend", raw: text },
        { status: 502 }
      );
    }

    return NextResponse.json(json, { status: backendRes.status });
  } catch (error) {
    console.error("Billing upload proxy error:", error);
    return NextResponse.json(
      { detail: "Error de conexión con el servicio de facturación" },
      { status: 500 }
    );
  }
}
