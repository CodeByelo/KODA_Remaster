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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ knowledgeId: string }> },
) {
  try {
    const { knowledgeId } = await context.params;
    const response = await fetch(`${API_BASE_URL}/api/chat/knowledge/${knowledgeId}`, {
      method: "DELETE",
      headers: await backendHeaders(request),
      cache: "no-store",
    });

    const text = await response.text();
    return NextResponse.json(parseResponse(text), {
      status: response.status,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (error) {
    console.error("Knowledge DELETE proxy error:", error);
    return NextResponse.json({ detail: "Error en el proxy de conocimiento" }, { status: 500 });
  }
}
