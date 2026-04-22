export const COMMUNITY_ROLE_OPTIONS = [
  "CEO",
  "Administrativo",
  "Gerente",
  "Usuario",
  "Desarrollador",
] as const;

export type CommunityRole = (typeof COMMUNITY_ROLE_OPTIONS)[number];

export interface CommunityChannelConfig {
  id: string;
  label: string;
  description: string;
  visibility: "public" | "private";
  allowed_roles: CommunityRole[];
}

export const DEFAULT_COMMUNITY_CHANNELS: CommunityChannelConfig[] = [
  {
    id: "overview",
    label: "Dashboard General",
    description: "Vista principal de resumen institucional.",
    visibility: "public",
    allowed_roles: [...COMMUNITY_ROLE_OPTIONS],
  },
  {
    id: "tickets",
    label: "Sistema de Tickets",
    description: "Canal operativo para incidencias y solicitudes.",
    visibility: "public",
    allowed_roles: [...COMMUNITY_ROLE_OPTIONS],
  },
  {
    id: "documentos",
    label: "Mensajería Interna",
    description: "Canal de correspondencia y documentos internos.",
    visibility: "public",
    allowed_roles: [...COMMUNITY_ROLE_OPTIONS],
  },
  {
    id: "prioridades",
    label: "Control de Seguimiento",
    description: "Canal para trazabilidad y prioridades.",
    visibility: "public",
    allowed_roles: [...COMMUNITY_ROLE_OPTIONS],
  },
  {
    id: "graficos",
    label: "Gráficos",
    description: "Canal analítico y de métricas.",
    visibility: "public",
    allowed_roles: ["CEO", "Desarrollador"],
  },
  {
    id: "hoja-de-ruta",
    label: "Hoja de Ruta",
    description: "Canal de planificación y seguimiento estratégico.",
    visibility: "public",
    allowed_roles: [...COMMUNITY_ROLE_OPTIONS],
  },
  {
    id: "facturacion",
    label: "Módulo de Facturación",
    description: "Canal financiero y de reportes de facturación.",
    visibility: "public",
    allowed_roles: [...COMMUNITY_ROLE_OPTIONS],
  },
  {
    id: "seguridad",
    label: "Módulo de Seguridad",
    description: "Canal restringido para auditoría, usuarios y seguridad.",
    visibility: "public",
    allowed_roles: ["Administrativo", "Desarrollador", "CEO"],
  },
];

