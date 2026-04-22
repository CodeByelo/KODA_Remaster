import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://corpoelect-backend.onrender.com"
    : "http://127.0.0.1:8000");

async function backendHeaders(request: Request): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  const auth = request.headers.get("authorization") || (session ? `Bearer ${session}` : null);
  return {
    "Content-Type": "application/json",
    ...(auth ? { Authorization: auth } : {}),
  };
}

function parseResponse(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { detail: text || "Respuesta invalida del backend" };
  }
}

async function proxy(request: Request, method: "GET" | "POST") {
  const body = method === "POST" ? JSON.stringify(await request.json()) : undefined;
  const response = await fetch(`${API_BASE_URL}/api/chat/knowledge`, {
    method,
    headers: await backendHeaders(request),
    ...(body ? { body } : {}),
    cache: "no-store",
  });

  const text = await response.text();
  return NextResponse.json(parseResponse(text), {
    status: response.status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}

export async function GET(request: Request) {
  try {
    return await proxy(request, "GET");
  } catch (error) {
    console.error("Knowledge GET proxy error:", error);
    return NextResponse.json({ detail: "Error en el proxy de conocimiento" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    return await proxy(request, "POST");
  } catch (error) {
    console.error("Knowledge POST proxy error:", error);
    return NextResponse.json({ detail: "Error en el proxy de conocimiento" }, { status: 500 });
  }
}
