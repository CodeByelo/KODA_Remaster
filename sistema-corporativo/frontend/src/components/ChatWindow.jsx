"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, AlertCircle, MessageSquare, Plus, History, Brain, Save, Trash2, ChevronLeft } from 'lucide-react';

export default function ChatWindow({ isOpen, onClose, userRole }) {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://corpoelect-backend.onrender.com';
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

    const syncKnowledgeFromServer = async () => {
        try {
            const response = await fetch(`${API_URL}/api/chat/knowledge`, {
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
                text: "¡Hola! Soy tu asistente de CORPOELEC Industrial. ¿En qué puedo ayudarte hoy?",
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
            alert("Acceso denegado: solo Desarrollador o Administrativo pueden entrenar al asistente.");
            return;
        }
        if (!trainQuestion.trim() || !trainAnswer.trim()) return;

        const newEntry = {
            id: Date.now(),
            question: normalizeText(trainQuestion),
            answer: trainAnswer.trim()
        };

        try {
            const response = await fetch(`${API_URL}/api/chat/knowledge`, {
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
                const updatedKnowledge = [...customKnowledge, newEntry];
                setCustomKnowledge(updatedKnowledge);
                localStorage.setItem('bot_knowledge', JSON.stringify(updatedKnowledge));
            }
        } catch {
            const updatedKnowledge = [...customKnowledge, newEntry];
            setCustomKnowledge(updatedKnowledge);
            localStorage.setItem('bot_knowledge', JSON.stringify(updatedKnowledge));
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
        setCustomKnowledge(updated);
        localStorage.setItem('bot_knowledge', JSON.stringify(updated));
        try {
            await fetch(`${API_URL}/api/chat/knowledge/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            await syncKnowledgeFromServer();
        } catch {
            // Keep local update when API delete fails.
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

            const response = await fetch(`${API_URL}/api/chat`, {
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

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ duration: 0.3 }}
                className="fixed bottom-28 right-8 w-96 max-h-[85vh] h-[600px] flex flex-col bg-gray-900/95 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden z-50"
                style={{ backdropFilter: 'blur(12px)' }}
            >
                {/* Encabezado */}
                <div className="bg-gradient-to-r from-red-900/90 to-orange-900/90 p-4 border-b border-red-500/30 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-black/20 overflow-hidden border border-white/20 relative">
                                <video src="/CorpiVideo.mp4" autoPlay className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm">Asistente Virtual</h3>
                                <p className="text-[10px] text-gray-300 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    En línea
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {canTrain && (
                                <button
                                    onClick={() => setView('train')}
                                    className={`p-2 rounded-full hover:bg-white/10 text-white ${view === 'train' ? 'bg-white/20' : ''}`}
                                    title="Entrenar Bot"
                                >
                                    <Brain size={16} />
                                </button>
                            )}
                            <button onClick={() => setView(view === 'history' ? 'chat' : 'history')} className={`p-2 rounded-full hover:bg-white/10 text-white ${view === 'history' ? 'bg-white/20' : ''}`} title="Historial">
                                <History size={16} />
                            </button>
                            <button onClick={startNewChat} className="p-2 rounded-full hover:bg-white/10 text-white" title="Nuevo Chat">
                                <Plus size={16} />
                            </button>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Contenido Principal changeable */}
                <div className="flex-1 overflow-hidden relative bg-gray-950/50">

                    {/* VISTA: CHAT */}
                    {view === 'chat' && (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                {messages.map((message) => (
                                    <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-3 ${message.sender === 'user'
                                            ? 'bg-red-700 text-white rounded-tr-none'
                                            : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
                                            }`}>
                                            <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                                            <span className="text-[10px] opacity-60 block text-right mt-1">{message.timestamp}</span>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-700 flex gap-2">
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce delay-75"></div>
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-3 bg-gray-900/50 border-t border-gray-800">
                                <div className="flex gap-2">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Escribe tu mensaje..."
                                        className="flex-1 bg-gray-800 border-none rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-red-500 resize-none h-[40px] scrollbar-hide"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISTA: HISTORIAL */}
                    {view === 'history' && (
                        <div className="h-full flex flex-col p-4 overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-white font-semibold">Historial de Conversaciones</h4>
                            </div>
                            <div className="space-y-2">
                                {conversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        onClick={() => loadConversation(conv.id)}
                                        className={`p-3 rounded-lg cursor-pointer border transition-all flex justify-between items-center group ${currentConvId === conv.id
                                            ? 'bg-red-900/20 border-red-500/50'
                                            : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                                            }`}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="text-gray-200 text-sm font-medium truncate">
                                                {conv.messages.find(m => m.sender === 'user')?.text || "Nueva conversación"}
                                            </p>
                                            <p className="text-gray-500 text-xs mt-1">
                                                {new Date(conv.timestamp).toLocaleDateString()} - {conv.messages.length} mensajes
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => deleteConversation(e, conv.id)}
                                            className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {conversations.length === 0 && (
                                    <p className="text-gray-500 text-center text-sm py-4">No hay historial.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VISTA: ENTRENAMIENTO (TEACH MODE) */}
                    {view === 'train' && (
                        <div className="h-full flex flex-col p-4 overflow-y-auto scrollbar-thin">
                            <div className="flex items-center gap-2 mb-4 text-white">
                                <button onClick={() => setView('chat')} className="hover:bg-white/10 p-1 rounded">
                                    <ChevronLeft size={20} />
                                </button>
                                <h4 className="font-semibold">Entrenar al Asistente</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-200">
                                    <span className="font-bold block mb-1"> Modo Aprendizaje</span>
                                    Agrega preguntas y respuestas personalizadas. El bot usará esto antes de consultar al servidor.
                                </div>

                                <div>
                                    <label className="text-gray-400 text-xs uppercase font-bold mb-1 block">Si el usuario pregunta:</label>
                                    <input
                                        value={trainQuestion}
                                        onChange={(e) => setTrainQuestion(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-red-500 outline-none"
                                        placeholder="Ej: ¿Cuál es el horario?"
                                    />
                                </div>

                                <div>
                                    <label className="text-gray-400 text-xs uppercase font-bold mb-1 block">El bot debe responder:</label>
                                    <textarea
                                        value={trainAnswer}
                                        onChange={(e) => setTrainAnswer(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-red-500 outline-none min-h-[100px]"
                                        placeholder="Ej: Trabajamos de 8am a 5pm."
                                    />
                                </div>

                                <button
                                    onClick={saveTraining}
                                    disabled={!trainQuestion || !trainAnswer}
                                    className="w-full py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg text-white font-medium shadow-lg hover:shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Save size={16} />
                                    Guardar Conocimiento
                                </button>

                                <div className="border-t border-gray-800 pt-4 mt-2">
                                    <h5 className="text-gray-400 text-xs uppercase font-bold mb-2">Conocimiento Agregado ({customKnowledge.length})</h5>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                        {customKnowledge.map((k) => (
                                            <div key={k.id} className="bg-gray-800/50 border border-gray-700/50 p-2 rounded text-xs flex justify-between items-start group">
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-red-300 font-medium truncate">P: {k.question}</p>
                                                    <p className="text-gray-400 truncate">R: {k.answer}</p>
                                                </div>
                                                <button
                                                    onClick={() => deleteKnowledge(k.id)}
                                                    className="p-1 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
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
        </AnimatePresence>
    );
}
