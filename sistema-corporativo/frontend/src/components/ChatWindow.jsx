"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, AlertCircle, MessageSquare, Plus, History, Brain, Save, Trash2, ChevronLeft } from 'lucide-react';
import { uiAlert } from '../lib/ui-dialog';

export default function ChatWindow({ isOpen, onClose, userRole }) {
    const getAuthHeaders = () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('sgd_token') : null;
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };
    // Estados principales
    const [conversations, setConversations] = useState([]);
    const [currentConvId, setCurrentConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [view, setView] = useState('chat'); // 'chat', 'history', 'train'

    // Estados para entrenamiento
    const [trainQuestion, setTrainQuestion] = useState('');
    const [trainAnswer, setTrainAnswer] = useState('');
    const [customKnowledge, setCustomKnowledge] = useState([]);
    const canTrain = userRole === 'Desarrollador' || userRole === 'Administrativo';

    const messagesEndRef = useRef(null);

    const normalizeText = (text) =>
        (text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const CHAT_API_BASE = '/api/chat';

    const syncKnowledgeFromServer = async () => {
        try {
            const response = await fetch(`${CHAT_API_BASE}/knowledge`, {
                cache: 'no-store',
                headers: getAuthHeaders(),
            });
            if (!response.ok) return;
            const data = await response.json();
            const serverKnowledge = Array.isArray(data?.knowledge) ? data.knowledge : [];
            setCustomKnowledge(serverKnowledge);
            localStorage.setItem('bot_knowledge', JSON.stringify(serverKnowledge));
        } catch {
            // Keep local cache if server is unavailable.
        }
    };

    // Cargar datos al inicio
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedConvs = JSON.parse(localStorage.getItem('bot_conversations') || '[]');
            const savedKnowledge = JSON.parse(localStorage.getItem('bot_knowledge') || '[]');

            setConversations(savedConvs);
            setCustomKnowledge(savedKnowledge);

            if (savedConvs.length > 0) {
                // Cargar la última conversación
                const lastConv = savedConvs[0];
                setCurrentConvId(lastConv.id);
                setMessages(lastConv.messages);
            } else {
                startNewChat();
            }

            syncKnowledgeFromServer();
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        syncKnowledgeFromServer();
        const interval = setInterval(syncKnowledgeFromServer, 15000);
        return () => clearInterval(interval);
    }, [isOpen]);

    // Guardar conversaciones cuando cambian
    useEffect(() => {
        if (currentConvId && messages.length > 0) {
            setConversations(prev => {
                const updated = prev.map(c =>
                    c.id === currentConvId ? { ...c, messages: messages, lastUpdate: new Date().toISOString(), preview: messages[messages.length - 1].text.substring(0, 30) + '...' } : c
                );
                localStorage.setItem('bot_conversations', JSON.stringify(updated));
                return updated;
            });
        }
    }, [messages, currentConvId]);

    // Scroll al fondo
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, view]);

    const startNewChat = () => {
        const newId = Date.now().toString();
        const initialMsgs = [
            {
                id: 1,
                text: "¡Hola! Soy tu asistente de KODA Remaster. ¿En qué puedo ayudarte hoy?",
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ];

        const newConv = {
            id: newId,
            messages: initialMsgs,
            timestamp: new Date().toISOString(),
            preview: "Nueva conversación"
        };

        setConversations(prev => {
            const updated = [newConv, ...prev];
            localStorage.setItem('bot_conversations', JSON.stringify(updated));
            return updated;
        });
        setCurrentConvId(newId);
        setMessages(initialMsgs);
        setView('chat');
    };

    const loadConversation = (id) => {
        const conv = conversations.find(c => c.id === id);
        if (conv) {
            setCurrentConvId(id);
            setMessages(conv.messages);
            setView('chat');
        }
    };

    const deleteConversation = (e, id) => {
        e.stopPropagation();
        const updated = conversations.filter(c => c.id !== id);
        setConversations(updated);
        localStorage.setItem('bot_conversations', JSON.stringify(updated));

        if (currentConvId === id) {
            if (updated.length > 0) {
                loadConversation(updated[0].id);
            } else {
                startNewChat();
            }
        }
    };

    const saveTraining = async () => {
        if (!canTrain) {
            void uiAlert("Acceso denegado: solo Desarrollador o Administrativo pueden entrenar al asistente.", "Acceso denegado");
            return;
        }
        if (!trainQuestion.trim() || !trainAnswer.trim()) return;

        const newEntry = {
            id: Date.now(),
            question: normalizeText(trainQuestion),
            answer: trainAnswer.trim()
        };

        try {
            const response = await fetch(`${CHAT_API_BASE}/knowledge`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    question: newEntry.question,
                    answer: newEntry.answer,
                    updatedBy: userRole,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const updatedKnowledge = Array.isArray(data?.knowledge) ? data.knowledge : [...customKnowledge, newEntry];
                setCustomKnowledge(updatedKnowledge);
                localStorage.setItem('bot_knowledge', JSON.stringify(updatedKnowledge));
            } else {
                const errorText = await response.text().catch(() => '');
                throw new Error(errorText || 'No se pudo guardar el conocimiento en el servidor');
            }
        } catch (err) {
            console.error('Knowledge save failed:', err);
            void uiAlert('No se pudo guardar el conocimiento del bot en el servidor. El cambio no se persistio.', 'Bot');
            return;
        }

        setTrainQuestion('');
        setTrainAnswer('');
        setView('chat');

        // Mensaje de confirmación temporal en el chat
        const confirmMsg = {
            id: Date.now(),
            text: "✅ ¡Gracias! He aprendido esta nueva respuesta.",
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, confirmMsg]);
    };

    const deleteKnowledge = async (id) => {
        const updated = customKnowledge.filter(k => k.id !== id);
        try {
            const response = await fetch(`${CHAT_API_BASE}/knowledge/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(errorText || 'No se pudo eliminar el conocimiento');
            }
            setCustomKnowledge(updated);
            localStorage.setItem('bot_knowledge', JSON.stringify(updated));
            await syncKnowledgeFromServer();
        } catch (err) {
            console.error('Knowledge delete failed:', err);
            void uiAlert('No se pudo eliminar el conocimiento del bot en el servidor.', 'Bot');
        }
    };

    const findLocalResponse = (query) => {
        const normalizedQuery = normalizeText(query);
        const match = customKnowledge.find((k) => {
            const learnedQuestion = normalizeText(k.question);
            return (
                normalizedQuery === learnedQuestion ||
                normalizedQuery.includes(learnedQuestion) ||
                learnedQuestion.includes(normalizedQuery)
            );
        });
        return match ? match.answer : null;
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = {
            id: Date.now(),
            text: input,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        // 1. Intentar respuesta local (Training)
        const localResponse = findLocalResponse(userMessage.text);

        if (localResponse) {
            setTimeout(() => {
                const botMessage = {
                    id: Date.now() + 1,
                    text: localResponse,
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setMessages(prev => [...prev, botMessage]);
                setIsLoading(false);
            }, 500); // Simulamos un pequeño delay
            return;
        }

        // 2. Si no hay local, llamar API (o respuesta default si falla)
        try {
            // Timeout para evitar que se quede pegado si no hay backend
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(CHAT_API_BASE, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ message: input }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();

            const botMessage = {
                id: Date.now() + 1,
                text: data.response || "No entendí, pero sigo aprendiendo.",
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, botMessage]);

        } catch (err) {
            console.log('Usando respuesta fallback por error:', err);
            // Fallback elegante si no hay backend
            const fallbackMessage = {
                id: Date.now() + 1,
                text: "Actualmente estoy en modo offline o no puedo contactar al servidor. Sin embargo, puedes enseñarme respuestas usando el botón de 'cerebro' en la parte superior.",
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, fallbackMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const botAvatar = (
        <div className="relative h-full w-full overflow-hidden rounded-full bg-white">
            <video
                src="/koda-bot.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster="/koda-bot.jpeg"
                className="h-full w-full scale-[1.3] object-cover object-[60%_46%]"
            />
        </div>
    );

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-3"
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.25 }}
                    className="relative w-[min(96vw,440px)] h-[min(78vh,640px)] flex flex-col overflow-hidden rounded-[28px] border border-[#0da67b]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,251,250,0.97)_18%,rgba(230,247,243,0.98)_100%)] shadow-[0_28px_80px_rgba(4,47,54,0.30)]"
                    style={{ backdropFilter: 'blur(12px)' }}
                >
                    {/* Encabezado */}
                    <div className="bg-[linear-gradient(120deg,#042f36_0%,#075159_52%,#0bbf8c_100%)] p-4 border-b border-[#0da67b]/20 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white/80 shadow-lg shadow-[#042f36]/25">
                                <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),transparent_45%,rgba(4,47,54,0.12))]" />
                                {botAvatar}
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm tracking-wide">Asistente Virtual</h3>
                                <p className="text-[10px] text-white/85 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0bbf8c] animate-pulse"></span>
                                    En línea
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {canTrain && (
                                <button
                                    onClick={() => setView('train')}
                                    className={`p-2 rounded-full text-white transition-colors ${view === 'train' ? 'bg-white/20' : 'hover:bg-white/12'}`}
                                    title="Entrenar Bot"
                                >
                                    <Brain size={16} />
                                </button>
                            )}
                            <button onClick={() => setView(view === 'history' ? 'chat' : 'history')} className={`p-2 rounded-full text-white transition-colors ${view === 'history' ? 'bg-white/20' : 'hover:bg-white/12'}`} title="Historial">
                                <History size={16} />
                            </button>
                            <button onClick={startNewChat} className="p-2 rounded-full hover:bg-white/12 text-white transition-colors" title="Nuevo Chat">
                                <Plus size={16} />
                            </button>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/12 text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Contenido Principal changeable */}
                    <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(11,191,140,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(239,250,247,0.96)_100%)]">

                    {/* VISTA: CHAT */}
                    {view === 'chat' && (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 scrollbar-thin scrollbar-thumb-[#0da67b]/40 scrollbar-track-transparent">
                                {messages.map((message) => (
                                    <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${message.sender === 'user'
                                            ? 'bg-[linear-gradient(135deg,#0bbf8c_0%,#0da67b_100%)] text-white rounded-br-none ring-1 ring-[#75ebc7]/40 shadow-[0_14px_26px_rgba(11,191,140,0.24)]'
                                            : 'bg-white text-[#042f36] rounded-bl-none ring-1 ring-[#0da67b]/12 shadow-[0_10px_24px_rgba(4,47,54,0.08)]'
                                            }`}>
                                            <p className="whitespace-pre-wrap text-sm leading-snug">{message.text}</p>
                                            <span className="text-[10px] opacity-70 block text-right mt-1">{message.timestamp}</span>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white p-3 rounded-2xl rounded-bl-none ring-1 ring-[#0da67b]/12 shadow-[0_10px_24px_rgba(4,47,54,0.08)] flex gap-2">
                                            <div className="w-2 h-2 bg-[#075159] rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-[#0da67b] rounded-full animate-bounce delay-75"></div>
                                            <div className="w-2 h-2 bg-[#0bbf8c] rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-3 bg-white/82 border-t border-[#0da67b]/12">
                                <div className="flex gap-2">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Escribe tu mensaje..."
                                        className="h-[42px] flex-1 resize-none rounded-full border border-[#0da67b]/16 bg-[#eff8f4] px-4 py-2 text-sm text-[#042f36] placeholder:text-[#62867f] focus:ring-2 focus:ring-[#0da67b]/20 focus:border-[#0da67b]/40 outline-none scrollbar-hide"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className="w-10 h-10 rounded-full bg-[linear-gradient(135deg,#075159_0%,#0bbf8c_100%)] flex items-center justify-center text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#075159]/20"
                                    >
                                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISTA: HISTORIAL */}
                    {view === 'history' && (
                        <div className="h-full flex flex-col p-4 overflow-y-auto no-scrollbar">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-[#042f36]">Historial de Conversaciones</h4>
                            </div>
                            <div className="space-y-2">
                                {conversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        onClick={() => loadConversation(conv.id)}
                                        className={`p-3 rounded-lg cursor-pointer border transition-all flex justify-between items-center group ${currentConvId === conv.id
                                            ? 'bg-[#e7f9f3] border-[#0da67b]/45'
                                            : 'bg-white/80 border-[#0da67b]/12 hover:bg-[#f3fbf8]'
                                            }`}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="text-[#042f36] text-sm font-medium truncate">
                                                {conv.messages.find(m => m.sender === 'user')?.text || "Nueva conversación"}
                                            </p>
                                            <p className="text-[#62867f] text-xs mt-1">
                                                {new Date(conv.timestamp).toLocaleDateString()} - {conv.messages.length} mensajes
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => deleteConversation(e, conv.id)}
                                            className="p-1.5 text-[#6a8f88] hover:text-[#0bbf8c] opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {conversations.length === 0 && (
                                    <p className="text-[#62867f] text-center text-sm py-4">No hay historial.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VISTA: ENTRENAMIENTO (TEACH MODE) */}
                    {view === 'train' && (
                        <div className="h-full flex flex-col p-4 overflow-y-auto no-scrollbar scrollbar-thin">
                            <div className="flex items-center gap-2 mb-4 text-[#042f36]">
                                <button onClick={() => setView('chat')} className="hover:bg-[#0da67b]/10 p-1 rounded transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <h4 className="font-semibold">Entrenar al Asistente</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-[#0da67b]/18 bg-[linear-gradient(135deg,rgba(11,191,140,0.10),rgba(13,166,123,0.10))] p-3 text-xs text-[#042f36]">
                                    <span className="font-bold block mb-1"> Modo Aprendizaje</span>
                                    Agrega preguntas y respuestas personalizadas. El bot usará esto antes de consultar al servidor.
                                </div>

                                <div>
                                    <label className="text-[#62867f] text-xs uppercase font-bold mb-1 block">Si el usuario pregunta:</label>
                                    <input
                                        value={trainQuestion}
                                        onChange={(e) => setTrainQuestion(e.target.value)}
                                        className="w-full rounded-xl border border-[#0da67b]/16 bg-white p-2 text-[#042f36] text-sm focus:border-[#0da67b]/45 outline-none"
                                        placeholder="Ej: ¿Cuál es el horario?"
                                    />
                                </div>

                                <div>
                                    <label className="text-[#62867f] text-xs uppercase font-bold mb-1 block">El bot debe responder:</label>
                                    <textarea
                                        value={trainAnswer}
                                        onChange={(e) => setTrainAnswer(e.target.value)}
                                        className="w-full min-h-[100px] rounded-xl border border-[#0da67b]/16 bg-white p-2 text-[#042f36] text-sm focus:border-[#0da67b]/45 outline-none"
                                        placeholder="Ej: Trabajamos de 8am a 5pm."
                                    />
                                </div>

                                <button
                                    onClick={saveTraining}
                                    disabled={!trainQuestion || !trainAnswer}
                                    className="w-full py-2 rounded-xl bg-[linear-gradient(120deg,#042f36_0%,#075159_52%,#0bbf8c_100%)] text-white font-medium shadow-lg shadow-[#075159]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Save size={16} />
                                    Guardar Conocimiento
                                </button>

                                <div className="border-t border-[#0da67b]/12 pt-4 mt-2">
                                    <h5 className="text-[#62867f] text-xs uppercase font-bold mb-2">Conocimiento Agregado ({customKnowledge.length})</h5>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar pr-1">
                                        {customKnowledge.map((k) => (
                                            <div key={k.id} className="bg-white/85 border border-[#0da67b]/12 p-2 rounded-xl text-xs flex justify-between items-start group">
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-[#075159] font-medium truncate">P: {k.question}</p>
                                                    <p className="text-[#62867f] truncate">R: {k.answer}</p>
                                                </div>
                                                <button
                                                    onClick={() => deleteKnowledge(k.id)}
                                                    className="p-1 text-[#6a8f88] hover:text-[#0bbf8c] opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Borrar respuesta"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

