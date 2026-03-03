"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield, Zap, Lock, User, Mail, Phone, CheckCircle, AlertCircle, ChevronRight, ArrowLeft, Briefcase } from 'lucide-react';
// import { registrarUsuario } from '../actions';
import { register } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { uiAlert } from '../../lib/ui-dialog';

// ====================================================================
// NEON CHECKBOX
// ====================================================================
const NeonCheckbox = ({ checked, onChange }) => (
  <label className="neon-checkbox">
    <input type="checkbox" checked={checked} onChange={onChange} />
    <div className="neon-checkbox__frame">
      <div className="neon-checkbox__box">
        <div className="neon-checkbox__check-container">
          <svg viewBox="0 0 24 24" className="neon-checkbox__check">
            <path d="M3,12.5l7,7L21,5"></path>
          </svg>
        </div>
        <div className="neon-checkbox__glow"></div>
        <div className="neon-checkbox__borders">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div className="neon-checkbox__effects">
        <div className="neon-checkbox__particles">
          <span></span><span></span><span></span><span></span> <span></span><span></span><span></span><span></span> <span></span><span></span><span></span><span></span>
        </div>
        <div className="neon-checkbox__rings">
          <div className="ring"></div>
          <div className="ring"></div>
          <div className="ring"></div>
        </div>
        <div className="neon-checkbox__sparks">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
    </div>
  </label>
);

// ====================================================================
// SPLASH SCREEN - CORPOEELEC INDUSTRIAL
// ====================================================================
const SplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState([false, false, false]);
  const [showLoader, setShowLoader] = useState(true);
  const loaderRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
    const totalDuration = 3000;
    let animationFrameId;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progressValue = Math.min(elapsed / totalDuration, 1);
      const percent = Math.floor(progressValue * 100);

      setProgress(percent);

      setStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 3; i++) {
          const statusStart = 0.1 + (i * 0.2);
          if (progressValue > statusStart) {
            next[i] = true;
          }
        }
        return next;
      });

      // Completar
      if (progressValue >= 1) {
        setShowLoader(false);
        if (loaderRef.current) {
          loaderRef.current.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          loaderRef.current.style.opacity = '0';
          loaderRef.current.style.transform = 'scale(0.92)';
          setTimeout(() => {
            if (loaderRef.current) loaderRef.current.style.display = 'none';
          }, 300);
        }

        if (onComplete) {
          setTimeout(() => onComplete(), 300);
        }
      }

      if (progressValue < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Activar primer estado
    const timeoutId = setTimeout(() => {
      setStatus(prev => {
        const newS = [...prev];
        newS[0] = true;
        return newS;
      });
    }, 100);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
    };
  }, [onComplete]);

  return (
    <div className="splash-screen">

      <div className="splash-container">
        {/* Logo */}
        <div className="logo-text">CORPOELEC INDUSTRIAL</div>
        <div className="logo-subtitle">Sistema de Gestión Integral</div>

        {/* Loader */}
        {showLoader && (
          <div className="loader" ref={loaderRef} aria-hidden="true">
            <div className="sphere"></div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <mask id="waves" maskUnits="userSpaceOnUse">
                  <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5,50 C25,50 30,20 50,20 C70,20 75,50 95,50"></path>
                    <path d="M5,50 C25,50 30,20 50,20 C70,20 75,50 95,50"></path>
                    <path d="M5,50 C25,50 30,80 50,80 C70,80 75,50 95,50"></path>
                    <path d="M5,50 C25,50 30,80 50,80 C70,80 75,50 95,50"></path>
                  </g>
                </mask>
                <mask id="blurriness" maskUnits="userSpaceOnUse">
                  <g>
                    <circle cx="50" cy="50" r="50" fill="white"></circle>
                    <ellipse cx="50" cy="50" rx="25" ry="25" fill="black"></ellipse>
                  </g>
                </mask>
                <mask id="clipping" maskUnits="userSpaceOnUse">
                  <ellipse cx="50" cy="50" rx="25" ry="50" fill="white"></ellipse>
                </mask>
                <mask id="fade" maskUnits="userSpaceOnUse">
                  <ellipse cx="50" cy="50" rx="45" ry="50" fill="white"></ellipse>
                </mask>
              </defs>
              <g id="shapes" mask="url(#fade)">
                <g mask="url(#clipping)">
                  <circle cx="50" cy="50" r="50" fill="currentColor" mask="url(#waves)"></circle>
                </g>
                <g mask="url(#blurriness)">
                  <circle cx="50" cy="50" r="50" fill="currentColor" mask="url(#waves)"></circle>
                </g>
              </g>
            </svg>
          </div>
        )}

        {/* Barra de progreso */}
        <div className="progress-container">
          <div className="progress-label">
            <span>Inicializando sistema...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill bg-red-600" style={{ width: `${progress}%`, boxShadow: '0 0 10px #ef4444' }}></div>
          </div>
        </div>

        {/* Estado del sistema */}
        <div className="system-status">
          <div className={`status-item ${status[0] ? 'active text-red-400' : ''}`}>
            <span className={`status-dot ${status[0] ? 'bg-red-500' : ''}`}></span>
            <span className="status-text">Conectando a servidores Corpoelec...</span>
          </div>
          <div className={`status-item ${status[1] ? 'active text-red-400' : ''}`}>
            <span className={`status-dot ${status[1] ? 'bg-red-500' : ''}`}></span>
            <span className="status-text">Verificando credenciales corporativas...</span>
          </div>
          <div className={`status-item ${status[2] ? 'active text-red-400' : ''}`}>
            <span className={`status-dot ${status[2] ? 'bg-red-500' : ''}`}></span>
            <span className="status-text">Cargando datos industriales...</span>
          </div>
        </div>

        <p className={`loading-complete text-red-400 ${progress === 100 ? 'visible' : ''}`}>
          ✓ Sistema listo. Redirigiendo al registro...
        </p>
      </div>
    </div>
  );
};

