import type { JoursFormation, JourKey, JourPref } from '../../types/ab'

interface Props {
  value:    JoursFormation
  onChange: (next: JoursFormation) => void
}

const JOURS: { key: JourKey; label: string }[] = [
  { key: 'lundi',    label: 'Lundi' },
  { key: 'mardi',    label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi',    label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
]

const PREFS: { value: JourPref; label: string; color: string; bg: string }[] = [
  { value: 'prefere', label: 'Préféré',  color: '#1A1AE6', bg: 'rgba(26,26,230,0.1)' },
  { value: 'oui',     label: 'Oui',      color: '#00BCD4', bg: 'rgba(0,188,212,0.1)' },
  { value: 'non',     label: 'Non',      color: '#999',    bg: '#F2F2F2' },
]

export default function JoursFormation({ value, onChange }: Props) {
  function setJour(jour: JourKey, pref: JourPref) {
    onChange({ ...value, [jour]: pref })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {JOURS.map(({ key, label }) => {
        const current = value[key]
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 80, fontSize: 14, fontWeight: 500, color: '#333' }}>{label}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {PREFS.map(pref => {
                const active = current === pref.value
                return (
                  <button
                    key={pref.value}
                    type="button"
                    onClick={() => setJour(key, pref.value)}
                    style={{
                      padding: '6px 18px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      fontWeight: active ? 700 : 400,
                      border: `2px solid ${active ? pref.color : '#ddd'}`,
                      background: active ? pref.bg : '#fff',
                      color: active ? pref.color : '#777',
                      transition: 'all 0.15s',
                    }}
                  >
                    {pref.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
