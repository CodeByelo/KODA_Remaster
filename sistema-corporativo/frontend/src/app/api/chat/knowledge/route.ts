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

async function proxy(request: Request, method: "GET" | "POST") {
  const body = method === "POST" ? JSON.stringify(await request.json()) : undefined;
  const response = await fetch(`${API_BASE_URL}/api/chat/knowledge`, {
    method,
    headers: backendHeaders(request),
    ...(body ? { body } : {}),
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
}

export async function GET(request: Request) {
  try {
    return await proxy(request, "GET");
  } catch (error) {
    console.error("Knowledge GET proxy error:", error);
    return NextResponse.json(
      { detail: "Error en el proxy de conocimiento" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await proxy(request, "POST");
  } catch (error) {
    console.error("Knowledge POST proxy error:", error);
    return NextResponse.json(
      { detail: "Error en el proxy de conocimiento" },
      { status: 500 },
    );
  }
}
