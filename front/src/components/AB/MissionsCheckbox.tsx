import { MISSIONS, getMissionsKey, getMissionLabel } from '../../constants/missions'
import type { Domaine, Niveau } from '../../types/ab'

interface Props {
  domaine:        Domaine
  niveau:         Niveau
  checked:        string[]
  onChange:       (next: string[]) => void
}

const C = { blue: '#1A1AE6', violet: '#6B2FD9', grey: '#F2F2F2', night: '#1A1A2E', text: '#333' }

export default function MissionsCheckbox({ domaine, niveau, checked, onChange }: Props) {
  const key      = getMissionsKey(domaine, niveau)
  const missions = MISSIONS[domaine][key] ?? []
  const label    = getMissionLabel(domaine, niveau)

  function toggle(mission: string) {
    if (checked.includes(mission)) {
      onChange(checked.filter(m => m !== mission))
    } else {
      onChange([...checked, mission])
    }
  }

  function toggleAll() {
    if (checked.length === missions.length) {
      onChange([])
    } else {
      onChange([...missions])
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
          Profil : <strong style={{ color: C.violet }}>{label}</strong>
        </p>
        <button
          type="button"
          onClick={toggleAll}
          style={{
            fontSize: 12, padding: '4px 12px', borderRadius: 4,
            border: `1px solid ${C.violet}`, background: 'transparent',
            color: C.violet, cursor: 'pointer',
          }}
        >
          {checked.length === missions.length ? 'Tout décocher' : 'Tout cocher'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {missions.map(mission => (
          <label
            key={mission}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              padding: '8px 12px', borderRadius: 6,
              background: checked.includes(mission) ? 'rgba(26,26,230,0.06)' : C.grey,
              border: `1px solid ${checked.includes(mission) ? C.blue : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            <input
              type="checkbox"
              checked={checked.includes(mission)}
              onChange={() => toggle(mission)}
              style={{ marginTop: 3, accentColor: C.blue, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{mission}</span>
          </label>
        ))}
      </div>

      <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
        {checked.length} / {missions.length} mission{checked.length > 1 ? 's' : ''} sélectionnée{checked.length > 1 ? 's' : ''}
      </p>
    </div>
  )
}
