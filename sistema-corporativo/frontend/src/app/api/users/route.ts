import { NextResponse } from "next/server";

const FALLBACK_URL = "https://corpoelect-backend.onrender.com";
const PRIMARY_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? FALLBACK_URL : "http://127.0.0.1:8000");

function backendHeaders(request: Request): HeadersInit {
  const auth = request.headers.get("authorization");
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

export async function GET(request: Request) {
  const urls = [PRIMARY_URL, FALLBACK_URL].filter((v, i, arr) => arr.indexOf(v) === i);
  let lastErr: unknown = null;

  try {
    for (const base of urls) {
      try {
        const response = await fetch(`${base}/usuarios`, {
          method: "GET",
          headers: backendHeaders(request),
        });
        const text = await response.text();
        return NextResponse.json(parseResponse(text), { status: response.status });
      } catch (error) {
        lastErr = error;
      }
    }

    throw lastErr || new Error("No se pudo conectar al backend");
  } catch (error) {
    console.error("Users GET proxy error:", error);
    return NextResponse.json(
      {
        detail:
          "Error en el proxy de usuarios. Verifique backend local (127.0.0.1:8000) o NEXT_PUBLIC_API_URL.",
      },
      { status: 500 },
    );
  }
}
