"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Home,
  BarChart2,
  Users,
  Settings,
  Bell,
  Search,
  ChevronRight,
  Activity,
  Server,
  Shield,
  Zap,
  LogOut,
  AlertTriangle,
  Filter,
  Sun,
  Moon,
  Building2,
  Briefcase,
  Factory,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Clock,
  TrendingUp,
  UsersRound,
  Flag,
  Tag,
  FileText,
  Printer,
  CheckCircle,
  AlertCircle,
  File,
  FileCheck,
  Check,
  X,
  AlertOctagon,
  Eye,
  Mail,
  Globe,
  Sparkles,
  Inbox,
  Send,
} from "lucide-react";

// OK: Importa los componentes del bot al inicio
import BotButton from "../../components/BotButton";
import ChatWindow from "../../components/ChatWindow";
import TicketSystem, { Ticket } from "../../components/TicketSystem";
import MasterPermissionPanel from "../../components/MasterPermissionPanel";
import { logDocumentActivity } from "./security/actions";
import { useAuth } from "../../hooks/useAuth";
import { UserRole, User } from "../../context/AuthContext";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useIdleTimer } from "../../hooks/useIdleTimer";
import { DepartmentGrid } from "./components/DepartmentGrid";
import { DepartmentDetailView } from "./components/DepartmentDetailView";
import { OrgCategory, Document } from "./types";
import { RoleGuard } from "../../components/RoleGuard";
import { PERMISSIONS_MASTER } from "../../permissions/constants";
import {
  getDocumentos,
  uploadDocumento,
  updateDocumentStatus as apiUpdateStatus,
  getAllUsers,
  getGerencias,
  getTickets,
  markAsRead,
  getAnnouncement,
  getOrgStructure,
  getOrgManagementDetails,
  saveOrgStructure,
  saveOrgManagementDetails,
} from "../../lib/api";
import { ApiDocument, ApiUser } from "../../lib/api";
import { uiAlert, uiConfirm } from "../../lib/ui-dialog";
const ResponsiveContainerCompat =
  ResponsiveContainer as unknown as React.ComponentType<any>;
const PieChartCompat = PieChart as unknown as React.ComponentType<any>;
const PieCompat = Pie as unknown as React.ComponentType<any>;
const CellCompat = Cell as unknown as React.ComponentType<any>;
const TooltipCompat = Tooltip as unknown as React.ComponentType<any>;
const LegendCompat = Legend as unknown as React.ComponentType<any>;

// ==========================================
// TIPOS Y INTERFACES
// ==========================================

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  darkMode: boolean;
  onClick?: () => void;
}
interface DeptCardProps {
  group: OrgCategory;
  darkMode: boolean;
  onToggle?: () => void;
  onItemClick?: (item: string) => void;
}
interface AuditAlert {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  date: string;
}
interface PriorityItem {
  id: number;
  title: string;
  description: string;
  priority: "alta" | "media" | "baja";
  responsible: string;
  deadline: string;
  status: "pendiente" | "en-progreso" | "completado";
}

interface AnnouncementData {
  badge: string;
  title: string;
  description: string;
  status: string;
  urgency: string;
  color?: string;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

function normalizeHexColor(value?: string, fallback = "#dc2626"): string {
  const candidate = String(value || "").trim();
  return HEX_COLOR_RE.test(candidate) ? candidate : fallback;
}

function shiftHexColor(hex: string, amount: number): string {
  const clean = normalizeHexColor(hex).slice(1);
  const num = Number.parseInt(clean, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const nextR = clamp(r + amount);
  const nextG = clamp(g + amount);
  const nextB = clamp(b + amount);
  return `#${nextR.toString(16).padStart(2, "0")}${nextG.toString(16).padStart(2, "0")}${nextB.toString(16).padStart(2, "0")}`;
}

// ==========================================
// DATA MOCKS
// ==========================================
// Mapping icons for serialization support
const ORG_ICONS: Record<string, React.ElementType> = {
  Shield,
  Briefcase,
  Zap,
  Users,
  Factory,
};

const DEFAULT_ORG_STRUCTURE: OrgCategory[] = [
  {
    category: "I. Alta Dirección y Control",
    icon: "Shield",
    items: [
      "Gerencia General",
      "Auditoría Interna",
      "Consultoría Jurídica",
      "Gerencia Nacional de Planificación y Presupuesto",
    ],
  },
  {
    category: "II. Gestión Administrativa",
    icon: "Briefcase",
    items: [
      "Gerencia Nacional de Administración",
      "Gerencia Nacional de Gestión Humana",
      "Gerencia Nacional de Tecnologías de la Información y la Comunicación",
      "Gerencia Nacional de Tecnologías de Proyectos",
    ],
  },
  {
    category: "III. Gestión Operativa y ASHO",
    icon: "Zap",
    items: [
      "Gerencia Nacional de Adecuaciones y Mejoras",
      "Gerencia Nacional de Asho",
      "Gerencia Nacional de Atención al Ciudadano",
      "Gerencia de Comercialización",
    ],
  },
  {
    category: "IV. Energía y Comunidad",
    icon: "Users",
    items: [
      "Gerencia Nacional de Energía Alternativa y Eficiencia Energética",
      "Gerencia Nacional de Gestión Comunal",
    ],
  },
  {
    category: "V. Filiales y Unidades",
    icon: "Factory",
    items: ["Unerven", "Vietven"],
  },
];

const MANAGEMENT_DETAILS: Record<string, string[]> = {
  "Gerencia General": [
    "Definición de políticas institucionales.",
    "Supervisión de Gerencias operativas y administrativas.",
    "Representación legal de la institución.",
    "Aprobación de presupuesto anual.",
    "Coordinación de relaciones interinstitucionales.",
  ],
  "Auditoría Interna": [
    "Evaluación de controles internos.",
    "Auditoría de procesos financieros y administrativos.",
    "Verificación del cumplimiento normativo.",
    "Investigación de irregularidades.",
    "Elaboración de informes de gestión de riesgos.",
  ],
  "Consultoría Jurídica": [
    "Asesoría legal a la presidencia y Gerencias.",
    "Revisión y redacción de contratos y convenios.",
    "Defensa judicial y extrajudicial de la institución.",
    "Emitir dictámenes jurídicos vinculantes.",
  ],
  "Gerencia Nacional de Planificación y Presupuesto": [
    "Formulación del Plan Operativo Anual (POA).",
    "Control y seguimiento de la ejecución presupuestaria.",
    "Evaluación de indicadores de gestión.",
    "Proyección de escenarios financieros a mediano plazo.",
  ],
  "Gerencia Nacional de Administración": [
    "Gestión de recursos financieros y tesorería.",
    "Administración de servicios generales.",
    "Procesamiento de pagos a proveedores.",
    "Contabilización de operaciones financieras.",
  ],
  "Gerencia Nacional de Gestión Humana": [
    "Reclutamiento y selección de personal.",
    "Gestión de nómina y beneficios laborales.",
    "Planificación de capacitación y desarrollo.",
    "Evaluación del desempeño del personal.",
  ],
  "Gerencia Nacional de Tecnologías de la Información y la Comunicación": [
    "Mantenimiento de infraestructura tecnológica.",
    "Desarrollo y soporte de sistemas de información.",
    "Garantizar la seguridad de la información.",
    "Soporte técnico a usuarios finales.",
  ],
  "Gestión Directa": [
    "Acceso a la terminal de comandos del servidor.",
    "Monitoreo de procesos en tiempo real.",
    "Ajuste de variables de entorno críticas.",
    "Gestión de certificados SSL y seguridad perimetral.",
  ],
  "Logs de Auditoría": [
    "Consulta de trazas de base de datos a bajo nivel.",
    "Historial completo de intentos de intrusión.",
    "Seguimiento de cambios en esquemas de permisos.",
    "Exportación de logs en formato raw JSON/CSV.",
  ],
};

const getDefaultFunctions = (name: string) => [
  `Gestión operativa de ${name}.`,
  "Coordinación de personal asignado.",
  "Reporte de indicadores de gestión.",
  "Cumplimiento de metas trimestrales asignadas.",
  "Seguimiento de planes de mejora continua.",
];

const PLANT_METRICS = [
  {
    name: "Planta Luis Zambrano",
    availability: 95,
    trend: "+2%",
    status: "optimal",
  },
  {
    name: "Planta Metrocontadores",
    availability: 88,
    trend: "-1%",
    status: "warning",
  },
  { name: "Planta Tanques", availability: 92, trend: "+5%", status: "optimal" },
  { name: "Centro Textil", availability: 85, trend: "-3%", status: "warning" },
  { name: "UNERVEN", availability: 90, trend: "+1%", status: "optimal" },
  { name: "VIETVEN", availability: 87, trend: "+4%", status: "optimal" },
];

const AUDIT_ALERTS: AuditAlert[] = [
  {
    title: "Revisión Jurídica Pendiente",
    description: "Gerencia General requiere firma de documentos legales",
    priority: "high",
    date: "Hoy",
  },
  {
    title: "Mantenimiento Preventivo",
    description: "Planta Tanques entra en ciclo de revisión programada",
    priority: "medium",
    date: "Mañana",
  },
  {
    title: "Actualización de Protocolos",
    description: "Departamento TIC necesita aprobación de nuevos estándares",
    priority: "low",
    date: "En 3 días",
  },
];

// NUEVOS DATOS PARA MÓDULOS
const PRIORITY_MATRIX: PriorityItem[] = [];

// Tickets data moved to TicketSystem component

const INITIAL_DOCUMENTS: Document[] = [];

// NUEVOS DATOS PARA MÓDULO DE SEGURIDAD
const ACCOUNT_REQUESTS = [
  {
    id: 1,
    name: "Pedro Alcantara",
    email: "p.alcantara@corpoelec.gob.ve",
    department: "Sistemas",
    date: "04/02/2026",
    status: "pendiente",
  },
  {
    id: 2,
    name: "Maria Gonzalez",
    email: "m.gonzalez@corpoelec.gob.ve",
    department: "Admin",
    date: "03/02/2026",
    status: "pendiente",
  },
];

const USER_PERMISSIONS = [
  {
    id: 101,
    user: "JPEREZ (Admin)",
    role: "Administrador Global",
    access: ["Todo"],
    lastActive: "Ahora",
  },
  {
    id: 102,
    user: "MARODRIGUEZ (Gerente)",
    role: "Gerente Planta",
    access: ["Reportes", "Personal"],
    lastActive: "Hace 10 min",
  },
  {
    id: 103,
    user: "CSANCHEZ (Soporte)",
    role: "Técnico Nivel 2",
    access: ["Tickets", "Sistemas"],
    lastActive: "Hace 1h",
  },
];

const SECURITY_LOGS = [
  {
    id: 1,
    event: "Inicio de Sesión Exitoso",
    user: "JPEREZ",
    ip: "192.168.1.10",
    time: "10:23 AM",
  },
  {
    id: 2,
    event: "Cambio de Permisos",
    user: "SYSTEM",
    ip: "LOCALHOST",
    time: "09:45 AM",
  },
  {
    id: 3,
    event: "Intento Fallido de Acceso",
    user: "UNKNOWN",
    ip: "192.168.1.45",
    time: "08:12 AM",
  },
];

const MANAGEMENT_DETAILS_STORAGE_KEY = "management_details_custom_2026";

// ==========================================
// COMPONENTES REUTILIZABLES (CORPORATE STYLE)
// ==========================================
const ThemeToggle: React.FC<{ darkMode: boolean; onToggle: () => void }> = ({
  darkMode,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    className={`
      p-2 rounded-md transition-colors border
      ${darkMode
        ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
        : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      }
    `}
  >
    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
  </button>
);

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  active,
  collapsed,
  darkMode,
  onClick,
}) => (
  <div
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    }}
    role="button"
    tabIndex={0}
    aria-label={label}
    className={`
      group glass-hover flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-200
      ${active
        ? darkMode
          ? "bg-red-900/50 text-white shadow-sm border border-red-800/50"
          : "bg-red-700 text-white shadow-sm"
        : darkMode
          ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }
    `}
  >
    <Icon size={18} className={`${active ? "text-white" : ""}`} />
    {!collapsed && (
      <span className="font-medium text-sm tracking-tight">{label}</span>
    )}
  </div>
);

