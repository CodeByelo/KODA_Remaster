import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://corpoelect-backend.onrender.com";

function backendHeaders(request: Request): HeadersInit {
  const auth = request.headers.get("authorization");
  return {
    ...(auth ? { Authorization: auth } : {}),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const response = await fetch(`${API_BASE_URL}/security/logs/user/${userId}`, {
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
    console.error("Security user logs GET proxy error:", error);
    return NextResponse.json(
      { detail: "Error en el proxy de logs por usuario" },
      { status: 500 },
    );
  }
}

