"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

export default function BotButton({ onOpenChat }) {
    const [isHovered, setIsHovered] = useState(false);
    const [isBlinking, setIsBlinking] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsBlinking(prev => !prev);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

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
                {/* Botón principal con video animado */}
                <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br from-red-900/90 to-orange-900/90 border-2 border-red-500/40 shadow-xl shadow-red-500/20 overflow-hidden cursor-pointer transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}>
                    {/* Efecto de brillo */}
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/20 to-transparent" />

                    {/* Video del bot (reemplaza el icono) */}
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

                {/* Placa de identificación - AHORA AFUERA */}
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-gray-900/90 border border-red-500/50 rounded-full flex items-center justify-center pt-0.5">
                    <span className="text-[9px] font-bold text-white tracking-wider">CORPOELEC</span>
                </div>

                {/* Indicador de estado (parpadea cuando está listo) */}
                <motion.div
                    animate={{ scale: isBlinking ? [1, 1.3, 1] : 1, opacity: isBlinking ? [0.7, 1, 0.7] : 0.7 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-2 -right-2 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900" />
            </motion.div>

            {/* Tooltip al pasar el mouse */}
            {isHovered && (
                <div className="absolute bottom-20 right-0 bg-gray-900/95 border border-red-500/30 rounded-lg px-3 py-1.5 text-sm text-white whitespace-nowrap shadow-lg animate-fadeIn">
                    Asistente CORPOELEC
                </div>
            )}
        </motion.div>
    );
}