const DeptCard: React.FC<DeptCardProps> = ({
  group,
  darkMode,
  onToggle,
  onItemClick,
}) => {
  const [expanded, setExpanded] = useState(true);
  const toggleExpand = () => {
    setExpanded(!expanded);
    onToggle?.();
  };

  return (
    <div
      className={`
      remaster-card remaster-lift rounded-lg border transition-all duration-200
      ${darkMode
          ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
          : "bg-white border-slate-200 hover:border-slate-300"
        }
    `}
    >
      <div
        onClick={toggleExpand}
        className={`
          p-3 border-b cursor-pointer flex items-center justify-between transition-colors
          ${darkMode ? "border-zinc-800 hover:bg-zinc-800/50" : "border-slate-100 hover:bg-slate-50"}
        `}
      >
        <div className="flex items-center gap-2">
          {(() => {
            const IconComp = ORG_ICONS[group.icon] || Shield;
            return (
              <IconComp
                size={16}
                className={darkMode ? "text-slate-400" : "text-slate-500"}
              />
            );
          })()}
          <h3
            className={`font-semibold text-xs uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-slate-700"}`}
          >
            {group.category}
          </h3>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
      </div>
      {expanded && (
        <div className="p-2 space-y-1">
          {group.items.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onItemClick?.(item)}
              className={`
                flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-xs cursor-pointer
                ${darkMode
                  ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
              `}
            >
              <div
                className={`w-1 h-1 rounded-full ${darkMode ? "bg-red-800" : "bg-red-600"}`}
              />
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  functions: string[];
  darkMode: boolean;
  canEdit: boolean;
  onSave: (title: string, nextFunctions: string[]) => void;
}> = ({ isOpen, onClose, title, functions, darkMode, canEdit, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftFunctions, setDraftFunctions] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setIsEditing(false);
    setDraftFunctions((functions || []).join("\n"));
  }, [isOpen, title, functions]);

  if (!isOpen) return null;

  const saveChanges = () => {
    const next = draftFunctions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (next.length === 0) {
      void uiAlert("Debe existir al menos una función para guardar.", "Validacion");
      return;
    }
    onSave(title, next);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`
          remaster-card w-full max-w-md rounded-lg shadow-xl transform transition-all scale-100
          ${darkMode ? "bg-zinc-900 border border-zinc-700" : "bg-white"}
        `}
      >
        <div
          className={`flex items-center justify-between p-4 border-b ${darkMode ? "border-zinc-800" : "border-slate-100"}`}
        >
          <h3
            className={`font-bold text-lg ${darkMode ? "text-white" : "text-slate-900"}`}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors ${darkMode ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-slate-100 text-slate-500"}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <h4
            className={`text-xs font-bold uppercase tracking-wider mb-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`}
          >
            Funciones Operativas
          </h4>
          {isEditing ? (
            <div className="space-y-2">
              <p className={`text-[11px] ${darkMode ? "text-slate-500" : "text-slate-500"}`}>
                Una función por línea.
              </p>
              <textarea
                value={draftFunctions}
                onChange={(e) => setDraftFunctions(e.target.value)}
                rows={10}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? "bg-zinc-950 border-zinc-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"}`}
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {functions.map((func, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${darkMode ? "bg-red-500" : "bg-red-600"}`}
                  />
                  <span
                    className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}
                  >
                    {func}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={`p-4 border-t flex justify-end gap-2 ${darkMode ? "border-zinc-800" : "border-slate-100"}`}
        >
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${darkMode
                ? "bg-blue-700/70 text-white hover:bg-blue-600"
                : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            >
              Editar
            </button>
          )}
          {canEdit && isEditing && (
            <button
              onClick={saveChanges}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${darkMode
                ? "bg-emerald-700/80 text-white hover:bg-emerald-600"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
            >
              Guardar cambios
            </button>
          )}
          <button
            onClick={() => {
              setIsEditing(false);
              onClose();
            }}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${darkMode
                ? "bg-zinc-800 text-white hover:bg-zinc-700"
                : "bg-slate-100 text-slate-900 hover:bg-slate-200"
              }
            `}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  darkMode: boolean;
  trend?: string;
  trendPositive?: boolean;
}> = ({
  title,
  value,
  subtext,
  icon: Icon,
  darkMode,
  trend,
  trendPositive,
}) => (
    <div
      className={`
    remaster-card remaster-lift p-5 rounded-lg border flex flex-col justify-between h-full
    ${darkMode
          ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
          : "bg-white border-slate-200 hover:border-slate-300"
        }
  `}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-500" : "text-slate-500"}`}
        >
          {title}
        </span>
        <Icon
          size={18}
          className={darkMode ? "text-slate-600" : "text-slate-400"}
        />
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}
        >
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendPositive
              ? darkMode
                ? "bg-emerald-900/30 text-emerald-400"
                : "bg-emerald-50 text-emerald-700"
              : darkMode
                ? "bg-red-900/30 text-red-400"
                : "bg-red-50 text-red-700"
              }`}
          >
            {trend}
          </span>
        )}
      </div>
      <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}>
        {subtext}
      </p>
    </div>
  );

const AlertCard: React.FC<{
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  date: string;
  darkMode: boolean;
}> = ({ title, description, priority, date, darkMode }) => {
  const getStyles = () => {
    switch (priority) {
      case "high":
        return { borderL: "border-l-red-600", text: "text-red-600", bg: "" };
      case "medium":
        return {
          borderL: "border-l-amber-500",
          text: "text-amber-600",
          bg: "",
        };
      default:
        return { borderL: "border-l-blue-500", text: "text-blue-600", bg: "" };
    }
  };

  const s = getStyles();

  return (
    <div
      className={`
      pl-3 py-2 border-l-4 rounded-r-md transition-colors
      ${s.borderL}
      ${darkMode ? "bg-slate-800/30 hover:bg-slate-800/50" : "bg-slate-50 hover:bg-slate-100"}
    `}
    >
      <div className="flex justify-between items-start">
        <div>
          <span
            className={`text-xs font-bold uppercase ${s.text} block mb-0.5`}
          >
            {title}
          </span>
          <p
            className={`text-sm leading-tight ${darkMode ? "text-slate-300" : "text-slate-700"}`}
          >
            {description}
          </p>
        </div>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${darkMode ? "bg-slate-800 text-slate-500" : "bg-white text-slate-500 border border-slate-200"}`}
        >
          {date}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// NUEVOS COMPONENTES MODULARES
