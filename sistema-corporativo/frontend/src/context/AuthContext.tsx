"use client";

import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useContext,
} from "react";
import { DEFAULT_SCOPES, PERMISSIONS_MASTER } from "../permissions/constants";

export type UserRole = "CEO" | "Administrativo" | "Usuario" | "Desarrollador";

export interface User {
  id: string;
  username: string;
  nombre: string;
  apellido: string;
  email_corp: string;
  gerencia_depto: string;
  gerencia_id?: number;
  role: UserRole;
  roleOriginal?: UserRole;
  permissions: string[];
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  devLogin: () => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
  switchRole: (newRole: UserRole) => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Helper para obtener permisos según el rol
  const getEffectivePermissions = (
    role: UserRole,
    basePermissions?: string[],
  ): string[] => {
    if (role === "Desarrollador") return Object.values(PERMISSIONS_MASTER);

    if (typeof window === "undefined") {
      return basePermissions && basePermissions.length > 0
        ? basePermissions
        : DEFAULT_SCOPES[role] || [];
    }

    if (role === "Administrativo") {
      const savedScope = localStorage.getItem("admin_scope_2026");
      if (savedScope) {
        try {
          return JSON.parse(savedScope);
        } catch (e) {
          console.error("Error parsing admin_scope_2026", e);
        }
      }
    }

    return basePermissions && basePermissions.length > 0
      ? basePermissions
      : DEFAULT_SCOPES[role] || [];
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Verificar sesión al montar el componente
  useEffect(() => {
    if (!isClient) return;

    const checkSession = async () => {
      // 1. Check Dev Bypass
      const devToken = localStorage.getItem("sgd_token");
      if (devToken === "dev-bypass-token-2026") {
        const devUser: User = {
          id: "dev-001",
          username: "dev_admin",
          nombre: "Desarrollador",
          apellido: "System",
          email_corp: "dev@corpoelec.ind",
          gerencia_depto: "Tecnología",
          role: "Desarrollador",
          permissions: Object.values(PERMISSIONS_MASTER),
        };
        setUser(devUser);
        setIsLoading(false);
        return;
      }

      // 2. Check Normal Session
      const token = localStorage.getItem("sgd_token");
      const storedUser = localStorage.getItem("sgd_user");

      if (token && storedUser) {
        // ✅ RE-SINCRO COOKIE: Si el middleware la borró pero tenemos el token, la restauramos
        if (!document.cookie.includes('session=')) {
          document.cookie = `session=${token}; path=/; max-age=86400; SameSite=Lax`;
        }

        try {
          const parsedUser = JSON.parse(storedUser);
          const userWithPerms = {
            ...parsedUser,
            permissions: getEffectivePermissions(
              parsedUser.role as UserRole,
              parsedUser.role as UserRole === user?.role ? user?.permissions : undefined
            ),
          };
          setUser(userWithPerms);
        } catch (e) {
          console.error("Error parsing stored user", e);
          localStorage.removeItem("sgd_user");
          localStorage.removeItem("sgd_token");
        }
      }

      setIsLoading(false);
    };

    checkSession();
  }, [isClient]);

  // ✅ FUNCIÓN LOGIN CORREGIDA (Sin errores de tipo)
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await fetch('https://sistema-corpoelect-backend.onrender.com/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Credenciales incorrectas');
      }

      const data = await response.json();
      const backendUser = data.user;

      // Guardar token
      localStorage.setItem("sgd_token", data.access_token);

      // ✅ Sincronizar con Middleware (Cookie de sesión)
      // Usamos una configuración robusta para evitar que se pierda en la redirección
      document.cookie = `session=${data.access_token}; path=/; max-age=86400; SameSite=Lax`;

      // Construir objeto User
      const newUser: User = {
        id: backendUser.id,
        username: backendUser.username,
        nombre: backendUser.nombre,
        apellido: backendUser.apellido || '',
        email_corp: backendUser.email || `${backendUser.username}@corpoelec.com`,
        gerencia_depto: backendUser.gerencia_depto || 'General',
        gerencia_id: backendUser.gerencia_id,
        role: backendUser.role as UserRole,
        permissions: getEffectivePermissions(backendUser.role as UserRole),
      };

      // Guardar usuario en localStorage
      localStorage.setItem("sgd_user", JSON.stringify(newUser));
      setUser(newUser);

      return true; // ← ÉXITO

    } catch (error: any) {
      console.error('Login error:', error);
      alert(error.message || 'Error de conexión con el servidor');
      return false; // ← ERROR
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FUNCIÓN DEV LOGIN CORREGIDA
  const devLogin = async (): Promise<boolean> => {
    try {
      const devUser: User = {
        id: "dev-001",
        username: "dev_admin",
        nombre: "Desarrollador",
        apellido: "System",
        email_corp: "dev@corpoelec.ind",
        gerencia_depto: "Tecnología",
        role: "Desarrollador",
        permissions: Object.values(PERMISSIONS_MASTER),
      };

      await new Promise((resolve) => setTimeout(resolve, 800));

      localStorage.setItem("sgd_token", "dev-bypass-token-2026");
      document.cookie = "session=dev-bypass-token-2026; path=/; max-age=86400; SameSite=Lax";

      setUser(devUser);
      return true; // ← ÉXITO

    } catch (error) {
      console.error("Dev login failed", error);
      return false; // ← ERROR
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("sgd_token");
    localStorage.removeItem("sgd_user");
    document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const switchRole = async (newRole: UserRole): Promise<boolean> => {
    if (!user) return false;

    let newNombre = user.nombre;
    let newApellido = user.apellido;

    if (newRole === "CEO") {
      newNombre = "Director";
      newApellido = "Ejecutivo";
    } else if (newRole === "Administrativo") {
      newNombre = "Administrador";
      newApellido = "General";
    } else if (newRole === "Usuario") {
      newNombre = "Operador";
      newApellido = "Estándar";
    } else if (newRole === "Desarrollador") {
      newNombre = "Desarrollador";
      newApellido = "Principal";
    }

    const updatedUser: User = {
      ...user,
      role: newRole,
      roleOriginal: user.roleOriginal || user.role,
      nombre: newNombre,
      apellido: newApellido,
      permissions: getEffectivePermissions(newRole),
    };

    setUser(updatedUser);
    localStorage.setItem("sgd_user", JSON.stringify(updatedUser));
    return true;
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === "Desarrollador") return true;
    return user.permissions?.includes(permission) || false;
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    devLogin,
    logout,
    setUser,
    switchRole,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}