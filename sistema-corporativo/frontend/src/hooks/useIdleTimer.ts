import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function useIdleTimer(timeoutMs: number = 900000) {
    const router = useRouter();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

        const resetTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
                localStorage.removeItem('sgd_token');
                localStorage.removeItem('sgd_user');
                router.push('/login?reason=timeout');
            }, timeoutMs);
        };

        resetTimer();
        events.forEach(event => window.addEventListener(event, resetTimer));

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [timeoutMs, router]);
}
