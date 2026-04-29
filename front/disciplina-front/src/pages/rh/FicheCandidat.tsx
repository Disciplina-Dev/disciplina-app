import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, GraduationCap, Briefcase } from 'lucide-react'
import { useCandidateById } from '@/graphql/hooks'
import MailModal from '@/components/ui/MailModal'
import Button from '@/components/ui/Button'

const STATUS_LABELS: Record<string, string> = {
  SEEKING: 'En recherche',
  NOT_SEEKING: 'Indisponible',
  CANCELLED: 'Annulé',
  MATCHED: 'Matché',
  CONTRACTED: 'Sous contrat',
  IMMERSING: 'En immersion',
  BANNED: 'Banni',
}

const STATUS_COLORS: Record<string, string> = {
  SEEKING: 'bg-green-100 text-green-700',
  NOT_SEEKING: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
  MATCHED: 'bg-blue-100 text-blue-700',
  CONTRACTED: 'bg-purple-100 text-purple-700',
  IMMERSING: 'bg-orange-100 text-orange-700',
  BANNED: 'bg-red-200 text-red-800',
}

export default function FicheCandidat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [mailOpen, setMailOpen] = useState(false)

  const { candidate, loading, error } = useCandidateById(id ?? '')

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400 text-sm">
        Chargement...
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400 text-sm">
        Candidat introuvable.
      </div>
    )
  }

  const { identity, education, background, profile, status, tp_type, training_site } = candidate
  const rawStatus = Object.entries(STATUS_LABELS).find(([, v]) => v === status)?.[0] ?? status

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
        {/* Back + header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{identity.full_name}</h1>
              <p className="text-sm text-gray-400">{tp_type} {training_site ? `· ${training_site}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[rawStatus] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[rawStatus] ?? rawStatus}
            </span>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Mail size={15} />}
              onClick={() => setMailOpen(true)}
            >
              Mail
            </Button>
          </div>
        </div>

        {/* Contact info */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Contact</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InfoRow icon={<Mail size={15} />} label={identity.email} />
            <InfoRow icon={<Phone size={15} />} label={identity.phone} />
            {(identity.city || identity.postal_code) && (
              <InfoRow icon={<MapPin size={15} />} label={[identity.postal_code, identity.city].filter(Boolean).join(' ')} />
            )}
            {identity.age && (
              <InfoRow icon={<Calendar size={15} />} label={`${identity.age} ans`} />
            )}
          </div>
        </div>

        {/* Formation */}
        {education?.school_level && (
          <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-gray-700">Formation</h2>
            <InfoRow icon={<GraduationCap size={15} />} label={education.school_level} />
            {background?.last_diploma && (
              <p className="text-sm text-gray-500">{background.last_diploma}</p>
            )}
          </div>
        )}

        {/* Expériences */}
        {background?.professional_experiences && background.professional_experiences.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Expériences professionnelles</h2>
            {background.professional_experiences.map((exp, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                  <Briefcase size={13} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{exp.position}</p>
                  <p className="text-xs text-gray-400">{exp.company}{exp.duration ? ` · ${exp.duration}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Profil */}
        {profile && (profile.qualities?.length || profile.digital_skills?.length) && (
          <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Profil</h2>
            {profile.qualities && profile.qualities.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Qualités</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.qualities.map((q) => (
                    <span key={q} className="rounded-full bg-blue-50 px-3 py-0.5 text-xs text-blue-700">{q}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.digital_skills && profile.digital_skills.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Compétences numériques</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.digital_skills.map((s) => (
                    <span key={s} className="rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-600">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {mailOpen && (
        <MailModal
          defaultTo={identity.email}
          candidateName={identity.full_name}
          onClose={() => setMailOpen(false)}
        />
      )}
    </>
  )
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className="text-gray-400">{icon}</span>
      {label}
    </div>
  )
}
