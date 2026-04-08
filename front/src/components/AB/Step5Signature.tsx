import type { ABFormState } from '../../types/ab'

interface Props {
  state:    ABFormState
  onChange: (patch: Partial<ABFormState>) => void
}

const C = { blue: '#1A1AE6', violet: '#6B2FD9', night: '#1A1A2E', error: '#E91E8C', cyan: '#00BCD4' }
const sectionStyle: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid #ddd', borderRadius: 6, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }

const CLAUSE_TEXT = `Dans le cadre de notre partenariat, l'entreprise s'engage à respecter les conditions suivantes :

**1. Engagement pédagogique**
L'entreprise s'engage à accompagner l'apprenti dans l'acquisition des compétences professionnelles définies dans le référentiel de formation, à lui confier des missions en adéquation avec sa formation et à désigner un maître d'apprentissage référent.

**2. Engagement d'adaptation**
L'entreprise s'engage à adapter les missions de l'apprenti à son niveau de progression tout au long du contrat, à participer aux évaluations et bilans organisés par Disciplina, et à signaler toute difficulté rencontrée.

**3. Réajustement du parcours**
En cas de difficulté avérée, l'entreprise accepte de participer aux démarches de réajustement proposées par Disciplina, dans l'intérêt de l'apprenti et de la bonne exécution du contrat d'apprentissage.

**4. Confidentialité**
Les informations partagées dans le cadre de cette Analyse de Besoin sont strictement confidentielles et ne seront utilisées que dans le cadre du recrutement d'un apprenti par Disciplina. Elles ne seront transmises à aucun tiers sans l'accord exprès de l'entreprise.

Les données personnelles collectées sont traitées conformément au Règlement Général sur la Protection des Données (RGPD - UE 2016/679). L'entreprise dispose d'un droit d'accès, de rectification et de suppression de ses données en contactant Disciplina.`

const ENGAGEMENTS = [
  { field: 'engagement_evolution',    label: "Je m'engage à accompagner l'évolution pédagogique de l'apprenti tout au long de son parcours." },
  { field: 'engagement_adaptation',   label: "Je m'engage à adapter les missions confiées à l'apprenti en fonction de sa progression." },
  { field: 'engagement_reajustement', label: "J'accepte de participer à toute démarche de réajustement si des difficultés venaient à apparaître." },
] as const

export function validateStep5(state: ABFormState): string[] {
  const errors: string[] = []
  if (!state.engagement_evolution)    errors.push("L'engagement d'évolution pédagogique est obligatoire")
  if (!state.engagement_adaptation)   errors.push("L'engagement d'adaptation est obligatoire")
  if (!state.engagement_reajustement) errors.push("L'engagement de réajustement est obligatoire")
  if (!state.clause_confidentialite)  errors.push("L'acceptation de la clause de confidentialité est obligatoire")
  if (!state.lieu_signature.trim())   errors.push("Le lieu de signature est obligatoire")
  if (!state.date_signature)          errors.push("La date de signature est obligatoire")
  return errors
}

export default function Step5Signature({ state, onChange }: Props) {
  return (
    <div>
      {/* Clause confidentialité */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Clause de confidentialité et engagements</h3>
        <div
          style={{
            background: '#f8f9ff', border: `1px solid ${C.blue}22`, borderRadius: 6,
            padding: '16px 20px', maxHeight: 280, overflowY: 'auto',
            fontSize: 13, lineHeight: 1.7, color: '#444', whiteSpace: 'pre-line',
            marginBottom: 20,
          }}
        >
          {CLAUSE_TEXT.replace(/\*\*(.*?)\*\*/g, '$1')}
        </div>

        {/* Engagements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {ENGAGEMENTS.map(({ field, label }) => (
            <label
              key={field}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                padding: '12px 16px', borderRadius: 6,
                background: state[field] ? 'rgba(26,26,230,0.05)' : '#fafafa',
                border: `1px solid ${state[field] ? C.blue : '#eee'}`,
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={state[field]}
                onChange={e => onChange({ [field]: e.target.checked })}
                style={{ marginTop: 2, accentColor: C.blue, flexShrink: 0, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{label}</span>
            </label>
          ))}

          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
              padding: '12px 16px', borderRadius: 6,
              background: state.clause_confidentialite ? 'rgba(107,47,217,0.05)' : '#fafafa',
              border: `1px solid ${state.clause_confidentialite ? C.violet : '#eee'}`,
              transition: 'all 0.15s',
            }}
          >
            <input
              type="checkbox"
              checked={state.clause_confidentialite}
              onChange={e => onChange({ clause_confidentialite: e.target.checked })}
              style={{ marginTop: 2, accentColor: C.violet, flexShrink: 0, width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5, fontWeight: 600 }}>
              J'ai pris connaissance de la clause de confidentialité et j'accepte les conditions de traitement de mes données personnelles conformément au RGPD.
            </span>
          </label>
        </div>
      </div>

      {/* Lieu et date */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.night }}>Informations de signature</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Fait à (ville) *</label>
            <input
              style={inputStyle}
              placeholder="Saint-Denis, La Réunion"
              value={state.lieu_signature}
              onChange={e => onChange({ lieu_signature: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Le (date) *</label>
            <input
              style={inputStyle}
              type="date"
              value={state.date_signature}
              onChange={e => onChange({ date_signature: e.target.value })}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 20, padding: '12px 16px', borderRadius: 6,
            background: 'rgba(0,188,212,0.08)', border: `1px solid ${C.cyan}`,
            fontSize: 13, color: '#333',
          }}
        >
          ✉️ Après soumission, vous recevrez un email contenant le lien de signature électronique via YouSign.
          La signature est obligatoire pour finaliser votre Analyse de Besoin.
        </div>
      </div>
    </div>
  )
}
