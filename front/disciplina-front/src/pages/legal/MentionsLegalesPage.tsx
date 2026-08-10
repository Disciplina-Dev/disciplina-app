import LegalLayout from '@/components/legal/LegalLayout'
import LegalDocument from '@/components/legal/LegalDocument'
import source from '@/content/legal/mentions-legales.md?raw'

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales">
      <LegalDocument source={source} />
    </LegalLayout>
  )
}