// ========================
// REGISTRO
// ========================
const usePasswordToggle = () => {
  const [visible, setVisible] = useState(false);
  const toggle = useCallback(() => setVisible(v => !v), []);
  return { type: visible ? 'text' : 'password', icon: visible ? <EyeOff size={18} /> : <Eye size={18} />, toggle };
};

const PasswordStrength = ({ password }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  };

  const strength = getStrength();
  const labels = ['Muy débil', 'Débil', 'Regular', 'Fuerte', 'Excelente'];
  const colors = ['bg-red-800', 'bg-red-600', 'bg-orange-500', 'bg-orange-400', 'bg-red-500'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(level => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full ${strength >= level ? colors[strength - 1] : 'bg-gray-700'
              }`}
          />
        ))}
      </div>
      <p className={`text-xs ${strength >= 3 ? 'text-orange-400' : strength >= 2 ? 'text-red-400' : 'text-red-600'
        }`}>
        {labels[strength - 1]}
      </p>
    </div>
  );
};

const AnimatedInput = ({
  id, label, value, onChange, type, placeholder, icon: Icon,
  error, showError, autoComplete, required
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={`absolute left-12 transition-all duration-300 z-10 ${isFocused || hasValue
          ? '-top-2 left-8 text-xs px-2 bg-transparent font-semibold uppercase tracking-wider'
          : 'top-4 text-gray-400'
          } ${isFocused ? 'text-red-400' : 'text-gray-400'}`}
      >
        {label}
      </label>

      <div className={`relative flex items-center rounded-xl ${error ? 'bg-red-500/10' : 'bg-gray-900/50'
        } ${isFocused ? 'ring-2 ring-red-500/40' : ''}`}>
        <div className={`pl-4 pr-2 ${isFocused ? 'text-red-400' : 'text-gray-500'}`}>
          <Icon size={20} />
        </div>

        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={isFocused ? placeholder : ''}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoComplete={autoComplete}
          required={required}
          className="w-full px-4 py-4 bg-transparent text-white placeholder-gray-500/50 focus:outline-none"
        />

        {value && !error && (
          <div className="pr-4 text-red-400">
            <CheckCircle size={18} />
          </div>
        )}
      </div>

      {error && showError && (
        <div className="flex items-center mt-2 text-red-500 text-xs animate-shake">
          <AlertCircle size={14} className="mr-1" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

const AnimatedSelect = ({
  id, label, value, onChange, icon: Icon,
  error, showError, required, options
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={`absolute left-12 transition-all duration-300 z-10 ${isFocused || hasValue
          ? '-top-2 left-8 text-xs px-2 bg-transparent font-semibold uppercase tracking-wider'
          : 'top-4 text-gray-400'
          } ${isFocused ? 'text-red-400' : 'text-gray-400'}`}
      >
        {label}
      </label>

      <div className={`relative flex items-center rounded-xl ${error ? 'bg-red-500/10' : 'bg-gray-900/50'
        } ${isFocused ? 'ring-2 ring-red-500/40' : ''}`}>
        <div className={`pl-4 pr-2 ${isFocused ? 'text-red-400' : 'text-gray-500'}`}>
          <Icon size={20} />
        </div>

        <select
          id={id}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          className="w-full px-4 py-4 bg-transparent text-white focus:outline-none appearance-none cursor-pointer"
        >
          <option value="" disabled></option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-gray-900 text-white">
              {opt}
            </option>
          ))}
        </select>

        <div className="absolute right-4 text-gray-500 pointer-events-none">
          <ChevronRight size={16} className="rotate-90" />
        </div>

        {value && !error && (
          <div className="absolute right-10 text-red-400 pointer-events-none">
            <CheckCircle size={18} />
          </div>
        )}
      </div>

      {error && showError && (
        <div className="flex items-center mt-2 text-red-500 text-xs animate-shake">
          <AlertCircle size={14} className="mr-1" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

const LoadingButton = ({ isLoading, children, ...props }) => (
  <button
    {...props}
    disabled={isLoading}
    className={`relative overflow-hidden w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:transform-none ${isLoading
      ? 'bg-gray-700 cursor-not-allowed'
      : 'bg-gradient-to-r from-red-600 to-orange-700 hover:from-red-500 hover:to-orange-600 shadow-red-500/30 hover:shadow-red-500/50'
      } shadow-lg`}
  >
    {isLoading && (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    )}
    <span className={isLoading ? 'invisible' : ''}>{children}</span>
  </button>
);

const Particles = () => {
  const [mounted, setMounted] = useState(false);
  const [particleList, setParticleList] = useState([]);

  useEffect(() => {
    const generated = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 5,
    }));
    setParticleList(generated);
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particleList.map(p => (
        <div
          key={p.id}
          className="absolute bg-red-500/20 rounded-full animate-float"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

const RegistroForm = () => {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://corpoelect-backend.onrender.com"
      : "http://127.0.0.1:8000");
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    gerencia: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [registroSuccess, setRegistroSuccess] = useState(false);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [gerenciaOptions, setGerenciaOptions] = useState([]);
  const formRef = useRef(null);

  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const isPrivilegedRegistrar =
    isAuthenticated &&
    (user?.role === 'Desarrollador' || user?.role === 'Administrativo');
  const redirectPathAfterRegister = isPrivilegedRegistrar ? '/dashboard' : '/login';

  useEffect(() => {
    if (registroSuccess) {
      const timer = setTimeout(() => {
        router.push(redirectPathAfterRegister);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [registroSuccess, router, redirectPathAfterRegister]);

  const { type: passwordType } = usePasswordToggle();
  const { type: confirmPasswordType } = usePasswordToggle();

  useEffect(() => {
    const elements = formRef.current?.children;
    if (elements) {
      Array.from(elements).forEach((el, i) => {
        if (el.style) {
          el.style.opacity = '0';
          el.style.transform = 'translateY(20px)';
          el.style.animation = `fadeInUp 0.6s ease forwards ${i * 0.1}s`;
        }
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window !== "undefined") {
        const cachedOrg = localStorage.getItem("org_structure_data");
        if (cachedOrg) {
          try {
            const parsed = JSON.parse(cachedOrg);
            const localNames = (Array.isArray(parsed) ? parsed : [])
              .flatMap((group) => (group?.items || []))
              .map((n) => String(n || "").trim())
              .filter(Boolean);
            if (localNames.length > 0) {
              const uniq = Array.from(new Set(localNames.map((n) => n.toLowerCase())))
                .map((key) => localNames.find((n) => n.toLowerCase() === key))
                .filter(Boolean);
              if (!cancelled && uniq.length > 0) {
                setGerenciaOptions(uniq);
              }
            }
          } catch {
            // Ignore parse errors.
          }
        }
      }

      try {
        const res = await fetch(`${API_BASE_URL}/gerencias/public`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          const names = data
            .map((g) => String(g?.nombre || "").trim())
            .filter(Boolean);
          if (names.length > 0) {
            setGerenciaOptions(names);
          }
        }
      } catch {
        // Fallback silencioso a lista local.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL]);

  const validate = useCallback(() => {
    const newErrors = {};
    const { nombre, apellido, email, telefono, username, password, confirmPassword, gerencia } = formData;

    if (!nombre.trim()) newErrors.nombre = 'Nombre requerido';
    if (!apellido.trim()) newErrors.apellido = 'Apellido requerido';

    if (!email.trim()) newErrors.email = 'Email requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Email inválido';

    if (!gerencia) newErrors.gerencia = 'Seleccione una gerencia';

    if (!username.trim()) newErrors.username = 'Usuario corporativo requerido';
    else if (username.length < 4) newErrors.username = 'Mínimo 4 caracteres';

    if (!password) newErrors.password = 'Contraseña requerida';
    else if (password.length < 8) newErrors.password = 'Mínimo 8 caracteres';

    if (!confirmPassword) newErrors.confirmPassword = 'Confirmar contraseña';
    else if (confirmPassword !== password) newErrors.confirmPassword = 'Las contraseñas no coinciden';

    if (!terminosAceptados) newErrors.terminos = 'Debes aceptar los términos y condiciones';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, terminosAceptados]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      const form = formRef.current;
      if (form) {
        form.style.animation = 'none';
        form.offsetHeight;
        form.style.animation = 'shake 0.5s ease';
      }
      return;
    }

    setIsLoading(true);

    try {
      // Preparar datos para el backend Python
      const userData = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        gerencia_nombre: formData.gerencia, // El backend buscará el ID por nombre
        rol_id: 3 // Usuario por defecto (aunque el backend ya lo asigna)
      };

      await register(userData);

      // Éxito
      console.log('✅ Registro exitoso en DB');
      setRegistroSuccess(true);

    } catch (error) {
      console.error("Error frontend:", error);
      void uiAlert(`Error: ${error.message}`, "Registro");
      setIsLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (registroSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Particles />
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-orange-500/10" />
        <div className="relative max-w-md w-full text-center animate-scaleIn">
          <div className="bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-red-500/50 p-12 shadow-2xl">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <CheckCircle size={48} className="text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-slate-700 mb-2">¡Registro Exitoso!</h2>
            <p className="text-slate-500 mb-6">
              {isPrivilegedRegistrar ? 'Redirigiendo al Dashboard...' : 'Redirigiendo al Login...'}
            </p>
            <div className="flex justify-center gap-2">
              <div className="w-3 h-3 bg-red-400 rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-3 h-3 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: "url('/logo-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/90 to-black/95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(239,68,68,0.1),transparent_50%)]" />
      <Particles />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-2xl" ref={formRef}>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden">
          <div className="relative px-8 py-10 text-center border-b border-gray-700/30">
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-red-500/20 px-3 py-1 rounded-full">
              <Shield size={14} className="text-red-400" />
              <span className="text-xs text-red-400 font-medium">Alfa 2026 V-1.0</span>
            </div>
            <div className="flex justify-center mb-4">
              <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border-2 border-red-500/30">
                <img src="/logo-rojo.png" alt="Logo" className="h-20 w-20 object-contain" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              CORPOELEC <span className="text-red-500">INDUSTRIAL</span>
            </h1>
            <p className="text-gray-400 mt-2 text-sm flex items-center justify-center gap-2">
              <User size={14} />
              Registro de Nuevo Usuario Corporativo
            </p>
          </div>

          <div className="px-8 pb-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatedInput
                  id="nombre"
                  label="Nombre"
                  value={formData.nombre}
                  onChange={handleChange('nombre')}
                  placeholder="ej: Juan"
                  icon={User}
                  error={errors.nombre}
                  showError={!!errors.nombre}
                  autoComplete="given-name"
                  required
                />

                <AnimatedInput
                  id="apellido"
                  label="Apellido"
                  value={formData.apellido}
                  onChange={handleChange('apellido')}
                  placeholder="ej: Pérez"
                  icon={User}
                  error={errors.apellido}
                  showError={!!errors.apellido}
                  autoComplete="family-name"
                  required
                />
              </div>

              <AnimatedInput
                id="email"
                label="Email"
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="ej: juan.perez@ejemplo.com"
                icon={Mail}
                type="email"
                error={errors.email}
                showError={!!errors.email}
                autoComplete="email"
                required
              />

              <AnimatedInput
                id="username"
                label="Usuario Corporativo"
                value={formData.username}
                onChange={handleChange('username')}
                placeholder="ej: JPEREZ"
                icon={User}
                error={errors.username}
                showError={!!errors.username}
                autoComplete="username"
                required
              />

              <AnimatedSelect
                id="gerencia"
                label="Gerencia / Departamento"
                value={formData.gerencia}
                onChange={handleChange('gerencia')}
                icon={Briefcase}
                error={errors.gerencia}
                showError={!!errors.gerencia}
                options={gerenciaOptions.length > 0 ? gerenciaOptions : [
                  'Gerencia General',
                  'Auditoria Interna',
                  'Consultoría Jurídica',
                  'Gerencia Nacional de Planificación y presupuesto',
                  'Gerencia Nacional de Administración',
                  'Gerencia Nacional de Gestión Humana',
                  'Gerencia Nacional de Tecnologías de la Información y la Comunicación',
                  'Gerencia Nacional de Tecnologías de Proyectos',
                  'Gerencia Nacional de Adecuaciones y Mejoras',
                  'Gerencia Nacional de Asho',
                  'Gerencia Nacional de Atención al Ciudadano',
                  'Gerencia de Comercialización',
                  'Gerencia Nacional de Energía Alternativa y Eficiencia Energética',
                  'Gerencia Nacional de Gestión Communal',
                  'Unerven',
                  'Vietven'
                ]}
                required
              />

              <div>
                <AnimatedInput
                  id="password"
                  label="Contraseña Segura"
                  value={formData.password}
                  onChange={handleChange('password')}
                  placeholder="••••••••"
                  type={passwordType}
                  icon={Lock}
                  error={errors.password}
                  showError={!!errors.password}
                  autoComplete="new-password"
                  required
                />
                <PasswordStrength password={formData.password} />
              </div>

              <div>
                <AnimatedInput
                  id="confirmPassword"
                  label="Confirmar Contraseña"
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="••••••••"
                  type={confirmPasswordType}
                  icon={Lock}
                  error={errors.confirmPassword}
                  showError={!!errors.confirmPassword}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <NeonCheckbox checked={terminosAceptados} onChange={(e) => setTerminosAceptados(e.target.checked)} />
                  <span
                    className="text-sm text-gray-400 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setTerminosAceptados(!terminosAceptados)}
                  >
                    Acepto términos y condiciones
                  </span>
                </div>
              </div>

              {errors.terminos && (
                <div className="flex items-center text-red-500 text-xs animate-shake">
                  <AlertCircle size={14} className="mr-1" />
                  <span>{errors.terminos}</span>
                </div>
              )}

              <LoadingButton isLoading={isLoading}>
                <span className="flex items-center justify-center gap-2">
                  <Shield size={20} />
                  REGISTRAR USUARIO
                </span>
              </LoadingButton>
            </form>
          </div>

          <div className="px-8 py-6 border-t border-gray-700/30 bg-gray-900/30">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <ArrowLeft size={14} className="text-red-400" />
              <button
                onClick={() => router.push(isPrivilegedRegistrar ? '/dashboard' : '/login')}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                {isPrivilegedRegistrar ? 'Volver al Dashboard' : 'Volver al Login'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-10px);} 40%,80%{transform:translateX(10px);} }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
        @keyframes float { 0%,100%{transform:translateY(0) scale(1); opacity:0.2;} 50%{transform:translateY(-20px) scale(1.2); opacity:0.4;} }
        .animate-float { animation: float infinite ease-in-out; }
        .animate-shake { animation: shake 0.5s ease; }
        .animate-scaleIn { animation: scaleIn 0.5s ease forwards; }

        /* NEON CHECKBOX STYLES (Adapted to Red Theme) */
        .neon-checkbox {
          --primary: #ef4444; /* red-500 */
          --primary-dark: #b91c1c; /* red-700 */
          --primary-light: #f87171; /* red-400 */
          --size: 30px;
          position: relative;
          width: var(--size);
          height: var(--size);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .neon-checkbox input {
          display: none;
        }

        .neon-checkbox__frame {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .neon-checkbox__box {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 4px;
          border: 2px solid var(--primary-dark);
          transition: all 0.4s ease;
        }

        .neon-checkbox__check-container {
          position: absolute;
          inset: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .neon-checkbox__check {
          width: 80%;
          height: 80%;
          fill: none;
          stroke: var(--primary);
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          transform-origin: center;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .neon-checkbox__glow {
          position: absolute;
          inset: -2px;
          border-radius: 6px;
          background: var(--primary);
          opacity: 0;
          filter: blur(8px);
          transform: scale(1.2);
          transition: all 0.4s ease;
        }

        .neon-checkbox__borders {
          position: absolute;
          inset: 0;
          border-radius: 4px;
          overflow: hidden;
        }

        .neon-checkbox__borders span {
          position: absolute;
          width: 40px;
          height: 1px;
          background: var(--primary);
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .neon-checkbox__borders span:nth-child(1) {
          top: 0;
          left: -100%;
          animation: borderFlow1 2s linear infinite;
        }

        .neon-checkbox__borders span:nth-child(2) {
          top: -100%;
          right: 0;
          width: 1px;
          height: 40px;
          animation: borderFlow2 2s linear infinite;
        }

        .neon-checkbox__borders span:nth-child(3) {
          bottom: 0;
          right: -100%;
          animation: borderFlow3 2s linear infinite;
        }

        .neon-checkbox__borders span:nth-child(4) {
          bottom: -100%;
          left: 0;
          width: 1px;
          height: 40px;
          animation: borderFlow4 2s linear infinite;
        }

        .neon-checkbox__particles span {
          position: absolute;
          width: 4px;
          height: 4px;
          background: var(--primary);
          border-radius: 50%;
          opacity: 0;
          pointer-events: none;
          top: 50%;
          left: 50%;
          box-shadow: 0 0 6px var(--primary);
        }

        .neon-checkbox__rings {
          position: absolute;
          inset: -20px;
          pointer-events: none;
        }

        .neon-checkbox__rings .ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid var(--primary);
          opacity: 0;
          transform: scale(0);
        }

        .neon-checkbox__sparks span {
          position: absolute;
          width: 20px;
          height: 1px;
          background: linear-gradient(90deg, var(--primary), transparent);
          opacity: 0;
        }

        /* Hover Effects */
        .neon-checkbox:hover .neon-checkbox__box {
          border-color: var(--primary);
          transform: scale(1.05);
        }

        /* Checked State */
        .neon-checkbox input:checked ~ .neon-checkbox__frame .neon-checkbox__box {
          border-color: var(--primary);
          background: rgba(239, 68, 68, 0.1); 
        }

        .neon-checkbox input:checked ~ .neon-checkbox__frame .neon-checkbox__check {
          stroke-dashoffset: 0;
          transform: scale(1.1);
        }

        .neon-checkbox input:checked ~ .neon-checkbox__frame .neon-checkbox__glow {
          opacity: 0.2;
        }

        .neon-checkbox
          input:checked
          ~ .neon-checkbox__frame
          .neon-checkbox__borders
          span {
          opacity: 1;
        }

        /* Particle Animations */
        .neon-checkbox
          input:checked
          ~ .neon-checkbox__frame
          .neon-checkbox__particles
          span {
          animation: particleExplosion 0.6s ease-out forwards;
        }

        .neon-checkbox
          input:checked
          ~ .neon-checkbox__frame
          .neon-checkbox__rings
          .ring {
          animation: ringPulse 0.6s ease-out forwards;
        }

        .neon-checkbox
          input:checked
          ~ .neon-checkbox__frame
          .neon-checkbox__sparks
          span {
          animation: sparkFlash 0.6s ease-out forwards;
        }

        /* Animations */
        @keyframes borderFlow1 {
          0% { transform: translateX(0); }
          100% { transform: translateX(200%); }
        }
        @keyframes borderFlow2 {
          0% { transform: translateY(0); }
          100% { transform: translateY(200%); }
        }
        @keyframes borderFlow3 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-200%); }
        }
        @keyframes borderFlow4 {
          0% { transform: translateY(0); }
          100% { transform: translateY(-200%); }
        }
        @keyframes particleExplosion {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--x, 20px)), calc(-50% + var(--y, 20px))) scale(0); opacity: 0; }
        }
        @keyframes ringPulse {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes sparkFlash {
          0% { transform: rotate(var(--r, 0deg)) translateX(0) scale(1); opacity: 1; }
          100% { transform: rotate(var(--r, 0deg)) translateX(30px) scale(0); opacity: 0; }
        }

        /* Particle Positions */
        .neon-checkbox__particles span:nth-child(1) { --x: 25px; --y: -25px; }
        .neon-checkbox__particles span:nth-child(2) { --x: -25px; --y: -25px; }
        .neon-checkbox__particles span:nth-child(3) { --x: 25px; --y: 25px; }
        .neon-checkbox__particles span:nth-child(4) { --x: -25px; --y: 25px; }
        .neon-checkbox__particles span:nth-child(5) { --x: 35px; --y: 0px; }
        .neon-checkbox__particles span:nth-child(6) { --x: -35px; --y: 0px; }
        .neon-checkbox__particles span:nth-child(7) { --x: 0px; --y: 35px; }
        .neon-checkbox__particles span:nth-child(8) { --x: 0px; --y: -35px; }
        .neon-checkbox__particles span:nth-child(9) { --x: 20px; --y: -30px; }
        .neon-checkbox__particles span:nth-child(10) { --x: -20px; --y: 30px; }
        .neon-checkbox__particles span:nth-child(11) { --x: 30px; --y: 20px; }
        .neon-checkbox__particles span:nth-child(12) { --x: -30px; --y: -20px; }

        /* Spark Rotations */
        .neon-checkbox__sparks span:nth-child(1) { --r: 0deg; top: 50%; left: 50%; }
        .neon-checkbox__sparks span:nth-child(2) { --r: 90deg; top: 50%; left: 50%; }
        .neon-checkbox__sparks span:nth-child(3) { --r: 180deg; top: 50%; left: 50%; }
        .neon-checkbox__sparks span:nth-child(4) { --r: 270deg; top: 50%; left: 50%; }

        /* Ring Delays */
        .neon-checkbox__rings .ring:nth-child(1) { animation-delay: 0s; }
        .neon-checkbox__rings .ring:nth-child(2) { animation-delay: 0.1s; }
        .neon-checkbox__rings .ring:nth-child(3) { animation-delay: 0.2s; }
      `}</style>
    </div>
  );
};

export default function RegistroPage() {
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (!mounted) {
    return <div className="min-h-screen bg-black" />; // Evita mismatch de hidratación brindando un estado inicial vacío
  }

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return <RegistroForm />;
}
