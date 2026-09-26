import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Garde anti-régression du lot TZ (AUDIT_MULTITENANT.md) : les fuseaux IANA
    // et les décalages UTC ne doivent vivre que dans src/lib/timezone.ts.
    // Écrits en dur, ils décalaient de 2 h tous les horaires du tenant annemasse
    // (et de 3 h en été, Europe/Paris bascule sur CEST).
    // Pour un tenant : regionTimezone(useRegionStore(s => s.region)) côté page
    // staff, ou le champ `timezone` de GET /:signature/profile côté guest.
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/lib/timezone.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Substring et non égalité : l'exemple figé de TZ-08 était
          // « lundi 22 juin 2026 à 14:30 (Indian/Reunion) », pas « Indian/Reunion ».
          selector: 'Literal[value=/Indian\\/Reunion|Europe\\/Paris/]',
          message:
            "Fuseau en dur : utilise regionTimezone(region) de @/lib/timezone, ou le champ `timezone` de GET /:signature/profile pour les pages guest.",
        },
        {
          // ex. new Date(`${date}T${time}:00+04:00`) : +04:00 est l'offset Réunion.
          selector: 'TemplateElement[value.raw=/[0-9]{2}\\+0[0-9]:[0-9]{2}/]',
          message:
            "Décalage UTC en dur : Europe/Paris suit l'heure d'été (+01:00/+02:00). Utilise zonedWallClockToIso(heureMurale, tz) de @/lib/timezone.",
        },
        {
          selector: 'Literal[value=/^\\+0[0-9]:[0-9]{2}$/]',
          message:
            "Décalage UTC en dur : Europe/Paris suit l'heure d'été (+01:00/+02:00). Utilise zonedWallClockToIso(heureMurale, tz) de @/lib/timezone.",
        },
      ],
    },
  },
])
