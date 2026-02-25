import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://corpoelect-backend.onrender.com";

function backendHeaders(request: Request, contentTypeJson = false): HeadersInit {
  const auth = request.headers.get("authorization");
  return {
    ...(contentTypeJson ? { "Content-Type": "application/json" } : {}),
    ...(auth ? { Authorization: auth } : {}),
  };
}

export async function GET(request: Request) {
  try {
    const response = await fetch(`${API_BASE_URL}/security/logs`, {
      method: "GET",
      headers: backendHeaders(request),
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text || "Respuesta invalida del backend" };
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Security logs GET proxy error:", error);
    return NextResponse.json(
      { detail: "Error en el proxy de logs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await fetch(`${API_BASE_URL}/security/logs`, {
      method: "POST",
      headers: backendHeaders(request, true),
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text || "Respuesta invalida del backend" };
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Security logs POST proxy error:", error);
    return NextResponse.json(
      { detail: "Error en el proxy de logs" },
      { status: 500 },
    );
  }
}

