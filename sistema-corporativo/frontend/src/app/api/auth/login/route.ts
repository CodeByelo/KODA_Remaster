import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://corpoelect-backend.onrender.com';

export async function POST(request: Request) {
    try {
        const body = await request.formData();
        const username = body.get('username');
        const password = body.get('password');

        if (!username || !password) {
            return NextResponse.json({ detail: 'Credenciales incompletas' }, { status: 400 });
        }

        const params = new URLSearchParams();
        params.append('username', username as string);
        params.append('password', password as string);

        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const data = await response.json();

        if (response.ok) {
            const cookieStore = await cookies();
            cookieStore.set('session', data.access_token, {
                httpOnly: true,
                path: '/',
                maxAge: 28800, // 8 hours
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });

            return NextResponse.json(data);
        } else {
            return NextResponse.json(data, { status: response.status });
        }
    } catch (error) {
        console.error('Login API error:', error);
        return NextResponse.json({ detail: 'Error en el servidor de autenticación' }, { status: 500 });
    }
}
