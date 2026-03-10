import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://corpoelect-backend.onrender.com"
    : "http://127.0.0.1:8000");

function backendHeaders(request: Request): HeadersInit {
  const auth = request.headers.get("authorization");
  return {
    "Content-Type": "application/json",
    ...(auth ? { Authorization: auth } : {}),
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: backendHeaders(request),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text || "Respuesta invalida del backend" };
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (error) {
    console.error("Chat proxy error:", error);
    return NextResponse.json(
      { detail: "Error en el proxy del chat" },
      { status: 500 },
    );
  }
}
