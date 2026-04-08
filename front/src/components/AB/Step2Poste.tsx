import type { ABFormState, Domaine, Niveau } from '../../types/ab'
import MissionsCheckbox from './MissionsCheckbox'

interface Props {
  state:    ABFormState
  onChange: (patch: Partial<ABFormState>) => void
}

const C = { blue: '#1A1AE6', violet: '#6B2FD9', night: '#1A1A2E', grey: '#F2F2F2', error: '#E91E8C' }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid #ddd', borderRadius: 6, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const sectionStyle: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }

function RadioGroup<T extends string>({
  options, value, onChange, required,
}: {
  options: { value: T; label: string }[]
  value: T | ''
  onChange: (v: T) => void
  required?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
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
      {required && !value && (
        <span style={{ fontSize: 12, color: C.error, alignSelf: 'center' }}>Champ obligatoire</span>
      )}
    </div>
  )
}

export function validateStep2(state: ABFormState): string[] {
  const errors: string[] = []
  if (!state.domaine) errors.push('Le domaine est obligatoire')
  if (!state.niveau)  errors.push('Le niveau est obligatoire')
  return errors
}

export default function Step2Poste({ state, onChange }: Props) {
  const showMissions = !!(state.domaine && state.niveau)

  return (
    <div>
      {/* Domaine + Niveau */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Formation visée *</h3>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Domaine *</label>
          <RadioGroup<Domaine>
            options={[
              { value: 'secretariat', label: 'Secrétariat' },
              { value: 'vente',       label: 'Vente' },
            ]}
            value={state.domaine}
            onChange={domaine => onChange({ domaine, missions_cochees: [] })}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Niveau *</label>
          <RadioGroup<Niveau>
            options={[
              { value: 'bac',  label: 'Bac' },
              { value: 'bac2', label: 'Bac+2' },
              ...(state.domaine === 'vente' ? [{ value: 'bac3' as Niveau, label: 'Bac+3' }] : []),
            ]}
            value={state.niveau}
            onChange={niveau => onChange({ niveau, missions_cochees: [] })}
            required
          />
        </div>
      </div>

      {/* Infos poste */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Informations sur le poste</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Intitulé du métier</label>
            <input style={inputStyle} value={state.intitule_metier} onChange={e => onChange({ intitule_metier: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Localisation du poste</label>
            <input style={inputStyle} value={state.localisation_poste} onChange={e => onChange({ localisation_poste: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Nombre de postes</label>
            <input
              style={inputStyle} type="number" min={1} max={99}
              value={state.nb_postes}
              onChange={e => onChange({ nb_postes: Math.max(1, parseInt(e.target.value) || 1) })}
            />
          </div>
        </div>
      </div>

      {/* Tableau des missions */}
      {showMissions && (
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Tableau des missions</h3>
          <MissionsCheckbox
            domaine={state.domaine as Domaine}
            niveau={state.niveau as Niveau}
            checked={state.missions_cochees}
            onChange={missions_cochees => onChange({ missions_cochees })}
          />
        </div>
      )}

      {/* Textes libres */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Détails complémentaires</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(
            [
              { field: 'description_missions', label: 'Description des missions' },
              { field: 'profil_recherche',     label: 'Profil recherché' },
              { field: 'competences',          label: 'Compétences et savoir-être attendus' },
              { field: 'commentaires',         label: 'Commentaires / informations complémentaires' },
            ] as { field: keyof ABFormState; label: string }[]
          ).map(({ field, label }) => (
            <div key={field as string}>
              <label style={labelStyle}>{label}</label>
              <textarea
                style={{ ...inputStyle, height: 80, resize: 'vertical' }}
                value={state[field] as string}
                onChange={e => onChange({ [field]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