// ==========================================
const PriorityMatrix: React.FC<{
  darkMode: boolean;
  userRole: UserRole;
  isReadOnly?: boolean;
  documents: Document[];
  hasPermission: (permission: string) => boolean;
  refreshDocs: () => void | Promise<void>;
}> = ({ darkMode, userRole, isReadOnly, documents, hasPermission, refreshDocs }) => {
  const [trackingSearch, setTrackingSearch] = useState("");
  const [trackingStatus, setTrackingStatus] = useState<string>("all");
  const [trackingSender, setTrackingSender] = useState<string>("all");
  const [selectedTrackingDoc, setSelectedTrackingDoc] = useState<any | null>(null);
  const [updatingTrackingStatus, setUpdatingTrackingStatus] = useState(false);

  const getStatusColor = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    switch (normalized) {
      case "vencido":
        return darkMode
          ? "bg-red-500/10 text-red-400"
          : "bg-red-50 text-red-700";
      case "finalizado":
        return darkMode
          ? "bg-green-500/10 text-green-400"
          : "bg-green-50 text-green-700";
      case "en-proceso":
      case "en proceso":
        return darkMode
          ? "bg-amber-500/10 text-amber-400"
          : "bg-amber-50 text-amber-700";
      default:
        return darkMode
          ? "bg-slate-800 text-slate-400"
          : "bg-slate-100 text-slate-600";
    }
  };

  const parseDate = (value: string) => {
    if (!value) return 0;
    const normalized = value.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
      const [dd, mm, yyyy] = normalized.split("/");
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).getTime();
    }
    const ts = Date.parse(normalized);
    return Number.isNaN(ts) ? 0 : ts;
  };

  const parseFlexibleDate = (value: string) => {
    if (!value || value === "N/A") return null;
    const normalized = String(value).trim();
    // Interpretar fechas latinas: dd/mm/yyyy o d/m/yyyy (con hora opcional)
    const latinMatch = normalized.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (latinMatch) {
      const [, ddRaw, mmRaw, yyyy, hh = "00", min = "00", sec = "00"] = latinMatch;
      const dd = ddRaw.padStart(2, "0");
      const mm = mmRaw.padStart(2, "0");
      const d = new Date(`${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${min}:${sec}`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getTrackingStatus = useCallback(
    (item: { rawStatus?: string; deadlineRaw?: string; fechaMaximaEntrega?: string }) => {
      const raw = String(item.rawStatus || "").toLowerCase().trim();
      const deadline =
        parseFlexibleDate(item.deadlineRaw || "") ||
        parseFlexibleDate(item.fechaMaximaEntrega || "");
      // Regla: si ya venció, prevalece estado VENCIDO.
      if (deadline && Date.now() > deadline.getTime()) return "vencido";
      if (raw === "finalizado") return "finalizado";
      return "en-proceso";
    },
    [],
  );

  const handleMarkFinalized = useCallback(
    async (docId: number) => {
      try {
        setUpdatingTrackingStatus(true);
        await apiUpdateStatus(docId, "finalizado");
        setSelectedTrackingDoc((prev: any) =>
          prev && prev.id === docId
            ? { ...prev, rawStatus: "finalizado", status: "finalizado" }
            : prev,
        );
        await refreshDocs();
        void uiAlert("Documento marcado como FINALIZADO.", "Estado actualizado");
      } catch (error) {
        console.error("Error al marcar documento como finalizado:", error);
        void uiAlert("No se pudo actualizar el estado a FINALIZADO.", "Error");
      } finally {
        setUpdatingTrackingStatus(false);
      }
    },
    [refreshDocs],
  );

  const DeadlineClock = ({
    sentDate,
    deadlineDate,
    status,
  }: {
    sentDate: string;
    deadlineDate: string;
    status: "en-proceso" | "vencido" | "finalizado";
  }) => {
    const sent = parseFlexibleDate(sentDate);
    const deadline = parseFlexibleDate(deadlineDate);
    const now = Date.now();
    const deadlineMs = deadline?.getTime() ?? null;

    const full = sent && deadline ? deadline.getTime() - sent.getTime() : 0;
    const elapsed = sent ? Math.max(0, now - sent.getTime()) : 0;
    const progress =
      full > 0 ? Math.min(1, Math.max(0, elapsed / full)) : 0;
    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - progress);

    const remainingMs = deadlineMs !== null ? deadlineMs - now : null;
    const isFinalized = status === "finalizado";
    const isOverdue = status === "vencido" || (remainingMs !== null && remainingMs <= 0);
    const isCritical =
      status === "en-proceso" &&
      remainingMs !== null &&
      remainingMs > 0 &&
      remainingMs <= 6 * 60 * 60 * 1000;
    const isNearDue =
      status === "en-proceso" &&
      deadlineMs !== null &&
      !isOverdue &&
      !isCritical &&
      remainingMs !== null &&
      remainingMs <= 24 * 60 * 60 * 1000;

    const remainingDays =
      deadlineMs !== null && !isOverdue
        ? Math.max(
          0,
          Math.ceil((deadlineMs - now) / (24 * 60 * 60 * 1000)),
        )
        : 0;
    const remainingHours =
      remainingMs !== null && remainingMs > 0
        ? Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)))
        : 0;

    const ringColor = isFinalized
      ? "#22c55e"
      : isOverdue || isCritical
      ? "#ef4444"
      : isNearDue
        ? "#3b82f6"
        : "#22c55e";
    const daysOrHours =
      status === "en-proceso"
        ? isCritical
          ? `${remainingHours}h`
          : `${remainingDays}d`
        : "";
    const textClass = darkMode ? "text-slate-200" : "text-slate-700";

    return (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke={darkMode ? "#334155" : "#cbd5e1"}
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke={ringColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 20 20)"
          />
          <circle cx="20" cy="20" r="1.8" fill={ringColor} />
          <g>
            <line x1="20" y1="20" x2="20" y2="9" stroke={ringColor} strokeWidth="1.8" strokeLinecap="round" />
            {status === "en-proceso" && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 20 20"
                to="360 20 20"
                dur="8s"
                repeatCount="indefinite"
              />
            )}
          </g>
          <line x1="20" y1="20" x2="27" y2="20" stroke={ringColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        </svg>
        {daysOrHours ? (
          <span className={`text-[11px] font-semibold ${textClass}`}>{daysOrHours}</span>
        ) : null}
      </div>
    );
  };

  const mappedTracking = useMemo(() => {
    const controlDocs = documents.filter(
      (doc) => String(doc.prioridad || "").toLowerCase() === "control",
    );
    return controlDocs.map((doc) => ({
      id: doc.id,
      title: doc.name,
      correlativo: doc.correlativo || doc.idDoc || `DOC-${doc.id}`,
      sentBy: doc.uploadedBy || "Desconocido",
      receivedBy: doc.receivedBy || doc.targetDepartment || "Sin Asignar",
      fechaEnvio: doc.uploadDate || "N/A",
      fechaMaximaEntrega: doc.fecha_caducidad
        ? (() => {
          const d = new Date(doc.fecha_caducidad);
          return Number.isNaN(d.getTime()) ? String(doc.fecha_caducidad) : d.toLocaleDateString("es-ES");
        })()
        : "N/A",
      deadlineRaw: doc.fecha_caducidad || "",
      rawStatus: String(doc.signatureStatus || "en-proceso").toLowerCase(),
      status: String(doc.signatureStatus || "en-proceso").toLowerCase(),
      contenido: doc.contenido || "",
      fileUrl: doc.fileUrl,
      archivos: doc.archivos || [],
    }));
  }, [documents]);

  const senderOptions = useMemo(
    () =>
      Array.from(new Set(mappedTracking.map((item) => item.sentBy)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [mappedTracking],
  );

  const filteredTracking = useMemo(() => {
    const normalizedSearch = trackingSearch.trim().toLowerCase();
    return mappedTracking
      .filter((item) => {
        const computedStatus = getTrackingStatus(item);
        const matchesStatus = trackingStatus === "all" || computedStatus === trackingStatus;
        const matchesSender = trackingSender === "all" || item.sentBy === trackingSender;
        const haystack = `${item.title} ${item.correlativo} ${item.sentBy} ${item.receivedBy}`.toLowerCase();
        const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
        return matchesStatus && matchesSender && matchesSearch;
      })
      .sort((a, b) => parseDate(b.fechaEnvio) - parseDate(a.fechaEnvio));
  }, [mappedTracking, trackingSearch, trackingStatus, trackingSender, getTrackingStatus]);

  return (
    <div className="space-y-4 pt-2">
      <div
        className={`p-4 rounded-lg border flex flex-wrap gap-3 items-end ${darkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}
      >
        <div className="min-w-[220px] flex-1">
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
            Buscar
          </label>
          <div
            className={`flex items-center px-3 py-2 rounded-md border ${darkMode ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`}
          >
            <Search size={14} className="text-slate-500 mr-2" />
            <input
              value={trackingSearch}
              onChange={(e) => setTrackingSearch(e.target.value)}
              placeholder="Correlativo, documento, remitente..."
              className="bg-transparent border-none outline-none text-sm w-full"
            />
          </div>
        </div>
        <div className="w-56">
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
            Estado
          </label>
          <select
            value={trackingStatus}
            onChange={(e) => setTrackingStatus(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border text-sm outline-none ${darkMode ? "bg-slate-950 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`}
          >
            <option value="all">Todos</option>
            <option value="vencido">Vencido</option>
            <option value="en-proceso">En Proceso</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>
        <div className="w-64">
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
            Enviado por
          </label>
          <select
            value={trackingSender}
            onChange={(e) => setTrackingSender(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border text-sm outline-none ${darkMode ? "bg-slate-950 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`}
          >
            <option value="all">Todos</option>
            {senderOptions.map((sender) => (
              <option key={sender} value={sender}>
                {sender}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hasPermission(PERMISSIONS_MASTER.PRIORITIES_EXPORT) && (
        <div className="flex justify-end mb-2">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${darkMode
              ? "border-slate-700 text-slate-300 hover:bg-slate-800"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
          >
            <Download size={16} className="inline mr-2" />
            Exportar
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          className={`w-full rounded-lg overflow-hidden ${darkMode
            ? "bg-slate-900 border border-slate-800"
            : "bg-white border border-slate-200"
            }`}
        >
          <thead className={`${darkMode ? "bg-slate-800" : "bg-slate-50"}`}>
            <tr>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Nombre de Documento
              </th>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Correlativo
              </th>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Enviado por
              </th>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Recibido por
              </th>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Fecha de envio
              </th>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Fecha maxima de entrega
              </th>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Tiempo limite
              </th>
              <th
                className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Estado
              </th>
              <th
                className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Vista
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTracking.map((item) => {
              const computedStatus = getTrackingStatus(item);
              const statusLabel =
                computedStatus === "en-proceso"
                  ? "EN PROCESO"
                  : computedStatus === "vencido"
                    ? "VENCIDO"
                    : "FINALIZADO";
              return (
              <tr
                key={item.id}
                className={`border-t transition-colors ${darkMode
                  ? "border-slate-800 hover:bg-slate-800/50"
                  : "border-slate-200 hover:bg-slate-50"
                  }`}
              >
                <td
                  className={`px-4 py-3 ${darkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  <div className="font-medium">{item.title}</div>
                </td>
                <td
                  className={`px-4 py-3 ${darkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  <span className="font-mono text-xs">{item.correlativo}</span>
                </td>
                <td
                  className={`px-4 py-3 ${darkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  {item.sentBy}
                </td>
                <td
                  className={`px-4 py-3 ${darkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  {item.receivedBy}
                </td>
                <td
                  className={`px-4 py-3 ${darkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  {item.fechaEnvio}
                </td>
                <td
                  className={`px-4 py-3 ${darkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  {item.fechaMaximaEntrega}
                </td>
                <td className={`px-4 py-3 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                  <DeadlineClock
                    sentDate={item.fechaEnvio}
                    deadlineDate={item.fechaMaximaEntrega}
                    status={computedStatus as "en-proceso" | "vencido" | "finalizado"}
                  />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(
                      computedStatus,
                    )}`}
                  >
                    {statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setSelectedTrackingDoc(item)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border ${darkMode
                      ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <Eye size={13} />
                    Ver
                  </button>
                </td>
              </tr>
            );
            })}
            {filteredTracking.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500 italic">
                  No hay documentos para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTrackingDoc && (
        (() => {
          const modalComputedStatus = getTrackingStatus(selectedTrackingDoc);
          const modalStatusLabel =
            modalComputedStatus === "en-proceso"
              ? "EN PROCESO"
              : modalComputedStatus === "vencido"
                ? "VENCIDO"
                : "FINALIZADO";
          return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className={`w-full max-w-2xl rounded-xl border shadow-2xl ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
            <div className={`p-4 border-b flex items-center justify-between ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
              <div>
                <h3 className={`font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{selectedTrackingDoc.title}</h3>
                <p className="text-xs text-slate-500 mt-1">Correlativo: {selectedTrackingDoc.correlativo}</p>
              </div>
              <button
                onClick={() => setSelectedTrackingDoc(null)}
                className={`p-2 rounded-md ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-600"}`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className={darkMode ? "text-slate-300" : "text-slate-700"}>
                  <span className="font-semibold">Enviado por:</span> {selectedTrackingDoc.sentBy}
                </div>
                <div className={darkMode ? "text-slate-300" : "text-slate-700"}>
                  <span className="font-semibold">Recibido por:</span> {selectedTrackingDoc.receivedBy}
                </div>
                <div className={darkMode ? "text-slate-300" : "text-slate-700"}>
                  <span className="font-semibold">Fecha de envio:</span> {selectedTrackingDoc.fechaEnvio}
                </div>
                <div className={darkMode ? "text-slate-300" : "text-slate-700"}>
                  <span className="font-semibold">Fecha maxima de entrega:</span> {selectedTrackingDoc.fechaMaximaEntrega}
                </div>
                <div className={darkMode ? "text-slate-300" : "text-slate-700"}>
                  <span className="font-semibold">Estado:</span>{" "}
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${getStatusColor(modalComputedStatus)}`}>
                    {modalStatusLabel}
                  </span>
                </div>
              </div>

              {selectedTrackingDoc.contenido ? (
                <div className={`rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap ${darkMode ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  {selectedTrackingDoc.contenido}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Sin contenido de mensaje en texto.</p>
              )}

              <div className="flex flex-wrap gap-2">
                {modalComputedStatus === "en-proceso" && (
                  <button
                    onClick={() => void handleMarkFinalized(selectedTrackingDoc.id)}
                    disabled={updatingTrackingStatus}
                    className={`px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${darkMode
                      ? "border-green-700 text-green-300 hover:bg-green-900/20 disabled:opacity-50"
                      : "border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"}`}
                  >
                    {updatingTrackingStatus ? "Guardando..." : "FINALIZADO"}
                  </button>
                )}
                {selectedTrackingDoc.fileUrl && (
                  <a
                    href={selectedTrackingDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-2 rounded-md text-sm font-semibold border ${darkMode ? "border-blue-700 text-blue-300 hover:bg-blue-900/20" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}
                  >
                    Ver archivo principal
                  </a>
                )}
                {(selectedTrackingDoc.archivos || []).map((file: string, idx: number) => (
                  <a
                    key={`${file}-${idx}`}
                    href={file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-2 rounded-md text-sm font-semibold border ${darkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                  >
                    Adjunto {idx + 1}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
        })()
      )}
    </div>
  );
};

// Kanban Ticket System logic integrated from ../../components/TicketSystem

const DocumentManager: React.FC<{
  darkMode: boolean;
  userRole: UserRole;
  userDept: string;
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  orgStructure: OrgCategory[];
  isReadOnly?: boolean;
  hasPermission: (permission: string) => boolean;
  user: User | null;
  users: any[];
  gerencias: any[];
  refreshDocs: () => void;
}> = ({
  darkMode,
  userRole,
  userDept,
  documents,
  setDocuments,
  orgStructure,
  isReadOnly,
  hasPermission,
  user,
  users,
  gerencias,
  refreshDocs,
}) => {
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterDept, setFilterDept] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [docView, setDocView] = useState<"inbox" | "sent" | "audit">("inbox");
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [docName, setDocName] = useState("");
    const [docCategory, setDocCategory] = useState("Informe");
    const [correlativo, setCorrelativo] = useState("");
    const [priorityEnabled, setPriorityEnabled] = useState(false);
    const [priorityDays, setPriorityDays] = useState<number>(3);
    const now = useMemo(() => new Date(), []);
    const fechaEnvioPreview = useMemo(() => {
      return now.toLocaleDateString("es-ES");
    }, [now]);
    const fechaMaximaEntregaPreview = useMemo(() => {
      if (!priorityEnabled || priorityDays <= 0) return "No aplica";
      const due = new Date(now);
      due.setDate(due.getDate() + priorityDays);
      return due.toLocaleDateString("es-ES");
    }, [now, priorityEnabled, priorityDays]);

    // Messaging Specific States
    const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
    const [targetDeptIds, setTargetDeptIds] = useState<string[]>([]);
    const [sendMode, setSendMode] = useState<"user" | "dept">("user");
    const [messageContent, setMessageContent] = useState("");
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const canAccessSecurityModule =
      hasPermission(PERMISSIONS_MASTER.VIEW_SECURITY) ||
      userRole === "Administrativo" ||
      userRole === "Desarrollador";
    const isManager = userRole === "Gerente";
    const isPrivilegedAuditRole =
      userRole === "Desarrollador" ||
      userRole === "Administrativo" ||
      userRole === "CEO";
    const canUseAuditView = isManager || isPrivilegedAuditRole;

    // Extract unique departments for filter
    const departments = useMemo(() => {
      return orgStructure.flatMap((group) => group.items);
    }, [orgStructure]);

    const messagingDeptOptions = useMemo(() => {
      const byId = new Map<string, { id: string; nombre: string }>();
      gerencias.forEach((g) => {
        const name = String(g?.nombre || "").trim();
        const id = g?.id !== undefined && g?.id !== null ? String(g.id) : "";
        if (!name || !id) return;
        byId.set(id, { id, nombre: name });
      });
      return Array.from(byId.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [gerencias]);

    const messagingUserOptions = useMemo(() => {
      const byId = new Map<string, { id: string; label: string }>();
      users.forEach((u) => {
        const id = u?.id !== undefined && u?.id !== null ? String(u.id) : "";
        const label = `${u?.nombre || ""} ${u?.apellido || ""}`.trim();
        if (!id || !label) return;
        if (!byId.has(id)) {
          byId.set(id, { id, label });
        }
      });
      return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [users]);

    const correlativoPreview = useMemo(() => {
      const raw = (user?.gerencia_depto || userDept || "").trim();
      const siglas = raw
        ? raw
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 6)
        : "GER";
      const year = new Date().getFullYear();
      const manual = correlativo.trim() || "___";
      return `${siglas}-${manual}-${year}`;
    }, [correlativo, user?.gerencia_depto, userDept]);

    useEffect(() => {
      if (docView !== "sent" && filterStatus === "recibido") {
        setFilterStatus("all");
      }
      if (docView === "sent" && filterStatus === "leido") {
        setFilterStatus("all");
      }
    }, [docView, filterStatus]);

    useEffect(() => {
      setTargetUserIds([]);
      setTargetDeptIds([]);
    }, [sendMode]);

    const normalizeMessagingStatus = useCallback((doc: Document, view: "inbox" | "sent" | "audit"): string => {
      const raw = String(doc.signatureStatus || "").toLowerCase().trim();

      if (view !== "sent" && doc.leido) return "leido";
      if (view === "sent" && doc.leido) return "recibido";

      if (raw === "en-proceso" || raw === "en proceso" || raw === "en_proceso") return "en-proceso";
      if (raw === "recibido") return "recibido";
      if (raw === "leido" || raw === "Leído") return "leido";
      if (raw === "pendiente" || raw === "aprobado" || raw === "rechazado" || raw === "omitido") return "en-proceso";

      return "en-proceso";
    }, []);

    const docViewLabel =
      docView === "inbox"
        ? "Bandeja de Entrada"
        : docView === "sent"
          ? "Enviados"
          : "Auditar Mensajes";

    const MY_DEPT =
      "Gerencia Nacional de Tecnologías de la Información y la Comunicación";

    const filteredDocs = documents.filter((doc) => {
      const canViewAll = hasPermission(PERMISSIONS_MASTER.DOCS_VIEW_ALL);
      const canViewDept = hasPermission(PERMISSIONS_MASTER.DOCS_VIEW_DEPT);
      const statusValue = normalizeMessagingStatus(doc, docView);
      const deptValue = String(doc.targetDepartment || "").toLowerCase().trim();
      const searchValue = `${doc.name || ""} ${doc.correlativo || ""}`.toLowerCase();

      const matchesStatus = filterStatus === "all" || statusValue === filterStatus;
      const matchesDept =
        docView === "audit" && isManager && !isPrivilegedAuditRole
          ? true
          : filterDept === "all" || deptValue === String(filterDept).toLowerCase().trim();
      const matchesSearch = !searchTerm.trim() || searchValue.includes(searchTerm.toLowerCase().trim());

      if (!matchesStatus || !matchesDept || !matchesSearch) {
        return false;
      }

      // Debug logs
      console.log(`[FILTER] Doc: ${doc.name} | Receptor: ${doc.receptor_id} | Gerencia: ${doc.receptor_gerencia_id}`);
      console.log(`[FILTER] User: ${user?.id} | Dept: ${userDept}`);

      if (docView === "audit") {
        if (!canUseAuditView) return false;
        if (isPrivilegedAuditRole) return true;

        const myGerId = user?.gerencia_id?.toString() || "";
        if (!myGerId) return false;

        const senderGerId = doc.remitente_gerencia_id?.toString() || "";
        const receiverGerId = doc.receptor_gerencia_id?.toString() || "";
        const receiverUserGerId = doc.receptor_gerencia_id_usuario?.toString() || "";
        const isInMyGerencia =
          myGerId === senderGerId ||
          myGerId === receiverGerId ||
          myGerId === receiverUserGerId;

        if (!isInMyGerencia) return false;

        const isOwn =
          (doc.remitente_id && user?.id && String(doc.remitente_id) === String(user.id)) ||
          (doc.receptor_id && user?.id && String(doc.receptor_id) === String(user.id));

        return !isOwn;
      }

      if (docView === "inbox") {
        // BANDEJA DE ENTRADA
        if (canViewAll) return true;

        // Coincidencia por receptor_id
        if (doc.receptor_id && user?.id) {
          if (String(doc.receptor_id) === String(user.id)) {
            console.log("[MATCH] Por receptor_id directo");
            return true;
          }
        }

        // Coincidencia por receptor_gerencia_id (siempre permitido para su propia gerencia)
        if (doc.receptor_gerencia_id) {
          const myGerId = user?.gerencia_id?.toString();
          const targetGerId = doc.receptor_gerencia_id.toString();

          if (myGerId && myGerId === targetGerId) {
            console.log(`[MATCH] Gerencia ID Match: ${myGerId}`);
            return true;
          }
        }

        // Fallback por nombre de departamento
        const docDept = (doc.targetDepartment || "").toLowerCase().trim();
        const userDeptLower = (userDept || "").toLowerCase().trim();
        if (docDept && userDeptLower && docDept === userDeptLower) {
          console.log("[MATCH] Por nombre de departamento");
          return true;
        }

        return false;

      } else {
        // ENVIADOS
        if (canViewAll) return true;

        // Coincidencia por remitente_id
        if (doc.remitente_id && user?.id) {
          if (String(doc.remitente_id) === String(user.id)) {
            console.log("[MATCH] Enviado por mí");
            return true;
          }
        }

        return false;
      }
    });

    const updateDocumentStatus = async (
      id: number,
      newStatus: Document["signatureStatus"],
    ) => {
      try {
        await apiUpdateStatus(id, newStatus);
        refreshDocs();
        await logDocumentActivity({
          username: userRole === "CEO" ? "Admin. General" : "Usuario Estándar",
          evento: "FLUJO DOCUMENTAL",
          detalles: `Cambio de estado en documento ID ${id} a ${newStatus.toUpperCase()}`,
          estado:
            newStatus === "aprobado"
              ? "success"
              : newStatus === "rechazado"
                ? "danger"
                : "info",
        });
      } catch (e) {
        console.error("Error updating status", e);
        void uiAlert("Error al actualizar el estado del documento.", "Error");
      }
    };

    const handleUploadClick = () => {
      window.location.href = "/dashboard/documentos/new";
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        void uiAlert("Error: Solo se permiten archivos en formato PDF.", "Archivo inválido");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setSelectedFiles(prev => [...prev, file]);
      if (!docName) setDocName(file.name);
    };

    const toggleUserRecipient = (id: string) => {
      setTargetUserIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    };

    const toggleDeptRecipient = (id: string) => {
      setTargetDeptIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    };

    const confirmUpload = async (e: React.FormEvent) => {
      e.preventDefault();

      const recipients = sendMode === "dept" ? targetDeptIds : targetUserIds;
      if (!recipients || recipients.length === 0) {
        void uiAlert("Por favor selecciona al menos un destinatario.", "Validacion");
        return;
      }

      const priorityValue = priorityEnabled ? "control" : "media";
      const manualId = correlativo.trim();

      try {
        const uploads = recipients.map((recipient) => {
          const formData = new FormData();
          formData.append("titulo", docName || "Mensaje sin asunto");
          if (manualId) formData.append("correlativo", manualId);
          formData.append("tipo_documento", docCategory);
          formData.append("prioridad", priorityValue);
          formData.append("contenido", messageContent);
          if (priorityEnabled && priorityDays > 0) {
            formData.append("tiempo_maximo_dias", String(priorityDays));
          }

          if (sendMode === "dept") {
            if (recipient.startsWith("name:")) {
              formData.append("receptor_gerencia_nombre", recipient.slice(5));
            } else {
              formData.append("receptor_gerencia_id", recipient);
            }
          } else {
            formData.append("receptor_id", recipient);
          }

          if (selectedFiles.length > 0) {
            selectedFiles.forEach((file) => {
              formData.append("archivos", file);
            });
          }

          return uploadDocumento(formData);
        });
        await Promise.all(uploads);
        refreshDocs();

        await logDocumentActivity({
          username: user?.nombre || "Usuario",
          evento: "MENSAJERÍA INTERNA",
          detalles: `Envío de mensaje: "${docName}" a ${recipients.length} ${sendMode === "user" ? "usuario(s)" : "gerencia(s)"}`,
          estado: "success",
        });

        setShowUploadModal(false);
        setSelectedFiles([]);
        setDocName("");
        setDocCategory("Informe");
        setMessageContent("");
        setCorrelativo("");
        setPriorityEnabled(false);
        setPriorityDays(3);
        setTargetUserIds([]);
        setTargetDeptIds([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        void uiAlert("Mensaje enviado con éxito.", "Mensajeria");
      } catch (e) {
        console.error("Error sending message:", e);
        void uiAlert("Error al enviar el mensaje.", "Error");
      }
    };

    const viewDocument = async (doc: Document) => {
      setSelectedDoc(doc);
      setShowViewModal(true);

      // Marcar como Leído si no lo estaba y el usuario actual es receptor directo o por gerencia
      const isDirectRecipient =
        !!doc.receptor_id && !!user?.id && String(doc.receptor_id) === String(user.id);
      const isDeptRecipient =
        !!doc.receptor_gerencia_id &&
        !!user?.gerencia_id &&
        String(doc.receptor_gerencia_id) === String(user.gerencia_id);

      if (!doc.leido && (isDirectRecipient || isDeptRecipient)) {
        try {
          await markAsRead(doc.id);
          // Actualización optimista local
          setDocuments(prev =>
            prev.map(d =>
              d.id === doc.id
                ? {
                  ...d,
                  leido: true,
                  signatureStatus: ["en-proceso", "pendiente"].includes(
                    String(d.signatureStatus || "").toLowerCase(),
                  )
                    ? "recibido"
                    : d.signatureStatus,
                }
                : d,
            ),
          );
        } catch (e) {
          console.error("Error marking as read", e);
        }
      }
    };

    const getFileIcon = (type: string) => {
      // Only PDF icons after hardening
      return <FileText size={18} className="text-red-500" />;
    };

    const getSignatureStatus = (status: string | null | undefined) => {
      // Manejo defensivo para status null/undefined
      if (!status || status === "null" || status === "undefined" || status === "") {
        return {
          color: darkMode ? "bg-gray-500/10 text-gray-400" : "bg-gray-50 text-gray-700",
          icon: AlertCircle,
          label: "Sin Estado",
        };
      }

      const statusLower = String(status).toLowerCase().trim();

      switch (statusLower) {
        case "pendiente":
          return {
            color: darkMode ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700",
            icon: AlertCircle,
            label: "Pendiente",
          };
        case "aprobado":
          return {
            color: darkMode ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-700",
            icon: CheckCircle,
            label: "Aprobado",
          };
        case "rechazado":
          return {
            color: darkMode ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-700",
            icon: X,
            label: "Rechazado",
          };
        case "omitido":
          return {
            color: darkMode ? "bg-gray-500/10 text-gray-400" : "bg-gray-50 text-gray-700",
            icon: LogOut,
            label: "Omitido",
          };
        case "en-proceso":
        case "en proceso":
        case "en_proceso":
          return {
            color: darkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-700",
            icon: Clock,
            label: "En Proceso",
          };
        case "recibido":
        case "visto":
          return {
            color: darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700",
            icon: Eye,
            label: "Recibido",
          };
        case "leido":
        case "Leído":
          return {
            color: darkMode ? "bg-cyan-500/10 text-cyan-400" : "bg-cyan-50 text-cyan-700",
            icon: Eye,
            label: "Leído",
          };
        default:
          return {
            color: darkMode ? "bg-slate-500/10 text-slate-400" : "bg-slate-50 text-slate-700",
            icon: AlertCircle,
            label: status || "Desconocido",
          };
      }
    };

    return (
      <div className="space-y-4 pt-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf"
        />

        {/* Nuevo Mensaje Modal (ex-Upload) */}
        {showUploadModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-2 md:p-5 animate-in fade-in duration-300 overflow-hidden">
            <div className={`w-[min(1400px,98vw)] h-[95vh] rounded-2xl border shadow-2xl flex flex-col glass-reflect ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white"}`}>
              <div className="p-6 border-b flex justify-between items-center bg-red-700 text-white">
                <h2 className="font-bold flex items-center gap-2 uppercase tracking-tight text-white">
                  <Mail size={20} />
                  ENVIAR MENSAJE INTERNO
                </h2>
                <button onClick={() => setShowUploadModal(false)} className="hover:rotate-90 transition-transform">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={confirmUpload} className="p-5 md:p-6 space-y-4 overflow-y-auto no-scrollbar">
                <div className="flex gap-4 mb-2">
                  <button
                    type="button"
                    onClick={() => setSendMode("user")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${sendMode === "user" ? "bg-red-700 border-red-700 text-white" : darkMode ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-600"}`}
                  >
                    A USUARIO
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode("dept")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${sendMode === "dept" ? "bg-red-700 border-red-700 text-white" : darkMode ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-600"}`}
                  >
                    A GERENCIA
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    Asunto
                  </label>
                  <input
                    required
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Ej: Solicitud de Vacaciones"
                    className={`w-full px-4 py-2.5 rounded-lg border outline-none text-sm ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    Formato de documento
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-lg border outline-none text-sm ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                  >
                    <option value="Informe">Informe</option>
                    <option value="Memorando">Memorando</option>
                    <option value="Circular">Circular</option>
                    <option value="Solicitud">Solicitud</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    Correlativo (ID Manual)
                  </label>
                  <input
                    value={correlativo}
                    onChange={(e) => setCorrelativo(e.target.value)}
                    placeholder="Ej: 015"
                    className={`w-full px-4 py-2.5 rounded-lg border outline-none text-sm ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Formato final: {correlativoPreview}
                  </p>
                </div>

                <div className="rounded-lg border p-3 border-dashed border-slate-700/40">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={priorityEnabled}
                      onChange={(e) => setPriorityEnabled(e.target.checked)}
                      className="accent-red-600"
                    />
                    Control de seguimiento (prioridad)
                  </label>
                  {priorityEnabled && (
                    <div className="mt-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                        Tiempo máximo de atención (días)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={priorityDays}
                        onChange={(e) => setPriorityDays(Math.max(1, Number(e.target.value || 1)))}
                        className={`w-full px-4 py-2.5 rounded-lg border outline-none text-sm ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                      />
                      <div className={`mt-3 rounded-lg border px-3 py-2 text-xs space-y-1 ${darkMode ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                        <p><span className="font-semibold">Fecha de envio:</span> {fechaEnvioPreview}</p>
                        <p><span className="font-semibold">Fecha maxima de entrega:</span> {fechaMaximaEntregaPreview}</p>
                      </div>
                    </div>
                  )}
                </div>

                {sendMode === "user" ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                      Destinatarios (Usuarios)
                    </label>
                    <details
                      className={`w-full rounded-lg border px-3 py-2 ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                    >
                      <summary className="cursor-pointer text-sm">
                        Seleccionar usuarios ({targetUserIds.length})
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto no-scrollbar space-y-2">
                        {messagingUserOptions.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={targetUserIds.includes(u.id)}
                              onChange={() => toggleUserRecipient(u.id)}
                              className="accent-red-600"
                            />
                            <span>{u.label}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                      Gerencias Destino
                    </label>
                    <details
                      className={`w-full rounded-lg border px-3 py-2 ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                    >
                      <summary className="cursor-pointer text-sm">
                        Seleccionar gerencias ({targetDeptIds.length})
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto no-scrollbar space-y-2">
                        {messagingDeptOptions.map((g) => (
                          <label key={g.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={targetDeptIds.includes(g.id)}
                              onChange={() => toggleDeptRecipient(g.id)}
                              className="accent-red-600"
                            />
                            <span>{g.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    Mensaje / Contenido
                  </label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={4}
                    placeholder="Escribe tu mensaje aquí..."
                    className={`w-full px-4 py-2.5 rounded-lg border outline-none text-sm resize-none ${darkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    Adjuntar PDFs (Puedes subir varios)
                  </label>
                  <div className="space-y-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all ${darkMode ? "border-slate-700 hover:border-slate-500 bg-slate-800/50" : "border-slate-300 hover:border-slate-400 bg-slate-50"}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <FileText size={24} className="text-slate-400" />
                        <span className="text-xs text-slate-500">Añadir Archivo PDF</span>
                      </div>
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2 rounded-lg border ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <CheckCircle size={16} className="text-green-500 shrink-0" />
                              <span className="text-xs truncate font-medium">{file.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-600 p-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className={`flex-1 py-3 rounded-lg font-bold text-xs tracking-widest border transition-all ${darkMode ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-lg font-bold text-xs tracking-widest text-white transition-all transform active:scale-95 shadow-lg bg-red-700 hover:bg-red-800 shadow-red-900/20"
                  >
                    ENVIAR MENSAJE
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-2">
          <div
            className={`flex p-1 rounded-lg border ${darkMode ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"}`}
          >
            <button
              onClick={() => setDocView("inbox")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${docView === "inbox" ? "bg-red-700 text-white" : darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Inbox size={14} />
              BANDEJA DE ENTRADA
            </button>
            <button
              onClick={() => setDocView("sent")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${docView === "sent" ? "bg-red-700 text-white" : darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Send size={14} />
              ENVIADOS
            </button>
            {canUseAuditView && (
              <button
                onClick={() => setDocView("audit")}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${docView === "audit" ? "bg-red-700 text-white" : darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                <Shield size={14} />
                AUDITAR MENSAJES
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {hasPermission(PERMISSIONS_MASTER.DOCS_UPLOAD) && (
              <button
                onClick={handleUploadClick}
                className={`px-4 py-2 rounded-md text-sm font-medium ${darkMode ? "bg-green-600 text-white hover:bg-green-700" : "bg-green-700 text-white hover:bg-green-800"}`}
              >
                + Nuevo Documento
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div
          className={`glass-reflect p-4 rounded-lg flex flex-wrap gap-4 items-end ${darkMode ? "bg-slate-900/50 border border-slate-800" : "bg-slate-50 border border-slate-200"}`}
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Búsqueda
            </label>
            <div
              className={`flex items-center px-3 py-2 rounded-md border ${darkMode ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`}
            >
              <Search size={14} className="text-slate-500 mr-2" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID o Título..."
                className="bg-transparent border-none outline-none text-sm w-full"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Estado
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border text-sm outline-none cursor-pointer ${darkMode ? "bg-slate-950 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`}
            >
              <option value="all">Todos los Estados</option>
              {docView !== "sent" ? (
                <>
                  <option value="leido">Leído</option>
                  <option value="en-proceso">En Proceso</option>
                </>
              ) : (
                <>
                  <option value="recibido">Recibido</option>
                  <option value="en-proceso">En Proceso</option>
                </>
              )}
            </select>
          </div>
          {canAccessSecurityModule && (
            <div className="w-48">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Gerencia
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm outline-none cursor-pointer ${darkMode ? "bg-slate-950 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`}
              >
                <option value="all">Todas las Gerencias</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto no-scrollbar rounded-lg border border-slate-200/20 glass-reflect">
          <table className={`w-full ${darkMode ? "bg-slate-900" : "bg-white"}`}>
            <thead
              className={`${darkMode ? "bg-slate-950/50" : "bg-slate-50"} border-b ${darkMode ? "border-slate-800" : "border-slate-200"}`}
            >
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Documento
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Correlativo
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Fecha / Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Enviado Por
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recibido Por
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? "divide-slate-800" : "divide-slate-200"}`}>
              {filteredDocs.map((doc) => {
                const effectiveStatus = normalizeMessagingStatus(doc, docView);
                const statusInfo = getSignatureStatus(effectiveStatus);
                const StatusIcon = statusInfo.icon;
                const isUnread = !doc.leido && docView === "inbox";

                return (
                  <tr
                    key={doc.id}
                    className={`transition-colors h-14 ${darkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50"} ${isUnread ? (darkMode ? "bg-blue-900/10" : "bg-blue-50/50") : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 p-2 rounded-lg ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                          {doc.fileUrl ? <FileText size={18} className="text-red-500" /> : <Mail size={18} className="text-blue-500" />}
                        </div>
                        <div className="max-w-[200px] overflow-hidden">
                          <div className={`text-sm truncate ${isUnread ? "font-bold text-white" : "text-slate-400"}`}>
                            {doc.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {doc.category}
                          </div>
                        </div>
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-red-600 mt-2"></div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">
                      {doc.idDoc}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-400">{doc.uploadDate}</div>
                      <div className="text-[10px] text-slate-600">{doc.uploadTime}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-slate-500" />
                        <span className="text-xs text-slate-400 truncate max-w-[150px]">
                          {doc.uploadedBy || "Desconocido"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                        {doc.remitente_gerencia_nombre || "Sin Gerencia"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={12} className="text-slate-500" />
                        <span className="text-xs text-slate-400 truncate max-w-[150px]">
                          {doc.receivedBy !== "Pendiente" ? doc.receivedBy : doc.targetDepartment}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                        {doc.receptor_gerencia_nombre ||
                          doc.receptor_gerencia_nombre_usuario ||
                          doc.targetDepartment ||
                          "Sin Gerencia"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${statusInfo.color}`}>
                        <StatusIcon size={10} />
                        {statusInfo.label.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => viewDocument(doc)}
                          className={`p-2 rounded-md transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-600"}`}
                          title="Leer Mensaje / Ver Documento"
                        >
                          <Eye size={16} />
                        </button>
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-2 rounded-md transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-600"}`}
                            title="Descargar PDF"
                          >
                            <Download size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Mensaje de vacío FUERA del .map() */}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 italic">
                    No se encontraron documentos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredDocs.length === 0 && (
            <div className="p-10 text-center">
              <div className="text-slate-500 italic mb-2">No se encontraron mensajes</div>
              <div className="text-xs text-slate-400 mb-4 space-y-1">
                <div>Total en sistema: {documents.length}</div>
                <div>Filtros activos: {docViewLabel} | {filterDept !== "all" ? filterDept : "Todos"}</div>
              </div>
              <button
                onClick={refreshDocs}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors text-sm font-bold"
              >
                Actualizar Bandeja
              </button>
            </div>
          )}
        </div>

        {/* Modal de Lectura de Mensaje */}
        {showViewModal && selectedDoc && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in duration-200">
            <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white"}`}>
              <div className="p-6 border-b flex justify-between items-center bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-700 flex items-center justify-center text-white font-bold">
                    {selectedDoc.uploadedBy?.[0] || "?"}
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-lg leading-tight">{selectedDoc.name}</h2>
                    <p className="text-xs text-slate-500">De: {selectedDoc.uploadedBy} - {selectedDoc.uploadDate} {selectedDoc.uploadTime}</p>
                  </div>
                </div>
                <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Mail size={12} />
                    CONTENIDO DEL MENSAJE
                  </div>
                  <div className={`p-6 rounded-xl border leading-relaxed text-sm min-h-[150px] whitespace-pre-wrap ${darkMode ? "bg-slate-950/50 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                    {selectedDoc.contenido || "Este mensaje no tiene contenido de texto."}
                  </div>
                </div>

                {((selectedDoc.archivos && selectedDoc.archivos.length > 0) || selectedDoc.fileUrl) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <FileText size={12} />
                      ADJUNTOS ({selectedDoc.archivos?.length || (selectedDoc.fileUrl ? 1 : 0)})
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {selectedDoc.archivos && selectedDoc.archivos.length > 0 ? (
                        selectedDoc.archivos.map((url, idx) => (
                          <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between ${darkMode ? "bg-blue-900/10 border-blue-900/30 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
                            <div className="flex items-center gap-3">
                              <FileText size={20} />
                              <div>
                                <div className="text-sm font-bold">Documento Adjunto {idx + 1}</div>
                                <div className="text-[10px] opacity-70">PDF - LISTO</div>
                              </div>
                            </div>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                            >
                              <Eye size={14} />
                              ABRIR
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${darkMode ? "bg-blue-900/10 border-blue-900/30 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
                          <div className="flex items-center gap-3">
                            <FileText size={20} />
                            <div>
                              <div className="text-sm font-bold">Documento Adjunto Original</div>
                              <div className="text-[10px] opacity-70">PDF - LISTO</div>
                            </div>
                          </div>
                          <a
                            href={selectedDoc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                          >
                            <Eye size={14} />
                            ABRIR
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t bg-slate-950/20 flex justify-end gap-3">
                <button
                  onClick={() => setShowViewModal(false)}
                  className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${darkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
                >
                  CERRAR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  };

// Módulo importado de forma dinámica para evitar errores de hidratación y mejorar carga de chunks
import dynamic from "next/dynamic";
const SecurityModule = dynamic(() => import("./security/SecurityModule"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-20">
      <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  ),
});

const ChartsModule: React.FC<{
  darkMode: boolean;
  documents: Document[];
  tickets: Ticket[];
  orgStructure: OrgCategory[];
}> = ({ darkMode, documents, tickets, orgStructure }) => {
  const [view, setView] = useState<"overview" | "drilldown">("overview");
  const [selectedDetailDept, setSelectedDetailDept] = useState<string | null>(
    null,
  );

  const parseFlexibleDate = (value?: string) => {
    if (!value) return null;
    const raw = String(value).trim();
    const latin = raw.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (latin) {
      const [, dRaw, mRaw, y, hh = "00", mm = "00", ss = "00"] = latin;
      const d = dRaw.padStart(2, "0");
      const m = mRaw.padStart(2, "0");
      const date = new Date(`${y}-${m}-${d}T${hh.padStart(2, "0")}:${mm}:${ss}`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const normalizeDocStatus = (value?: string) =>
    String(value || "")
      .toLowerCase()
      .trim()
      .replaceAll("_", "-")
      .replaceAll(" ", "-");

  const getCurrentDocStatus = (doc: Document) => {
    const raw = normalizeDocStatus(doc.signatureStatus);
    if (raw === "finalizado" || raw === "vencido") return raw;
    // Alineado con Control de seguimiento: evalua el vencimiento por fecha visible (sin hora).
    const deadlineDateOnly =
      doc.fecha_caducidad && !Number.isNaN(new Date(doc.fecha_caducidad).getTime())
        ? new Date(doc.fecha_caducidad).toLocaleDateString("es-ES")
        : doc.fecha_caducidad;
    const deadline = parseFlexibleDate(deadlineDateOnly || undefined);
    if (deadline && Date.now() > deadline.getTime()) return "vencido";
    return raw || "en-proceso";
  };

  // Dynamic data for Documents Status (actual/real state)
  const docStatusData = useMemo(() => {
    const counts: Record<string, number> = {
      pendiente: 0,
      "en-proceso": 0,
      finalizado: 0,
      vencido: 0,
      aprobado: 0,
      rechazado: 0,
      recibido: 0,
      omitido: 0,
    };
    documents.forEach((doc) => {
      const status = getCurrentDocStatus(doc);
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status]++;
      }
    });
    return [
      { name: "En Proceso", value: counts["en-proceso"], color: "#3b82f6" },
      { name: "Vencidos", value: counts.vencido, color: "#ef4444" },
      { name: "Finalizados", value: counts.finalizado, color: "#10b981" },
      { name: "Pendientes", value: counts.pendiente, color: "#f59e0b" },
      { name: "Recibidos", value: counts.recibido, color: "#14b8a6" },
      { name: "Aprobados", value: counts.aprobado, color: "#22c55e" },
      { name: "Rechazados", value: counts.rechazado, color: "#ef4444" },
      { name: "Omitidos", value: counts.omitido, color: "#64748b" },
    ].filter((d) => d.value > 0);
  }, [documents]);

  // Dynamic data for Ticket Priority (Existing chart)
  const ticketPriorityData = useMemo(() => {
    const counts = { ALTA: 0, MEDIA: 0, BAJA: 0 };
    tickets.forEach((t) => {
      if (counts.hasOwnProperty(t.priority)) {
        counts[t.priority]++;
      }
    });
    return [
      { name: "Alta", value: counts.ALTA, color: "#ef4444" },
      { name: "Media", value: counts.MEDIA, color: "#f59e0b" },
      { name: "Baja", value: counts.BAJA, color: "#10b981" },
    ].filter((t) => t.value > 0);
  }, [tickets]);

  // Get all departments list (estructura + actividad real)
  const allDepartments = useMemo(() => {
    const normalize = (value: string) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    const map = new Map<string, string>();
    const collect = (name?: string) => {
      const raw = String(name || "").trim();
      if (!raw) return;
      const key = normalize(raw);
      if (!map.has(key)) map.set(key, raw);
    };

    orgStructure.forEach((group) => (group.items || []).forEach((item) => collect(item)));
    documents.forEach((doc) => {
      collect(doc.department);
      collect(doc.targetDepartment);
      collect(doc.remitente_gerencia_nombre);
      collect(doc.receptor_gerencia_nombre);
      collect(doc.receptor_gerencia_nombre_usuario);
    });
    tickets.forEach((ticket) => {
      collect(ticket.area);
      collect(ticket.creatorDept);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [orgStructure, documents, tickets]);

  const handleDeptSelect = (dept: string) => {
    setSelectedDetailDept(dept);
    // Ya estamos en drilldown, pero aseguramos
    setView("drilldown");
  };

  const handleBackToGrid = () => {
    setSelectedDetailDept(null);
  };

  const handleMainViewChange = (newView: "overview" | "drilldown") => {
    setView(newView);
    if (newView === "overview") {
      setSelectedDetailDept(null);
    }
  };

  return (
    <div className="space-y-6">
      {!selectedDetailDept && (
        <div className="flex justify-between items-center pb-4 border-b border-slate-200/10">
          <div>
            {view === "overview" ? (
              <>
                <h1
                  className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}
                >
                  Módulo de Estadísticas y Gráficos
                </h1>
                <p
                  className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                >
                  Visualización de datos estratégicos y métricas de desempeño.
                </p>
              </>
            ) : (
              <h1
                className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}
              >
                Desglose por Departamento
              </h1>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleMainViewChange("overview")}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${view === "overview" ? "bg-red-700 text-white" : darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              Vista General
            </button>
            <button
              onClick={() => handleMainViewChange("drilldown")}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${view === "drilldown" ? "bg-red-700 text-white" : darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              Seleccionar Gerencia
            </button>
          </div>
        </div>
      )}

      {view === "overview" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {/* Chart 1: Document Status */}
          <div
            className={`p-6 rounded-lg border ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
          >
            <h3
              className={`font-bold mb-6 text-center ${darkMode ? "text-slate-200" : "text-slate-800"}`}
            >
              ESTADO DE DOCUMENTOS
            </h3>
            <div className="h-64">
              <ResponsiveContainerCompat width="100%" height="100%">
                <PieChartCompat>
                  <PieCompat
                    data={docStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {docStatusData.map((entry, index) => (
                      <CellCompat key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </PieCompat>
                  <TooltipCompat
                    contentStyle={{
                      backgroundColor: darkMode ? "#0f172a" : "#fff",
                      borderColor: darkMode ? "#1e293b" : "#e2e8f0",
                      color: darkMode ? "#f1f5f9" : "#1e293b",
                    }}
                  />
                  <LegendCompat />
                </PieChartCompat>
              </ResponsiveContainerCompat>
            </div>
          </div>

          {/* Chart 2: Ticket Priority */}
          <div
            className={`p-6 rounded-lg border ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
          >
            <h3
              className={`font-bold mb-6 text-center ${darkMode ? "text-slate-200" : "text-slate-800"}`}
            >
              PRIORIDAD DE TICKETS
            </h3>
            <div className="h-64">
              <ResponsiveContainerCompat width="100%" height="100%">
                <PieChartCompat>
                  <PieCompat
                    data={ticketPriorityData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                    dataKey="value"
                  >
                    {ticketPriorityData.map((entry, index) => (
                      <CellCompat key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </PieCompat>
                  <TooltipCompat
                    contentStyle={{
                      backgroundColor: darkMode ? "#0f172a" : "#fff",
                      borderColor: darkMode ? "#1e293b" : "#e2e8f0",
                      color: darkMode ? "#f1f5f9" : "#1e293b",
                    }}
                  />
                  <LegendCompat verticalAlign="bottom" height={36} />
                </PieChartCompat>
              </ResponsiveContainerCompat>
            </div>
          </div>
        </div>
      ) : // Drill-down View Logic
        selectedDetailDept ? (
          <DepartmentDetailView
            departmentName={selectedDetailDept}
            allDepartments={allDepartments}
            documents={documents}
            tickets={tickets}
            darkMode={darkMode}
            onBack={handleBackToGrid}
            onDepartmentChange={handleDeptSelect}
          />
        ) : (
          <DepartmentGrid
            orgStructure={orgStructure}
            darkMode={darkMode}
            onSelectDepartment={handleDeptSelect}
          />
        )}
    </div>
  );
};

// ==========================================
// DASHBOARD PRINCIPAL (MODULAR)
// ==========================================
export default function Dashboard() {
  // OK: Hooks (must be at top)
  useIdleTimer(900000); // Auto-logout after 15 mins

  const [darkMode, setDarkMode] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedCategories, setExpandedCategories] = useState<number[]>([
    0, 1, 2, 3, 4,
  ]);
  const [selectedManagement, setSelectedManagement] = useState<string | null>(
    null,
  );
  const [managementDetailsMap, setManagementDetailsMap] = useState<Record<string, string[]>>(MANAGEMENT_DETAILS);

  const { user, logout, switchRole, hasPermission } = useAuth();
  const userRole = user?.role || "Usuario";
  const isDev = userRole === "Desarrollador";

  // Granular Access Controls base on hasPermission (Permisos del Sistema Alfa 2026)
  const canAccessSecurity =
    hasPermission(PERMISSIONS_MASTER.VIEW_SECURITY) ||
    userRole === "Administrativo" ||
    userRole === "Desarrollador";
  const canAccessStats = hasPermission(PERMISSIONS_MASTER.VIEW_STATS);
  const canAccessTickets = hasPermission(PERMISSIONS_MASTER.VIEW_TICKETS);
  const canAccessPriorities =
    hasPermission(PERMISSIONS_MASTER.VIEW_PRIORITIES) ||
    userRole === "Usuario" ||
    userRole === "Gerente";
  const canEditOrgStructure =
    userRole === "Desarrollador" || userRole === "Administrativo" || userRole === "CEO";
  const canEditManagementDetails =
    userRole === "Desarrollador" || userRole === "Administrativo";

  // Action specific check
  const isReadOnly = !hasPermission(PERMISSIONS_MASTER.DOCS_UPLOAD);

  // Lifted state for documents to share with SecurityModule
  const [documents, setDocuments] = useState<Document[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [gerencias, setGerencias] = useState<any[]>([]);

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await getDocumentos();

      console.log("ðŸ“„ Documentos RAW del backend:", data);

      const mappedDocs = data.map((d: any) => {
        // Fechas seguras
        let uploadDate = "N/A";
        let uploadTime = "N/A";

        if (d.fecha_creacion || d.uploadDate) {
          try {
            // Priorizar la cadena formateada del backend si existe
            if (d.uploadDate) {
              uploadDate = d.uploadDate;
              uploadTime = d.uploadTime || "N/A";
            } else {
              const date = new Date(d.fecha_creacion);
              if (!isNaN(date.getTime())) {
                uploadDate = date.toLocaleDateString("es-ES");
                uploadTime = date.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }
            }
          } catch (e) {
            console.error("Error parsing date:", e);
          }
        }

        const signatureStatusValue =
          d.estado ??
          d.signatureStatus ??
          d.signaturestatus ??
          d.status ??
          "en-proceso";
        const normalizedSignatureStatus = String(signatureStatusValue)
          .toLowerCase()
          .trim()
          .replaceAll("_", "-")
          .replaceAll(" ", "-");

        // URL del archivo
        const fileUrl = d.url_archivo || d.fileUrl
          ? `${process.env.NEXT_PUBLIC_API_URL || "https://corpoelect-backend.onrender.com"}${d.url_archivo || d.fileUrl}`
          : undefined;
        const rawCorrelativo =
          d.correlativo ??
          d.idDoc ??
          d.iddoc ??
          d.numero_documento ??
          d.numeroDocumento;
        const correlativoValue =
          rawCorrelativo !== null && rawCorrelativo !== undefined && String(rawCorrelativo).trim() !== ""
            ? String(rawCorrelativo).trim()
            : "N/A";

        return {
          id: d.id,
          idDoc: correlativoValue,
          name: d.titulo || d.title || d.name || "Sin Título",
          category: d.tipo_documento || d.category || "Otros",
          type: "pdf" as const,
          size: "N/A",
          uploadedBy: d.uploadedBy || d.remitente_nombre || "Desconocido",
          receivedBy: d.receptor_nombre || d.receivedBy || "Pendiente",
          // IDs como strings para comparación
          receptor_id: d.receptor_id ? String(d.receptor_id) : null,
          receptor_gerencia_id: d.receptor_gerencia_id ? String(d.receptor_gerencia_id) : null,
          remitente_id: d.remitente_id ? String(d.remitente_id) : null,
          receptor_gerencia_id_usuario: d.receptor_gerencia_id_usuario
            ? Number(d.receptor_gerencia_id_usuario)
            : undefined,
          receptor_gerencia_nombre_usuario: d.receptor_gerencia_nombre_usuario,
          remitente_gerencia_id: d.remitente_gerencia_id ? Number(d.remitente_gerencia_id) : undefined,
          remitente_gerencia_nombre: d.remitente_gerencia_nombre,
          uploadDate,
          uploadTime,
          signatureStatus: normalizedSignatureStatus,
          department:
            d.department ||
            d.remitente_gerencia_nombre ||
            d.receptor_gerencia_nombre_usuario ||
            "Sin Asignar",
          targetDepartment:
            d.targetDepartment ||
            d.receptor_gerencia_nombre ||
            d.receptor_gerencia_nombre_usuario ||
            "Sin Asignar",
          correlativo: correlativoValue,
          fileUrl: d.fileUrl || (d.archivos && d.archivos.length > 0 ? d.archivos[0] : undefined),
          archivos: (d.archivos || []).map((url: string) =>
            url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL || "https://corpoelect-backend.onrender.com"}${url}`
          ),
          prioridad: d.prioridad || "media",
          tenant_id: d.tenant_id,
          user_id: d.user_id,
          contenido: d.contenido, // Nuevo
          leido: d.leido,          // Nuevo
          fecha_caducidad: d.fecha_caducidad || undefined,
        };
      });

      console.log("ðŸ“„ Documentos mapeados:", mappedDocs);
      setDocuments(mappedDocs as any);
    } catch (e) {
      console.error("Error fetching documents", e);
    }
  }, []);

  const fetchGerencias = useCallback(async () => {
    try {
      const data = await getGerencias();
      setGerencias(data);
    } catch (e) {
      console.error("Error fetching gerencias", e);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getAllUsers();
      setUsers(data || []);
    } catch (e) {
      console.error("Error fetching users", e);
      setUsers([]);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const rows = await getTickets();
      const mapped: Ticket[] = rows.map((t: any) => ({
        id: t.id,
        title: t.titulo || "Sin Título",
        description: t.descripcion || "",
        area:
          t.area ||
          "Gerencia Nacional de Tecnologías de la Información y la Comunicación",
        creatorDept: t.solicitante_gerencia || "Sin Asignar",
        priority: (String(t.prioridad || "media").toUpperCase() as Ticket["priority"]),
        status:
          String(t.estado || "abierto").toLowerCase() === "eliminado"
            ? "ELIMINADO"
            :
            String(t.estado || "abierto").toLowerCase() === "resuelto"
              ? "RESUELTO"
              : String(t.estado || "abierto").toLowerCase() === "en-proceso"
                ? "EN-PROCESO"
                : "ABIERTO",
        createdAt: t.fecha_creacion
          ? new Date(t.fecha_creacion).toLocaleDateString("es-ES")
          : new Date().toLocaleDateString("es-ES"),
        ownerId: t.solicitante_id ? String(t.solicitante_id) : undefined,
        owner: t.solicitante_nombre || "Desconocido",
        observations: t.observaciones || "",
        takenBy: t.tecnico_nombre || undefined,
      }));
      setTickets(mapped);
    } catch (e) {
      console.error("Error fetching tickets", e);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchDocuments();
      fetchUsers();
      fetchGerencias();
      fetchTickets();
    }
  }, [mounted, fetchDocuments, fetchUsers, fetchGerencias, fetchTickets]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await getOrgManagementDetails();
        const remoteMap = remote?.management_details || {};
        if (!cancelled) {
          const merged = {
            ...MANAGEMENT_DETAILS,
            ...remoteMap,
          };
          setManagementDetailsMap(merged);
          localStorage.setItem(MANAGEMENT_DETAILS_STORAGE_KEY, JSON.stringify(merged));
        }
        return;
      } catch (error) {
        console.error("No se pudieron cargar detalles de gerencias desde API", error);
      }

      try {
        const raw = localStorage.getItem(MANAGEMENT_DETAILS_STORAGE_KEY);
        if (!raw) {
          if (!cancelled) setManagementDetailsMap(MANAGEMENT_DETAILS);
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !cancelled) {
          setManagementDetailsMap({
            ...MANAGEMENT_DETAILS,
            ...parsed,
          });
        }
      } catch (error) {
        console.error("No se pudieron cargar los detalles de gerencias personalizados", error);
        if (!cancelled) setManagementDetailsMap(MANAGEMENT_DETAILS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const handleSaveManagementDetails = useCallback(async (name: string, nextFunctions: string[]) => {
    const nextMap = {
      ...managementDetailsMap,
      [name]: nextFunctions,
    };
    setManagementDetailsMap(nextMap);
    try {
      localStorage.setItem(MANAGEMENT_DETAILS_STORAGE_KEY, JSON.stringify(nextMap));
    } catch (error) {
      console.error("No se pudo persistir personalización local de gerencia", error);
    }
    try {
      await saveOrgManagementDetails(nextMap);
    } catch (error) {
      console.error("No se pudo persistir personalización de gerencia en backend", error);
    }
  }, [managementDetailsMap]);

  useEffect(() => {
    if (!mounted) return;

    const syncDocs = () => {
      fetchDocuments();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncDocs();
      }
    };

    const intervalId = window.setInterval(syncDocs, 8000);
    window.addEventListener("focus", syncDocs);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncDocs);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [mounted, fetchDocuments]);

  useEffect(() => {
    if (!mounted) return;

    const syncTickets = () => {
      fetchTickets();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncTickets();
      }
    };

    const intervalId = window.setInterval(syncTickets, 8000);
    window.addEventListener("focus", syncTickets);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncTickets);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [mounted, fetchTickets]);

  // Lifted state for tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Organizational Structure State
  const [orgStructure, setOrgStructure] = useState<OrgCategory[]>([]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      let data: OrgCategory[] = [];
      let source: string | undefined;
      try {
        const remote = await getOrgStructure();
        if (remote?.org_structure?.length) {
          data = remote.org_structure as OrgCategory[];
          source = remote.source;
        }
        if (remote?.management_details && typeof remote.management_details === "object") {
          setManagementDetailsMap((prev) => ({
            ...prev,
            ...remote.management_details,
          }));
        }
      } catch (e) {
        console.error("Error loading org structure from API, using fallback", e);
      }

      if (data.length === 0) {
        data = JSON.parse(JSON.stringify(DEFAULT_ORG_STRUCTURE));
        source = source || "default";
      }

      if (source === "catalog" && canEditOrgStructure) {
        try {
          await saveOrgStructure(DEFAULT_ORG_STRUCTURE);
          data = JSON.parse(JSON.stringify(DEFAULT_ORG_STRUCTURE));
          source = "seeded";
        } catch (e) {
          console.error("No se pudo inicializar la estructura organizativa", e);
        }
      }

      if (userRole === "Desarrollador" && !data.some((g) => g.category?.includes("Desarrollo"))) {
        data.push({
          category: "VI. Módulo de Desarrollo y Control Raíz",
          icon: "Shield",
          items: ["Gestión Directa", "Logs de Auditoría", "Control de Dominios"],
        });
      }

      if (!cancelled) setOrgStructure(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, userRole, user?.id, canEditOrgStructure]);

  // OK: Añade el estado para el bot de ayuda
  const [isChatOpen, setIsChatOpen] = useState(false);

  // ESTADO DE ANUNCIOS (Dashboard General)
  const [announcement, setAnnouncement] = useState<AnnouncementData>({
    badge: "Comunicado del Día",
    title: "Actualización de Protocolos de Seguridad 2026",
    description:
      "Se les informa a todas las Gerencias que a partir de las 14:00h se iniciará la migración de los protocolos de firma digital. Por favor, aseguren sus trámites pendientes.",
    status: "Activo",
    urgency: "Alta",
    color: "#dc2626",
  });

  // Persistencia de anuncios
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      try {
        const remoteAnnouncement = await getAnnouncement();
        if (!cancelled && remoteAnnouncement) {
          setAnnouncement(remoteAnnouncement);
        }
      } catch (e) {
        console.error("Error loading announcement", e);
      }
    })();

    // Check for tab in URL and VALIDATE role permissions
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) {
      // Security Validation: Only allow access if role permitted
      let isAllowed = true;
      if (tab === "seguridad" && !canAccessSecurity) isAllowed = false;
      if (tab === "graficos" && !canAccessStats) isAllowed = false;
      if (tab === "prioridades" && !canAccessPriorities) isAllowed = false;
      if (tab === "tickets" && !canAccessTickets) isAllowed = false;

      if (isAllowed) {
        setActiveTab(tab);
        if (tab === "seguridad") setActiveSection("dashboard");
      } else {
        console.warn(`Intento de acceso no autorizado a la pestaña: ${tab}`);
        setActiveTab("overview");
        // Clean URL from malicious tab
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [mounted, userRole]); // Re-run if userRole changes

  // Sync en modo manual: el anuncio se refresca al recargar pagina.

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(
        "dashboard_announcement",
        JSON.stringify(announcement),
      );
    }
  }, [announcement, mounted]);

  // Documents Persistence REMOVED: Always fetch fresh from API
  // useEffect(() => {
  //   const saved = localStorage.getItem('dashboard_documents');
  //   if (saved) {
  //     try {
  //       setDocuments(JSON.parse(saved));
  //     } catch (e) {
  //       console.error("Error loading documents", e);
  //     }
  //   }
  // }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("dashboard_documents", JSON.stringify(documents));
    }
  }, [documents, mounted]);

  const theme = useMemo(
    () => ({
      bg: darkMode ? "bg-zinc-950" : "bg-slate-50",
      header: darkMode
        ? "bg-zinc-950/90 border-zinc-800"
        : "bg-white/90 border-slate-200",
      sidebar: darkMode
        ? "bg-black border-zinc-800"
        : "bg-white border-slate-200",
      text: darkMode ? "text-zinc-200" : "text-slate-900",
      subtext: darkMode ? "text-zinc-500" : "text-slate-400",
      cardBg: darkMode ? "bg-zinc-900" : "bg-white",
    }),
    [darkMode],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle("dark", darkMode);
    }
  }, [darkMode, mounted]);

  const stats = useMemo(() => {
    if (userRole === "Usuario") {
      return [
        {
          title: "Mis Tickets",
          value: "3",
          subtext: "2 Abiertos / 1 Resuelto",
          icon: Tag,
          trend: "Limite: 3 activos",
        },
        {
          title: "Mis Documentos",
          value: "12",
          subtext: "5 Recibidos / 7 Enviados",
          icon: FileText,
          trend: "+2 hoy",
        },
        {
          title: "Mensajes Bot",
          value: "15",
          subtext: "Historial de chat",
          icon: Bell,
          trend: "Soporte activo",
        },
        {
          title: "Nivel de Acceso",
          value: "Estándar",
          subtext: "Usuario TIC",
          icon: Shield,
          trend: "Verificado",
        },
      ];
    }

    // Role check for full stats access
    if (userRole === "CEO" || userRole === "Desarrollador") {
      return [
        {
          title: "Consumo Eléctrico",
          value: "1,245 MW",
          subtext: "Total Nacional",
          icon: Zap,
          trend: "+5.2%",
          trendPositive: false,
        },
        {
          title: "Personal Activo",
          value: "4,820",
          subtext: "En 12 plantas",
          icon: Users,
          trend: "+12",
          trendPositive: true,
        },
        {
          title: "Disponibilidad",
          value: "94.8%",
          subtext: "Media industrial",
          icon: Activity,
          trend: "+0.3%",
          trendPositive: true,
        },
        {
          title: "Presupuesto",
          value: "$2.4M",
          subtext: "Ejecución Q1 2026",
          icon: TrendingUp,
          trend: "75%",
          trendPositive: true,
        },
      ];
    }

    // Default for Administrativo
    return [
      {
        title: "Tickets Totales",
        value: "124",
        subtext: "García asigned",
        icon: Tag,
        trend: "+15 hoy",
      },
      {
        title: "Docs. Pendientes",
        value: "45",
        subtext: "Requieren firma",
        icon: FileText,
        trend: "Urgente",
      },
      {
        title: "Incidentes",
        value: "3",
        subtext: "Reportados hoy",
        icon: AlertTriangle,
        trend: "-50%",
        trendPositive: true,
      },
    ];
  }, [userRole]);

  const toggleCategory = (index: number) => {
    setExpandedCategories((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const normalizeDept = useCallback((value: string) => {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }, []);

  const dedupeDeptItems = useCallback((items: string[]) => {
    const seen = new Set<string>();
    return (items || []).filter((item) => {
      const key = normalizeDept(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [normalizeDept]);

  const canViewAllGerencias =
    userRole === "Desarrollador" || userRole === "Administrativo" || userRole === "CEO";

  const effectiveOrgStructure = useMemo(() => {
    const source: OrgCategory[] = orgStructure.length > 0
      ? orgStructure
      : (JSON.parse(JSON.stringify(DEFAULT_ORG_STRUCTURE)) as OrgCategory[]);
    const base = source.map((group) => ({
      ...group,
      items: dedupeDeptItems(group.items || []),
    }));

    if (canViewAllGerencias) return base;

    const myDept = normalizeDept(user?.gerencia_depto || "");
    if (!myDept) return [];

    return base
      .map((group: OrgCategory) => ({
        ...group,
        items: dedupeDeptItems((group.items || []).filter((item: string) => normalizeDept(item) === myDept)),
      }))
      .filter((group: OrgCategory) => group.items.length > 0);
  }, [orgStructure, canViewAllGerencias, dedupeDeptItems, normalizeDept, user?.gerencia_depto]);

  if (!mounted) return null;

  const announcementBaseColor = normalizeHexColor(announcement?.color, "#dc2626");
  const announcementStartColor = shiftHexColor(announcementBaseColor, -12);
  const announcementEndColor = shiftHexColor(announcementBaseColor, 20);
  const announcementBadgeColor = shiftHexColor(announcementBaseColor, -18);

  const renderContent = () => {
    switch (activeTab) {
      case "prioridades":
        return canAccessPriorities ? (
          <PriorityMatrix
            darkMode={darkMode}
            userRole={userRole}
            isReadOnly={isReadOnly}
            documents={documents}
            hasPermission={hasPermission}
            refreshDocs={fetchDocuments}
          />
        ) : (
          <div className="text-center p-20 font-bold text-red-500">
            Acceso Restringido
          </div>
        );
      case "tickets":
        return canAccessTickets ? (
          <TicketSystem
            darkMode={darkMode}
            orgStructure={effectiveOrgStructure}
            userRole={userRole}
            userDept={user?.gerencia_depto || ""}
            currentUser={user?.nombre + " " + user?.apellido}
            currentUserId={user?.id || ""}
            tickets={tickets}
            hasPermission={hasPermission}
            refreshTickets={fetchTickets}
          />
        ) : (
          <div className="text-center p-20 font-bold text-red-500">
            Acceso Restringido
          </div>
        );
      case "documentos":
        return (
          <DocumentManager
            darkMode={darkMode}
            userRole={userRole}
            userDept={user?.gerencia_depto || "Usuario"}
            documents={documents}
            setDocuments={setDocuments}
            orgStructure={effectiveOrgStructure}
            hasPermission={hasPermission}
            user={user}
            users={users}
            gerencias={gerencias}
            refreshDocs={fetchDocuments}
          />
        );
      case "seguridad":
        return canAccessSecurity ? (
          <SecurityModule
            darkMode={darkMode}
            announcement={announcement}
            setAnnouncement={setAnnouncement}
            documents={documents}
            setDocuments={setDocuments}
            userRole={userRole}
            orgStructure={orgStructure}
            setOrgStructure={setOrgStructure}
          />
        ) : (
          <div className="text-center p-20 font-bold text-red-500">
            Acceso Restringido
          </div>
        );
      case "graficos":
        return canAccessStats ? (
          <ChartsModule
            darkMode={darkMode}
            documents={documents}
            tickets={tickets}
            orgStructure={effectiveOrgStructure}
          />
        ) : (
          <div className="text-center p-20 font-bold text-red-500">
            Acceso Restringido
          </div>
        );
      case "permisos-dev":
        return isDev ? (
          <MasterPermissionPanel darkMode={darkMode} />
        ) : (
          <div className="text-center p-20 font-bold text-red-500">
            Acceso Restringido
          </div>
        );
      case "overview":
      default:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* WELCOME SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1
                  className={`text-3xl font-bold tracking-tight ${darkMode ? "text-white" : "text-slate-700"}`}
                >
                  ¡Bienvenido, {user?.nombre || "Usuario"}!
                </h1>
                <p
                  className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-700"}`}
                >
                  {new Date().toLocaleDateString("es-ES", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-lg border ${darkMode ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-slate-200"} flex items-center gap-3`}
              >
                <div
                  className={`w-2 h-2 rounded-full bg-green-500 animate-pulse`}
                />
                <span className="text-xs font-medium">Sistema Operativo</span>
              </div>
            </div>

            {/* ANNOUNCEMENT BANNER */}
            <div
              className="remaster-hero remaster-card relative overflow-hidden rounded-2xl p-8 shadow-xl shadow-red-900/20"
              style={{
                backgroundImage: `linear-gradient(90deg, ${announcementStartColor}, ${announcementBaseColor}, ${announcementEndColor})`,
              }}
            >
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-2">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm"
                    style={{ backgroundColor: announcementBadgeColor }}
                  >
                    {announcement.badge}
                  </span>
                  <h2 className="text-2xl font-bold text-white">
                    {announcement.title}
                  </h2>
                  <p className="text-red-100 max-w-xl text-sm leading-relaxed">
                    {announcement.description}
                  </p>
                </div>
                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20 flex items-center gap-4 shrink-0">
                  <div className="text-center px-4 border-r border-white/20">
                    <p className="text-[10px] text-red-200 uppercase font-bold">
                      Estado
                    </p>
                    <p className="text-xl font-bold text-white uppercase">
                      {announcement.status}
                    </p>
                  </div>
                  <div className="text-center px-4">
                    <p className="text-[10px] text-red-200 uppercase font-bold">
                      Urgencia
                    </p>
                    <p className="text-xl font-bold text-white uppercase">
                      {announcement.urgency}
                    </p>
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none" />
            </div>

            {/* MANAGEMENT HISTORY / STRUCTURE GRID */}
            <div
              className={`rounded-2xl border ${darkMode ? "bg-zinc-900/30 border-zinc-800" : "bg-white border-slate-200"} overflow-hidden`}
            >
              <div
                className={`px-6 py-4 border-b ${darkMode ? "border-zinc-800" : "border-slate-100"} flex justify-between items-center`}
              >
                <div>
                  <h3
                    className={`font-bold text-base ${darkMode ? "text-slate-200" : "text-slate-800"}`}
                  >
                    Trazabilidad de Gerencias
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historial de estructura y departamentos institucionales
                  </p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {effectiveOrgStructure.length > 0 ? (
                  effectiveOrgStructure.map((group: OrgCategory, index: number) => (
                    <DeptCard
                      key={index}
                      group={group}
                      darkMode={darkMode}
                      onToggle={() => toggleCategory(index)}
                      onItemClick={(item) => setSelectedManagement(item)}
                    />
                  ))
                ) : (
                  <div className={`col-span-full rounded-xl border p-6 text-sm ${darkMode ? "border-zinc-800 text-slate-400" : "border-slate-200 text-slate-500"}`}>
                    No hay gerencias disponibles para tu perfil en este momento.
                  </div>
                )}
              </div>
            </div>

            {/* QUICK ACTIONS & EXTERNAL LINKS */}
            <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="https://workspace.google.com/intl/es-419/gmail/"
                target="_blank"
                rel="noopener noreferrer"
                className={`glass-hover p-4 rounded-xl border flex items-center gap-4 transition-all group ${darkMode ? "bg-zinc-900 border-zinc-800 hover:border-red-900/50 hover:bg-zinc-800/50" : "bg-white border-slate-200 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/5"}`}
              >
                <div
                  className={`p-3 rounded-lg ${darkMode ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"} group-hover:scale-110 transition-transform`}
                >
                  <Mail size={24} />
                </div>
                <div>
                  <p
                    className={`font-bold text-sm ${darkMode ? "text-white" : "text-slate-900"}`}
                  >
                    Correo Corporativo
                  </p>
                  <p
                    className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}
                  >
                    Acceder a Gmail Workspace
                  </p>
                </div>
              </a>

              <a
                href="https://quillbot.com/es/corrector-ortografico"
                target="_blank"
                rel="noopener noreferrer"
                className={`glass-hover p-4 rounded-xl border flex items-center gap-4 transition-all group ${darkMode ? "bg-zinc-900 border-zinc-800 hover:border-blue-900/50 hover:bg-zinc-800/50" : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5"}`}
              >
                <div
                  className={`p-3 rounded-lg ${darkMode ? "bg-blue-900/20 text-blue-400" : "bg-blue-50 text-blue-600"} group-hover:scale-110 transition-transform`}
                >
                  <Sparkles size={24} />
                </div>
                <div>
                  <p
                    className={`font-bold text-sm ${darkMode ? "text-white" : "text-slate-900"}`}
                  >
                    Corrector Ortográfico
                  </p>
                  <p
                    className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}
                  >
                    Refinar redacción de oficios
                  </p>
                </div>
              </a>

              <button
                onClick={logout}
                className={`glass-hover p-4 rounded-xl border flex items-center gap-4 transition-all group text-left ${darkMode ? "bg-zinc-900 border-zinc-800 hover:border-slate-700 hover:bg-zinc-800/50" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-500/5"}`}
              >
                <div
                  className={`p-3 rounded-lg ${darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"} group-hover:scale-110 transition-transform`}
                >
                  <LogOut size={24} />
                </div>
                <div>
                  <p
                    className={`font-bold text-sm ${darkMode ? "text-white" : "text-slate-900"}`}
                  >
                    Cerrar Sesión
                  </p>
                  <p
                    className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}
                  >
                    Finalizar jornada laboral
                  </p>
                </div>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <RoleGuard
      allowedRoles={["CEO", "Administrativo", "Usuario", "Desarrollador", "Gerente"]}
      redirectTo="/login"
    >
      <div
        className={`min-h-screen remaster-shell ${theme.bg} ${theme.text} font-sans transition-colors duration-300`}
      >
        {/* SIDEBAR */}
        <aside
          className={`
        remaster-sidebar fixed top-0 left-0 bottom-0 z-50 ${theme.sidebar} border-r transition-all duration-300
        ${collapsed ? "w-16" : "w-64"}
      `}
        >
          <div className="flex flex-col h-full">
            {/* HEADER SIDEBAR */}
            <div
              className={`${collapsed ? "h-20" : "h-28"} flex items-center justify-center border-b ${darkMode ? "border-slate-800" : "border-slate-200"}`}
            >
              <div className="flex items-center">
                <div className={`${collapsed ? "w-12 h-12" : "w-20 h-20"} flex items-center justify-center shrink-0`}>
                  <img
                    src={darkMode ? "/corpoelecblanco.jpeg" : "/Corpoelecoscuro.jpeg"}
                    alt="Corpoelec"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "/logo-rojo.png";
                    }}
                  />
                </div>
              </div>
            </div>
            {/* NAVIGATION */}
            <nav className="flex-1 p-3 space-y-1">
              <SidebarItem
                icon={Home}
                label="Dashboard General"
                active={
                  activeSection === "dashboard" && activeTab === "overview"
                }
                collapsed={collapsed}
                darkMode={darkMode}
                onClick={() => {
                  setActiveSection("dashboard");
                  setActiveTab("overview");
                }}
              />
              {canAccessPriorities && (
                <SidebarItem
                  icon={Flag}
                  label="Control de seguimiento"
                  active={
                    activeSection === "dashboard" && activeTab === "prioridades"
                  }
                  collapsed={collapsed}
                  darkMode={darkMode}
                  onClick={() => {
                    setActiveSection("dashboard");
                    setActiveTab("prioridades");
                  }}
                />
              )}
              {canAccessTickets && (
                <SidebarItem
                  icon={Tag}
                  label="Sistema de Tickets"
                  active={
                    activeSection === "dashboard" && activeTab === "tickets"
                  }
                  collapsed={collapsed}
                  darkMode={darkMode}
                  onClick={() => {
                    setActiveSection("dashboard");
                    setActiveTab("tickets");
                  }}
                />
              )}
              <SidebarItem
                icon={Mail}
                label="Mensajería Interna"
                active={
                  activeSection === "dashboard" && activeTab === "documentos"
                }
                collapsed={collapsed}
                darkMode={darkMode}
                onClick={() => {
                  setActiveSection("dashboard");
                  setActiveTab("documentos");
                }}
              />
              {canAccessSecurity && (
                <SidebarItem
                  icon={Shield}
                  label="Módulo de Seguridad"
                  active={
                    activeSection === "dashboard" && activeTab === "seguridad"
                  }
                  collapsed={collapsed}
                  darkMode={darkMode}
                  onClick={() => {
                    setActiveSection("dashboard");
                    setActiveTab("seguridad");
                  }}
                />
              )}
              {canAccessStats && (
                <SidebarItem
                  icon={BarChart2}
                  label="Gráficos"
                  active={activeTab === "graficos"}
                  collapsed={collapsed}
                  darkMode={darkMode}
                  onClick={() => {
                    setActiveSection("dashboard");
                    setActiveTab("graficos");
                  }}
                />
              )}

              {hasPermission(PERMISSIONS_MASTER.SYS_DEV_TOOLS) && (
                <SidebarItem
                  icon={Shield}
                  label="Configuración Maestra"
                  active={activeTab === "permisos-dev"}
                  collapsed={collapsed}
                  darkMode={darkMode}
                  onClick={() => {
                    setActiveSection("dashboard");
                    setActiveTab("permisos-dev");
                  }}
                />
              )}
            </nav>
            {/* FOOTER SIDEBAR */}
            <div
              className={`p-3 border-t ${darkMode ? "border-slate-800" : "border-slate-200"}`}
            >
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={`
                w-full flex items-center justify-center h-9 rounded-md transition-colors
                ${darkMode
                    ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }
              `}
              >
                <ChevronRight
                  size={18}
                  className={`transition-transform duration-300 ${!collapsed && "rotate-180"}`}
                />
              </button>
            </div>
          </div>
        </aside>
        {/* MAIN CONTENT */}
        <main
          className={`transition-all duration-300 ${collapsed ? "ml-16" : "ml-64"} min-h-screen ${theme.bg} flex flex-col`}
        >
          {/* TOP HEADER */}
          <header
            className={`
          remaster-topbar sticky top-0 z-40 h-16 px-6 flex items-center justify-between ${theme.header} border-b shrink-0
        `}
          >
            <div className="flex items-center gap-4">
              <h2
                className={`font-semibold text-sm ${darkMode ? "text-slate-200" : "text-slate-800"}`}
              >
                Sistema de Gestión Documentos{" "}
                <span className="mx-2 text-slate-500">|</span>{" "}
                <span className="text-slate-500 font-normal">
                  Alfa 2026 V-1.0
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle
                darkMode={darkMode}
                onToggle={() => setDarkMode(!darkMode)}
              />
              <div
                className={`h-6 w-px ${darkMode ? "bg-slate-800" : "bg-slate-300"}`}
              />
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-slate-100/10 p-1 rounded-md transition-colors"
                onClick={async () => {
                  const ok = await uiConfirm("¿Desea cerrar sesión?", "Cerrar sesión");
                  if (ok) {
                    void logout();
                  }
                }}
              >
                <div className="text-right hidden sm:block leading-tight">
                  <p
                    className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-900"}`}
                  >
                    {user?.nombre} {user?.apellido}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    {userRole === "Desarrollador" && (
                      <span className="text-[10px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded animate-pulse">
                        DEV MODE
                      </span>
                    )}
                    <p
                      className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}
                    >
                      {userRole.toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* ROLE SWITCHER dropdown - visible for admins and persona-switchers */}
                {hasPermission(PERMISSIONS_MASTER.SYS_SWITCH_ROLE) &&
                  userRole === "Desarrollador" && (
                    <div
                      className="flex items-center gap-1 border-l pl-3 border-slate-700 ml-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={userRole}
                        onChange={async (e) => {
                          const ok = await switchRole(e.target.value as UserRole);
                          if (!ok) {
                            void uiAlert("SwitchRole deshabilitado en este entorno por seguridad. Usa staging/dev con NEXT_PUBLIC_ENABLE_ROLE_SIMULATION=true.", "Seguridad");
                          }
                        }}
                        className={`bg-transparent text-[10px] font-bold border rounded px-1 outline-none transition-colors ${darkMode ? "border-zinc-700 text-zinc-400 focus:border-red-500" : "border-slate-300 text-slate-600 focus:border-red-600"}`}
                      >
                        <option value="Usuario">USR</option>
                        <option value="Administrativo">ADM</option>
                        <option value="Gerente">GER</option>
                        <option value="CEO">CEO</option>
                        <option value="Desarrollador">DEV</option>
                      </select>
                    </div>
                  )}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-offset-2 ring-offset-transparent ring-slate-200/20 ${userRole === "CEO" ? "bg-red-800" : userRole === "Administrativo" ? "bg-amber-600" : "bg-blue-600"}`}
                >
                  {user?.nombre?.substring(0, 1)}
                  {user?.apellido?.substring(0, 1)}
                </div>
              </div>
            </div>
          </header>
          {/* WORKSPACE */}
          <div className={`remaster-workspace p-6 md:p-8 w-full max-w-[1600px] mx-auto space-y-8 flex-1 transition-all duration-300 ${isChatOpen ? "xl:pr-[430px]" : ""}`}>
            {/* BREADCRUMB / TITLE */}
            {/* BREADCRUMB / TITLE - Hidden on overview as it has its own welcome header, and on graficos as it has internal headers */}
            {activeTab !== "overview" &&
              activeTab !== "graficos" &&
              activeTab !== "permisos-dev" && (
                <div className="flex justify-between items-center pb-6 border-b border-slate-200/10">
                  <div>
                    <h1
                      className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}
                    >
                      {activeTab === "prioridades"
                        ? "Control de seguimiento"
                        : activeTab === "tickets"
                          ? "Sistema de Tickets"
                          : activeTab === "documentos"
                            ? "Mensajería Interna"
                            : activeTab === "seguridad"
                              ? "Módulo de Seguridad"
                              : activeTab === "impresoras"
                                ? "Control de Impresoras y Toners"
                                : "Panel Detalle"}
                    </h1>
                    <p
                      className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {activeTab === "prioridades"
                        ? "Control de seguimiento de documentos con prioridad."
                        : activeTab === "tickets"
                          ? "Gestión de solicitudes técnicas y administrativas."
                          : activeTab === "documentos"
                            ? "Administración de correspondencia y comunicación interna."
                            : activeTab === "seguridad"
                              ? "Gestión de usuarios, permisos y auditoría de seguridad."
                              : activeTab === "impresoras"
                                ? "Monitoreo del estado operativo de impresoras y niveles de suministros."
                                : "Vista de detalles del Módulo seleccionado."}
                    </p>
                  </div>
                </div>
              )}
            {/* CONTENT AREA */}
            {renderContent()}
          </div>
        </main>

        {/* OK: Integra el bot de ayuda al final del componente */}
        <BotButton onOpenChat={() => setIsChatOpen(true)} />
        <ChatWindow
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          userRole={userRole}
        />

        {/* MODAL DE DETALLE DE GERENCIA */}
        <DetailModal
          isOpen={!!selectedManagement}
          onClose={() => setSelectedManagement(null)}
          title={selectedManagement || ""}
          functions={
            selectedManagement && managementDetailsMap[selectedManagement]
              ? managementDetailsMap[selectedManagement]
              : selectedManagement
                ? getDefaultFunctions(selectedManagement)
                : []
          }
          darkMode={darkMode}
          canEdit={canEditManagementDetails}
          onSave={handleSaveManagementDetails}
        />
      </div>
    </RoleGuard>
  );
}
