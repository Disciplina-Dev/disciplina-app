import { useState } from 'react'
import type { ABFormState, ContactForm } from '../../types/ab'
import { lookupSiret } from '../../services/siretService'

interface Props {
  state:    ABFormState
  onChange: (patch: Partial<ABFormState>) => void
}

const C = { blue: '#1A1AE6', violet: '#6B2FD9', grey: '#F2F2F2', night: '#1A1A2E', error: '#E91E8C' }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid #ddd', borderRadius: 6, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#333', marginBottom: 6,
}

const sectionStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #eee', borderRadius: 8,
  padding: '20px 24px', marginBottom: 20,
}

function ContactBlock({
  title, value, onChange,
}: {
  title: string
  value: ContactForm
  onChange: (next: ContactForm) => void
}) {
  function set(field: keyof ContactForm, v: string) {
    onChange({ ...value, [field]: v })
  }
  return (
    <div style={sectionStyle}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={labelStyle}>Nom &amp; Prénom *</label>
          <input style={inputStyle} value={value.nom_prenom} onChange={e => set('nom_prenom', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Fonction</label>
          <input style={inputStyle} value={value.fonction} onChange={e => set('fonction', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Téléphone</label>
          <input style={inputStyle} type="tel" value={value.telephone} onChange={e => set('telephone', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={value.email} onChange={e => set('email', e.target.value)} />
        </div>
      </div>
    </div>
  )
}

export function validateStep1(state: ABFormState): string[] {
  const errors: string[] = []
  if (!state.raison_sociale.trim()) errors.push('La raison sociale est obligatoire')
  if (!state.representant_legal.nom_prenom.trim()) errors.push('Le nom du représentant légal est obligatoire')
  if (!state.responsable_recrutement.nom_prenom.trim() && !state.meme_que_rl)
    errors.push('Le nom du responsable de recrutement est obligatoire')
  return errors
}

export default function Step1Entreprise({ state, onChange }: Props) {
  const [siretLoading, setSiretLoading] = useState(false)
  const [siretError,   setSiretError]   = useState('')

  async function handleSiretSearch() {
    setSiretError('')
    if (!/^\d{14}$/.test(state.siret)) {
      setSiretError('Le SIRET doit contenir exactement 14 chiffres')
      return
    }
    setSiretLoading(true)
    try {
      const data = await lookupSiret(state.siret)
      onChange({
        raison_sociale:       data.raison_sociale,
        adresse:              data.adresse ?? '',
        code_postal:          data.code_postal ?? '',
        commune:              data.commune ?? '',
        description_activite: data.description_activite ?? '',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SIRET introuvable'
      setSiretError(msg + ' — remplissez les champs manuellement.')
    } finally {
      setSiretLoading(false)
    }
  }

  function toggleMemeQueRL(checked: boolean) {
    onChange({
      meme_que_rl: checked,
      responsable_recrutement: checked ? { ...state.representant_legal } : { nom_prenom: '', fonction: '', telephone: '', email: '' },
    })
  }

  return (
    <div>
      {/* SIRET */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Identification de l'entreprise</h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Numéro SIRET (14 chiffres)</label>
            <input
              style={inputStyle}
              value={state.siret}
              maxLength={14}
              placeholder="ex : 12345678901234"
              onChange={e => onChange({ siret: e.target.value.replace(/\D/g, '') })}
              onKeyDown={e => e.key === 'Enter' && handleSiretSearch()}
            />
            {siretError && <p style={{ color: C.error, fontSize: 12, margin: '4px 0 0' }}>{siretError}</p>}
          </div>
          <button
            type="button"
            disabled={siretLoading}
            onClick={handleSiretSearch}
            style={{
              padding: '10px 20px', fontSize: 14, borderRadius: 6, cursor: 'pointer',
              background: C.blue, color: '#fff', border: 'none', fontWeight: 600,
              opacity: siretLoading ? 0.7 : 1, whiteSpace: 'nowrap',
            }}
          >
            {siretLoading ? 'Recherche…' : 'Rechercher'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Raison sociale *</label>
            <input style={inputStyle} value={state.raison_sociale} onChange={e => onChange({ raison_sociale: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Adresse</label>
            <input style={inputStyle} value={state.adresse} onChange={e => onChange({ adresse: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Code postal</label>
            <input style={inputStyle} value={state.code_postal} maxLength={5} onChange={e => onChange({ code_postal: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Commune</label>
            <input style={inputStyle} value={state.commune} onChange={e => onChange({ commune: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description de l'activité</label>
            <textarea
              style={{ ...inputStyle, height: 80, resize: 'vertical' }}
              value={state.description_activite}
              onChange={e => onChange({ description_activite: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Représentant légal */}
      <ContactBlock
        title="Représentant légal *"
        value={state.representant_legal}
        onChange={rl => onChange({ representant_legal: rl, responsable_recrutement: state.meme_que_rl ? rl : state.responsable_recrutement })}
      />

      {/* Responsable recrutement */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: C.night }}>Responsable de recrutement *</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#555' }}>
            <input
              type="checkbox"
              checked={state.meme_que_rl}
              onChange={e => toggleMemeQueRL(e.target.checked)}
              style={{ accentColor: C.blue }}
            />
            Même que le représentant légal
          </label>
        </div>

        {!state.meme_que_rl && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {(['nom_prenom', 'fonction', 'telephone', 'email'] as (keyof ContactForm)[]).map(field => (
              <div key={field}>
                <label style={labelStyle}>
                  {field === 'nom_prenom' ? 'Nom & Prénom *' : field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  style={inputStyle}
                  type={field === 'email' ? 'email' : field === 'telephone' ? 'tel' : 'text'}
                  value={state.responsable_recrutement[field]}
                  onChange={e => onChange({ responsable_recrutement: { ...state.responsable_recrutement, [field]: e.target.value } })}
                />
              </div>
            ))}
          </div>
        )}
        {state.meme_que_rl && (
          <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
            Identique au représentant légal : <strong>{state.representant_legal.nom_prenom}</strong>
          </p>
        )}
      </div>
    </div>
  )
}
