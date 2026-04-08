import type { ABFormState } from '../../types/ab'

interface Props {
  state:    ABFormState
  onChange: (patch: Partial<ABFormState>) => void
}

const C = { blue: '#1A1AE6', violet: '#6B2FD9', night: '#1A1A2E', error: '#E91E8C' }
const sectionStyle: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }

function ToggleGroup({
  options, value, onChange,
}: {
  options: { value: string; label: string }[]
  value:   string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? '' : opt.value)}
            style={{
              padding: '10px 22px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
              fontWeight: active ? 700 : 400,
              border: `2px solid ${active ? C.blue : '#ddd'}`,
              background: active ? 'rgba(26,26,230,0.08)' : '#fff',
              color: active ? C.blue : '#555',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function validateStep3(_state: ABFormState): string[] {
  return [] // All optional
}

export default function Step3Apprenti({ state, onChange }: Props) {
  return (
    <div>
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, color: C.night }}>Profil de l'apprenti recherché</h3>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Âge exigé</label>
          <ToggleGroup
            options={[
              { value: '18_20',          label: '18 – 20 ans' },
              { value: '21_25',          label: '21 – 25 ans' },
              { value: '26_29',          label: '26 – 29 ans' },
              { value: 'sans_preference', label: 'Sans préférence' },
            ]}
            value={state.age_exige}
            onChange={age_exige => onChange({ age_exige })}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Permis de conduire</label>
          <ToggleGroup
            options={[
              { value: 'obligatoire', label: 'Obligatoire' },
              { value: 'optionnel',   label: 'Optionnel' },
              { value: 'non_requis',  label: 'Non requis' },
            ]}
            value={state.permis}
            onChange={permis => onChange({ permis })}
          />
        </div>

        <div>
          <label style={labelStyle}>Expérience professionnelle</label>
          <ToggleGroup
            options={[
              { value: 'debutant',    label: 'Débutant accepté' },
              { value: 'obligatoire', label: 'Expérience obligatoire' },
            ]}
            value={state.experience}
            onChange={experience => onChange({ experience })}
          />
        </div>
      </div>
    </div>
  )
}
