"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function BotButton({ onOpenChat, variant = 'floating', collapsed = false }) {
    const [isHovered, setIsHovered] = useState(false);
    const [isBlinking, setIsBlinking] = useState(true);
    const isFloating = variant === 'floating';

    const botAvatar = (
        <div className="absolute inset-[3px] rounded-full overflow-hidden bg-white">
            <video
                src="/koda-bot.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster="/koda-bot.jpeg"
                className="h-full w-full scale-[1.14] object-cover object-center"
            />
        </div>
    );

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
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl border border-[#0da67b]/25 bg-gradient-to-br from-[#042f36] via-[#075159] to-[#051d10] hover:from-[#053840] hover:via-[#08636d] hover:to-[#062914] transition-all duration-300 shadow-lg shadow-[#042f36]/15"
                >
                    <div className="relative w-10 h-10 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffffff_0%,#ddf6ef_26%,#0bbf8c_62%,#075159_100%)] border-2 border-[#0bbf8c]/70 shadow-lg shadow-[#075159]/30 overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35),transparent_42%,rgba(4,47,54,0.18))]" />
                        {botAvatar}
                        <motion.div
                            animate={{ scale: isBlinking ? [1, 1.3, 1] : 1, opacity: isBlinking ? [0.7, 1, 0.7] : 0.7 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#0bbf8c] rounded-full border-2 border-white"
                        />
                    </div>
                    <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-white truncate">Asistente</div>
                        <div className="text-[10px] font-semibold text-[#93f0d3] tracking-[0.18em] uppercase truncate">KODA</div>
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
                <div className={`relative w-16 h-16 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffffff_0%,#ddf6ef_22%,#0bbf8c_58%,#075159_100%)] border-2 border-[#0bbf8c]/75 shadow-[0_18px_36px_rgba(7,81,89,0.34)] overflow-hidden cursor-pointer transition-all duration-300 ${isHovered ? 'scale-110 shadow-[0_22px_44px_rgba(11,191,140,0.28)]' : ''}`}>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),transparent_42%,rgba(4,47,54,0.18))]" />
                    {botAvatar}
                </div>

                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 min-w-[112px] h-7 px-3 bg-white/96 border border-[#0da67b]/35 rounded-full flex items-center justify-center shadow-lg shadow-[#042f36]/20">
                    <span className="text-[11px] leading-none font-bold text-[#042f36] tracking-[0.22em] whitespace-nowrap">KODA</span>
                </div>

                <motion.div
                    animate={{ scale: isBlinking ? [1, 1.3, 1] : 1, opacity: isBlinking ? [0.7, 1, 0.7] : 0.7 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-2 -right-2 w-3 h-3 bg-[#0bbf8c] rounded-full border-2 border-white"
                />
            </motion.div>

            {isHovered && (
                <div className="absolute bottom-20 right-0 bg-white/96 border border-[#0da67b]/25 rounded-xl px-3 py-1.5 text-sm text-[#042f36] whitespace-nowrap shadow-lg shadow-[#042f36]/20 animate-fadeIn">
                    Asistente KODA
                </div>
            )}
        </motion.div>
    );
}
