"use client";

import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useContext,
} from "react";
import { DEFAULT_SCOPES, PERMISSIONS_MASTER } from "../permissions/constants";

export type UserRole = "CEO" | "Administrativo" | "Usuario" | "Desarrollador" | "Gerente";

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
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const roleSimulationEnabled =
    process.env.NEXT_PUBLIC_ENABLE_ROLE_SIMULATION === "true" &&
    process.env.NODE_ENV !== "production";

  const getEffectivePermissions = (
    role: UserRole,
    basePermissions?: string[],
  ): string[] => {
    if (role === "Desarrollador") return Object.values(PERMISSIONS_MASTER);

    // Si el backend devuelve una lista, incluso vacia, esa es la fuente de verdad.
    if (Array.isArray(basePermissions)) {
      return basePermissions;
    }

    if (typeof window === "undefined") {
      return DEFAULT_SCOPES[role] || [];
    }

    return DEFAULT_SCOPES[role] || [];
  };

  const normalizeRole = (rawRole: string): UserRole => {
    const value = (rawRole || "").trim().toLowerCase();
    if (value === "gerente" || value === "manager") return "Gerente";
    if (value === "desarrollador" || value === "developer" || value === "dev") return "Desarrollador";
    if (value === "administrativo" || value === "administrador" || value === "admin") return "Administrativo";
    if (value === "ceo") return "CEO";
    return "Usuario";
  };

  const buildUserFromBackend = (backendUser: any): User => {
    const role = normalizeRole(String(backendUser.role || "Usuario"));
    const persistedPerms = Array.isArray(backendUser.permissions)
      ? backendUser.permissions
      : Array.isArray(backendUser.permisos)
        ? backendUser.permisos
        : undefined;
    return {
      id: String(backendUser.id),
      username: backendUser.username,
      nombre: backendUser.nombre,
      apellido: backendUser.apellido || "",
      email_corp: backendUser.email || `${backendUser.username}@koda.local`,
      gerencia_depto: backendUser.gerencia_depto || "General",
      gerencia_id: backendUser.gerencia_id,
      role,
      permissions: getEffectivePermissions(role, persistedPerms),
    };
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const hydrateSession = async () => {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      const isAuthRoute = pathname === "/login";
      const token = localStorage.getItem("sgd_token");
      const storedUser = localStorage.getItem("sgd_user");

      // Fuente de verdad: cookie HttpOnly validada en servidor.
      try {
        const authHeaders: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          headers: authHeaders,
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.authenticated && data?.user) {
            const recoveredUser = buildUserFromBackend(data.user);
            setUser(recoveredUser);
            localStorage.setItem("sgd_user", JSON.stringify(recoveredUser));
            return;
          }
        }

        // Sesión inválida en servidor: limpiar cliente para evitar loops y rebotes.
        if (response.status === 401 || response.status === 403) {
          setUser(null);
          localStorage.removeItem("sgd_user");
          localStorage.removeItem("sgd_token");
          return;
        }
      } catch (error) {
        // En login, la ausencia de sesiÃ³n es normal y no requiere ruido en consola.
        if (!isAuthRoute) {
          console.error("Session hydration error:", error);
        }
      }

      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          const role = normalizeRole(String(parsedUser.role || "Usuario"));
          setUser({
            ...parsedUser,
            role,
            permissions: getEffectivePermissions(role, parsedUser.permissions),
          });
          return;
        } catch (e) {
          console.error("Error parsing stored user", e);
          localStorage.removeItem("sgd_user");
          localStorage.removeItem("sgd_token");
        }
      }

      setUser(null);
    };

    hydrateSession().finally(() => {
      setIsLoading(false);
    });
  }, [isClient]);

  const login = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let response: Response;
      try {
        response = await fetch("/api/auth/login", {
          method: "POST",
          body: new URLSearchParams({ username, password }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        let detail = "Credenciales incorrectas o error de servidor";
        try {
          const errData = await response.json();
          const payload = errData?.detail ?? errData;
          if (typeof payload === "string") {
            detail = payload;
          } else if (payload && typeof payload === "object") {
            const message =
              typeof payload.message === "string" ? payload.message : detail;
            const remaining = Number(payload.remaining_attempts);
            if (Number.isFinite(remaining)) {
              if (remaining > 0) {
                detail = `${message} Intentos restantes: ${remaining}.`;
              } else {
                detail = message;
              }
            } else {
              detail = message;
            }
          }
        } catch {
          // ignore parse errors
        }
        return { success: false, error: detail };
      }

      const data = await response.json();
      const newUser = buildUserFromBackend(data.user);
      localStorage.setItem("sgd_token", data.access_token);
      localStorage.setItem("sgd_user", JSON.stringify(newUser));
      setUser(newUser);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: "Tiempo de espera agotado. Intente nuevamente.",
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error inesperado de conexion",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // no-op
    }
    setUser(null);
    localStorage.removeItem("sgd_token");
    localStorage.removeItem("sgd_user");
    window.location.replace("/login?logout=1");
  };

  const switchRole = async (newRole: UserRole): Promise<boolean> => {
    if (!roleSimulationEnabled) return false;
    if (!user) return false;
    if (user.role !== "Desarrollador") return false;

    let newNombre = user.nombre;
    let newApellido = user.apellido;

    if (newRole === "CEO") {
      newNombre = "Director";
      newApellido = "Ejecutivo";
    } else if (newRole === "Administrativo") {
      newNombre = "Administrador";
      newApellido = "General";
    } else if (newRole === "Gerente") {
      newNombre = "Gerente";
      newApellido = "Principal";
    } else if (newRole === "Usuario") {
      newNombre = "Operador";
      newApellido = "Estandar";
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
    logout,
    setUser,
    switchRole,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
