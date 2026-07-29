export const AB_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  BROUILLON:            { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Brouillon' },
  EN_ATTENTE_SIGNATURE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente de signature' },
  SIGNE:                { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Signé' },
  EXPIRE:               { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Expiré' },
}
