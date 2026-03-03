"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Shield, Zap, Lock, User, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
// import { login } from '../../lib/api'; // Eliminado: Usaremos useAuth

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
          ✓ Sistema listo. Redirigiendo al login...
        </p>
      </div>
    </div>
  );
};

// ========================
// LOGIN
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
  error, showError, autoComplete, required, ...props
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

        {/* Toggle Password Visibility Button */}
        {id === 'password' && (
          <button
            type="button"
            onClick={props.onTogglePassword}
            className="pr-4 text-gray-500 hover:text-red-400 transition-colors focus:outline-none"
          >
            {type === 'password' ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}

        {value && !error && id !== 'password' && (
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

const LoadingButton = ({ isLoading, children, ...props }) => (
  <button
    {...props}
    disabled={isLoading}
    className={`glass-hover relative overflow-hidden w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:transform-none ${isLoading
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
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
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

// ====================================================================
// FORMULARIO PRINCIPAL
// ====================================================================
const LoginCorpoelecForm = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const formRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const safeNextPath = useCallback(() => {
    const next = searchParams.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      return next;
    }
    return '/dashboard';
  }, [searchParams]);

  // ✅ USAR HOOK DE AUTH
  const { login: authLogin, isAuthenticated } = useAuth();

  // ✅ Redirección automática si ya está autenticado
  useEffect(() => {
    if (isAuthenticated && !loginSuccess) {
      router.push(safeNextPath());
    }
  }, [isAuthenticated, loginSuccess, router, safeNextPath]);

  // ✅ Redirección después de login exitoso (con delay para efecto visual)
  useEffect(() => {
    if (loginSuccess) {
      const timer = setTimeout(() => {
        router.push(safeNextPath());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loginSuccess, router, safeNextPath]);

  const { type: passwordType, toggle: togglePassword } = usePasswordToggle();

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

  const validate = useCallback(() => {
    const newErrors = {};
    const { username, password } = formData;

    if (!username.trim()) newErrors.username = 'Usuario corporativo requerido';
    else if (username.length < 4) newErrors.username = 'Mínimo 4 caracteres';

    if (!password) newErrors.password = 'Contraseña requerida';
    else if (password.length < 6) newErrors.password = 'Mínimo 6 caracteres';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

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
    setLoginError(null);

    // Limpieza previa de sesion
    localStorage.removeItem('sgd_token');
    localStorage.removeItem('sgd_user');
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);

    try {
      console.log("Intentando login corporativo para:", formData.username);

      // ✅ USAMOS EL SISTEMA DE AUTH UNIFICADO
      const result = await authLogin(formData.username, formData.password);

      if (result.success) {
        console.log('✅ Acceso autorizado por AuthContext');
        setLoginSuccess(true);
      } else {
        setLoginError(result.error || 'Credenciales incorrectas o error de servidor');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error en flujo de autenticación:', error);
      setLoginError(error?.message || 'Error inesperado de conexión');
      setIsLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (loginError) {
      setLoginError(null);
    }
  };

  if (loginSuccess) {
    return (
      <div className="min-h-screen remaster-auth-bg flex items-center justify-center p-4 relative bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Particles />
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-orange-500/10" />
        <div className="relative max-w-md w-full text-center animate-scaleIn">
          <div className="remaster-auth-card bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-red-500/50 p-12 shadow-2xl">
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <CheckCircle size={48} className="text-red-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">¡Bienvenido!</h2>
            <p className="text-gray-400 mb-6">Redirigiendo al Dashboard...</p>
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
      className="min-h-screen remaster-auth-bg flex items-center justify-center p-4 relative overflow-hidden"
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

      <div className="relative w-full max-w-md" ref={formRef}>
        <div className="remaster-auth-card bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden">
          <div className="relative px-8 py-10 text-center border-b border-gray-700/30">
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-red-500/20 px-3 py-1 rounded-full">
              <Shield size={14} className="text-red-400" />
              <span className="text-xs text-red-400 font-medium">Alfa 2026 V-1.0</span>
            </div>
            <div className="flex justify-center mb-4 relative">
              <div
                className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 overflow-hidden border-2 border-red-500/30"
              >
                <img
                  src="/logo-rojo.png"
                  alt="Logo"
                  className="h-20 w-20 object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              CORPOELEC <span className="text-red-500">INDUSTRIAL</span>
            </h1>
            <p className="text-gray-400 mt-2 text-sm flex items-center justify-center gap-2">
              <Lock size={14} />
              Sistema de Gestión Empresarial
            </p>

          </div>

          <div className="px-8 pb-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoComplete="current-password"
                  required
                  onTogglePassword={togglePassword}
                />

              </div>

              {loginError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-shake">
                  <AlertCircle size={18} />
                  <span>{loginError}</span>
                </div>
              )}

              <LoadingButton isLoading={isLoading}>
                <span className="flex items-center justify-center gap-2">
                  <Shield size={20} />
                  {isLoading ? 'ACCEDIENDO AL SISTEMA...' : 'ACCEDER AL SISTEMA'}
                </span>
              </LoadingButton>
            </form>
          </div>

          <div className="px-8 py-6 border-t border-gray-700/30 bg-gray-900/30">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>Sistema operativo • Conexión Segura • Supabase SQL Active</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-10px);} 40%,80%{transform:translateX(10px);} }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
        @keyframes float { 0%,100%{transform:translateY(0) scale(1); opacity:0.2;} 50%{transform:translateY(-20px) scale(1.2); opacity:0.4;} }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-float { animation: float infinite ease-in-out; }
        .animate-shake { animation: shake 0.5s ease; }
        .animate-scaleIn { animation: scaleIn 0.5s ease forwards; }
        .animate-fadeIn { animation: fadeIn 0.3s ease; }

      `}</style>
    </div>
  );
};

export default function LoginCorpoelec() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return <LoginCorpoelecForm />;
}
