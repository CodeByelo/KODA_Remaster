import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard'];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isProtectedRoute = protectedRoutes.some(route =>
        pathname.startsWith(route)
    );

    if (isProtectedRoute) {
        const sessionCookie = request.cookies.get('session')?.value;

        if (!sessionCookie || sessionCookie.trim().length < 16) {
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }

        const response = NextResponse.next();
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard',
        '/dashboard/:path*'
    ]
};
