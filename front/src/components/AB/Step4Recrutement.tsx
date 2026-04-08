import type { ABFormState } from '../../types/ab'
import JoursFormationComp from './JoursFormation'

interface Props {
  state:    ABFormState
  onChange: (patch: Partial<ABFormState>) => void
}

const C = { blue: '#1A1AE6', violet: '#6B2FD9', night: '#1A1A2E' }
const sectionStyle: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }

function ToggleGroup({
  options, value, onChange,
}: {
  options: { value: string; label: string; desc?: string }[]
  value:   string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
              textAlign: 'left',
            }}
          >
            <div>{opt.label}</div>
            {opt.desc && <div style={{ fontSize: 11, color: '#888', fontWeight: 400, marginTop: 2 }}>{opt.desc}</div>}
          </button>
        )
      })}
    </div>
  )
}

export function validateStep4(_state: ABFormState): string[] {
  return [] // All optional
}

export default function Step4Recrutement({ state, onChange }: Props) {
  return (
    <div>
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, color: C.night }}>Méthode de recrutement souhaitée</h3>
        <ToggleGroup
          options={[
            { value: 'tous_cv',       label: 'Réception de tous les CV',     desc: 'Disciplina envoie tous les profils disponibles' },
            { value: 'preselection',  label: 'Présélection',                 desc: 'Disciplina présélectionne les CV avant envoi' },
            { value: 'pre_entretien', label: 'Pré-entretien Disciplina',      desc: 'Disciplina réalise un pré-entretien avant de vous proposer les candidats' },
          ]}
          value={state.methode_recrutement}
          onChange={methode_recrutement => onChange({ methode_recrutement })}
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, color: C.night }}>PMSMP (Période de Mise en Situation en Milieu Professionnel)</h3>
        <ToggleGroup
          options={[
            { value: 'oui',        label: 'Oui',         desc: 'L\'entreprise accepte d\'accueillir des candidats en immersion' },
            { value: 'non',        label: 'Non' },
            { value: 'a_discuter', label: 'À discuter' },
          ]}
          value={state.pmsmp}
          onChange={pmsmp => onChange({ pmsmp })}
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Jours de formation possibles</h3>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
          Indiquez vos préférences pour le jour de formation en CFA (1 jour / semaine).
        </p>
        <JoursFormationComp
          value={state.jours_formation}
          onChange={jours_formation => onChange({ jours_formation })}
        />
      </div>
    </div>
  )
}
