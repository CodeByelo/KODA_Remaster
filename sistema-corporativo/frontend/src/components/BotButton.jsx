"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function BotButton({ onOpenChat, variant = 'floating', collapsed = false }) {
    const [isHovered, setIsHovered] = useState(false);
    const [isBlinking, setIsBlinking] = useState(true);
    const isFloating = variant === 'floating';

    useEffect(() => {
        const interval = setInterval(() => {
            setIsBlinking(prev => !prev);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    if (!isFloating && collapsed) {
        return null;
    }

    if (!isFloating) {
        return (
            <div className="w-full">
                <button
                    type="button"
                    onClick={onOpenChat}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-red-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950/90 hover:from-slate-900 hover:to-slate-900 transition-colors"
                >
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-red-900/90 to-orange-900/90 border-2 border-red-500/40 shadow-lg shadow-red-500/20 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-red-500/20 to-transparent" />
                        <div className="absolute inset-1 rounded-full overflow-hidden">
                            <video
                                src="/CorpiVideo.mp4"
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <motion.div
                            animate={{ scale: isBlinking ? [1, 1.3, 1] : 1, opacity: isBlinking ? [0.7, 1, 0.7] : 0.7 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-gray-900"
                        />
                    </div>
                    <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-slate-100 truncate">Asistente</div>
                        <div className="text-[10px] font-semibold text-slate-400 tracking-wide truncate">KODA</div>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="fixed bottom-8 right-3 md:right-6 z-50"
        >
            <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
                onClick={onOpenChat}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br from-red-900/90 to-orange-900/90 border-2 border-red-500/40 shadow-xl shadow-red-500/20 overflow-hidden cursor-pointer transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/20 to-transparent" />
                    <div className="absolute inset-1 rounded-full overflow-hidden">
                        <video
                            src="/CorpiVideo.mp4"
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 min-w-[112px] h-7 px-3 bg-gray-900/95 border border-red-500/60 rounded-full flex items-center justify-center">
                    <span className="text-[11px] leading-none font-bold text-white tracking-wide whitespace-nowrap">KODA</span>
                </div>

                <motion.div
                    animate={{ scale: isBlinking ? [1, 1.3, 1] : 1, opacity: isBlinking ? [0.7, 1, 0.7] : 0.7 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-2 -right-2 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900"
                />
            </motion.div>

            {isHovered && (
                <div className="absolute bottom-20 right-0 bg-gray-900/95 border border-red-500/30 rounded-lg px-3 py-1.5 text-sm text-white whitespace-nowrap shadow-lg animate-fadeIn">
                    Asistente KODA
                </div>
            )}
        </motion.div>
    );
}
