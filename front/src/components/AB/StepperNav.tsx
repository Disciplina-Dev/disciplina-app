import React from 'react'

const STEPS = [
  { label: 'Identité entreprise' },
  { label: 'Le poste' },
  { label: "L'apprenti" },
  { label: 'Recrutement' },
  { label: 'Signature' },
]

interface Props {
  currentStep: number  // 1-based
}

const C = {
  blue:    '#1A1AE6',
  violet:  '#6B2FD9',
  night:   '#1A1A2E',
  grey:    '#F2F2F2',
  white:   '#FFFFFF',
  text:    '#555',
}

export default function StepperNav({ currentStep }: Props) {
  const progress = Math.round((currentStep / STEPS.length) * 100)

  return (
    <div style={{ background: C.white, borderBottom: `1px solid ${C.grey}`, padding: '0 40px' }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: C.grey, borderRadius: 2, marginBottom: 0 }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${C.blue}, ${C.violet})`,
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
        {STEPS.map((step, i) => {
          const num    = i + 1
          const done   = num < currentStep
          const active = num === currentStep

          return (
            <React.Fragment key={num}>
              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: done ? C.violet : active ? C.blue : C.grey,
                    color: done || active ? C.white : C.text,
                    border: active ? `2px solid ${C.blue}` : 'none',
                    boxShadow: active ? `0 0 0 3px rgba(26,26,230,0.15)` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {done ? '✓' : num}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: active ? 700 : 400,
                    color: active ? C.blue : done ? C.violet : C.text,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    margin: '0 12px',
                    background: done ? C.violet : C.grey,
                    transition: 'background 0.3s',
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
