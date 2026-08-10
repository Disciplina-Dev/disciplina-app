import LegalLayout from '@/components/legal/LegalLayout'
import LegalDocument from '@/components/legal/LegalDocument'
import source from '@/content/legal/politique-cookies.md?raw'

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookies">
      <LegalDocument source={source} />
    </LegalLayout>
  )
}
