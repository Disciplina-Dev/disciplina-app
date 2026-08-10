import LegalLayout from '@/components/legal/LegalLayout'
import LegalDocument from '@/components/legal/LegalDocument'
import source from '@/content/legal/politique-confidentialite.md?raw'

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Confidentialité">
      <LegalDocument source={source} />
    </LegalLayout>
  )
}
