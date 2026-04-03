export const TP_COLORS = {
  SA:  { bg: "#E8EBFA", text: "#1130A7", label: "SA"  },
  CC:  { bg: "#FAE4ED", text: "#B10F55", label: "CC"  },
  NTC: { bg: "#F0E6F6", text: "#60207E", label: "NTC" },
  REM: { bg: "#E0F7FA", text: "#006978", label: "REM" },
  AD:  { bg: "#E3F0FC", text: "#0D3F7A", label: "AD"  },
} as const

export const STATUTS = {
  EN_COURS:   { label: "En cours",   color: "#A65C00" },
  VALIDE:     { label: "Validé",     color: "#1A7A4A" },
  EN_ATTENTE: { label: "En attente", color: "#6B6B6B" },
  PLACE:      { label: "Placé",      color: "#60207E" },
} as const

export const TP_LIST = ["SA", "CC", "NTC", "REM", "AD"] as const
export type TPType = keyof typeof TP_COLORS
export type StatutType = keyof typeof STATUTS
