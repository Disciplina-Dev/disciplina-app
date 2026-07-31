# RGPD — Audit de Conformité

> **Date** : juillet 2026
> **Contexte** : Centre de formation déployé sur Mac mini (Docker), bases de données locales (MySQL + MongoDB), Google Workspace organisationnel.
> **Périmètre** : Application Disciplina (back + front + scripts).

---

## Table des matières

1. [Rappel — qui traite quelles données ?](#1-rappel--qui-traite-quelles-données-)
2. [Faille 1 — Absence de base légale et de consentement](#faille-1--absence-de-base-légale-et-de-consentement)
3. [Faille 2 — Pas de politique de confidentialité](#faille-2--pas-de-politique-de-confidentialité)
4. [Faille 3 — Pas de registre des traitements (Art. 30)](#faille-3--pas-de-registre-des-traitements-art-30)
5. [Faille 4 — Droits des personnes inexposables (Art. 12-22)](#faille-4--droits-des-personnes-inexposables-art-12-22)
6. [Faille 5 — Numéro de sécurité sociale en clair (Art. 9)](#faille-5--numéro-de-sécurité-sociale-en-clair-art-9)
7. [Faille 6 — IA générative sans consentement (Art. 22)](#faille-6--ia-générative-sans-consentement-art-22)
8. [Faille 7 — Transferts internationaux non encadrés (Chapitre V)](#faille-7--transferts-internationaux-non-encadrés-chapitre-v)
9. [Faille 8 — Absence de durées de conservation (Art. 5(1)(e))](#faille-8--absence-de-durées-de-conservation-art-51e)
10. [Faille 9 — Sentry session replays sans consentement](#faille-9--sentry-session-replays-sans-consentement)
11. [Faille 10 — Photos / avatars non chiffrés](#faille-10--photos--avatars-non-chiffrés)
12. [Faille 11 — Secrets en clair dans le dépôt Git](#faille-11--secrets-en-clair-dans-le-dépôt-git)
13. [Faille 12 — Pas de DPA avec les sous-traitants](#faille-12--pas-de-dpa-avec-les-sous-traitants)
14. [Faille 13 — Minimisation des données non respectée](#faille-13--minimisation-des-données-non-respectée)
15. [Faille 14 — Journalisation / audit des accès externalisés](#faille-14--journalisation--audit-des-accès-externalisés)
16. [Faille 15 — Portails externes sans mentions légales](#faille-15--portails-externes-sans-mentions-légales)
17. [Checklist récapitulative](#17-checklist-récapitulative)

---

## 1. Rappel — qui traite quelles données ?

| Acteur | Données traitées | Rôle RGPD |
|--------|-----------------|-----------|
| **Centre de formation** | Nom, email, téléphone, âge, adresse, N° SS, CV, diplômes, expériences, photos, résultats tests | Responsable de traitement |
| **Google (Drive, Gmail, Calendar)** | CV, PDF, photos, emails, événements | Sous-traitant |
| **Sentry** | Session replays (vidéo UI), erreurs, logs console, interactions | Sous-traitant |
| **DocuSeal** | Noms, signatures, PDF d'analyse de besoin | Sous-traitant |
| **ClassMarker** | Résultats de tests, nom candidat | Sous-traitant |
| **Ollama (local)** | Données candidates pour résumé IA | Sous-traitant (local) |
| **Entreprises (via portail)** | CV, nom, compétences des candidats | Responsable distinct |

---

## Faille 1 — Absence de base légale et de consentement

### Constat
- **Aucun consentement explicite** n'est demandé lors de la collecte des données candidat.
- Aucune checkbox « J'accepte le traitement de mes données » sur les formulaires.
- Les candidats ne sont pas informés **au moment de la collecte** de :
  - l'identité du responsable de traitement
  - les finalités poursuivies
  - les destinataires des données
  - la durée de conservation
  - l'existence des droits RGPD

### Base(s) légale(s) applicable(s)
- **Contrat (Art. 6(1)(b))** : pour la mise en relation candidat/entreprise, l'accompagnement
- **Consentement (Art. 6(1)(a) + 7)** : pour le partage avec les entreprises, le traitement IA, les photos
- **Intérêt légitime (Art. 6(1)(f))** : pour les statistiques internes

### Correction

**Dans le back-end — ajouter un champ `consentments` au candidat :**

```typescript
// types/candidate.types.ts (existant)
export interface CandidateConsentments {
    data_processing: boolean       // Traitement général (obligatoire)
    data_sharing: boolean          // Partage avec entreprises
    ai_processing: boolean         // Résumé IA via Ollama
    photo_processing: boolean      // Stockage photo/avatar
    data_retention_years: number   // Durée acceptée (ex: 3)
    consent_date: Date
    consent_version: string        // Version de la politique
}
```

```typescript
// db/mongo/schemas/candidate.schema.ts (à ajouter)
consentments: {
    data_processing: { type: Boolean, required: true },
    data_sharing: { type: Boolean, required: true },
    ai_processing: { type: Boolean, required: true },
    photo_processing: { type: Boolean, required: true },
    data_retention_years: { type: Number, required: true },
    consent_date: { type: Date, required: true },
    consent_version: { type: String, required: true },
},
```

**Dans le front-end — ajouter un écran de consentement lors de la création/modification :**

```tsx
// Exemple de composant à créer
function ConsentForm({ onConsent }: { onConsent: (c: CandidateConsentments) => void }) {
    const [version] = useState('2026-07-v1')
    const [checked, setChecked] = useState({
        data_processing: false,
        data_sharing: false,
        ai_processing: false,
        photo_processing: false,
    })

    return (
        <form onSubmit={/* ... */}>
            <h2>Consentements RGPD</h2>
            <p>
                En tant que centre de formation, nous traitons vos données pour
                vous accompagner dans votre recherche d'alternance.
            </p>
            <label>
                <Checkbox checked={checked.data_processing} />
                Je consens au traitement de mes données personnelles dans le cadre
                de mon accompagnement ({version}).
            </label>
            <label>
                <Checkbox checked={checked.data_sharing} />
                J'accepte que mes données soient partagées avec des entreprises
                partenaires dans le cadre de la recherche d'alternance.
            </label>
            <label>
                <Checkbox checked={checked.ai_processing} />
                J'accepte le traitement de mes données par intelligence
                artificielle locale pour générer un résumé de profil.
            </label>
            <label>
                <Checkbox checked={checked.photo_processing} />
                J'accepte le stockage de ma photo d'identité.
            </label>
            {/* ... */}
        </form>
    )
}
```

**Vérifier le consentement avant chaque traitement :**

```typescript
// Dans candidateService ou un guard
function assertConsent(candidate: Candidate, type: keyof CandidateConsentments) {
    if (!candidate.consentments?.[type]) {
        throw new Error(`Consentement manquant : ${type}`)
    }
}
```

---

## Faille 2 — Pas de politique de confidentialité

### Constat
Aucun fichier `PRIVACY.md`, route `/privacy` ou mention légale trouvée dans le projet.

### Correction

**Créer une page front-end `/public/privacy` accessible sans auth :**

Contenu minimum requis (Art. 13-14 RGPD) :

1. Identité du responsable de traitement (nom du centre, adresse, contact)
2. Finalités des traitements (mise en relation, accompagnement, tests, etc.)
3. Base légale de chaque traitement (contrat, consentement, intérêt légitime)
4. Destinataires des données (entreprises partenaires, Google, Sentry, DocuSeal, ClassMarker)
5. Durée de conservation
6. Droits des personnes (accès, rectification, effacement, limitation, portabilité, opposition)
7. Absence de prise de décision automatisée (sauf consentement pour l'IA)
8. Droit d'introduire une réclamation auprès de la CNIL
9. Caractère obligatoire/facultatif de la fourniture des données

Exemple de route :

```tsx
// router/index.tsx (existant)
{
    path: '/privacy',
    element: <PrivacyPage />,
}
```

**Ajouter un lien vers la politique** dans :
- Les emails envoyés aux candidats/entreprises
- Les portails externes (match, interview, external)
- Le formulaire de consentement
- Le footer de l'application

---

## Faille 3 — Pas de registre des traitements (Art. 30)

### Constat
Aucune trace d'un registre des activités de traitement. Obligatoire pour toute organisation traitant des données personnelles (a fortiori avec des données sensibles telles que le N° SS).

### Correction

**Créer un fichier `RGPD-REGISTRE.md` ou une table en base :**

| Traitement | Finalité | Base légale | Données | Destinataires | Conservation | Sous-traitants | Transfert |
|-----------|----------|-------------|---------|---------------|--------------|----------------|-----------|
| Gestion candidats | Accompagnement alternance | Contrat + consentement | Nom, email, tel, N° SS, CV, photo | Entreprises partenaires | 3 ans après dernier contact | Google Drive, Ollama | Google (USA) |
| Matching offres | Mise en relation | Contrat + consentement | Nom, compétences, CV | Entreprises via portail | 1 an après offre | DocuSeal | DocuSeal (USA) |
| Tests ClassMarker | Évaluation | Contrat | Nom, résultats | Interne | 2 ans | ClassMarker | ClassMarker (USA) |
| Monitoring Sentry | Détection d'erreurs | Intérêt légitime | Logs, replay UI | Sentry | 30 jours | Sentry.io | Sentry (Allemagne) |
| Envoi d'emails | Communication | Contrat | Email, contenu | Google Gmail | 1 an | Google | Google (USA) |
| Signature électronique | Analyse de besoin | Contrat | Nom, signature | DocuSeal | 5 ans | DocuSeal | DocuSeal (USA) |

Le registre peut être implémenté comme un fichier YAML versionné ou une collection MongoDB. L'important est qu'il soit tenu à jour.

---

## Faille 4 — Droits des personnes inexposables (Art. 12-22)

### Constat
- Aucune interface permettant à un candidat/entreprise d'exercer ses droits
- Pas de portabilité (export JSON structuré)
- Pas de suppression self-service
- Les mutations `deleteCandidate` et `deleteCompany` existent via GraphQL mais sont réservées aux employés

### Correction

**Ajouter des endpoints REST dédiés aux droits des personnes :**

```typescript
// rest/gdpr/route.ts
router.get('/api/gdpr/export', authenticateExternal, async (req, res) => {
    // 1. Identifier le demandeur (email + jwt guest)
    // 2. Rassembler toutes ses données :
    //    - Profil candidat complet (MongoDB)
    //    - Historique des actions
    //    - Résultats ClassMarker
    //    - PDFs / CVs (Drive → téléchargement)
    // 3. Générer un JSON structuré (Art. 20)
    // 4. Renvoyer le fichier
    const data = await gdprService.collectAllData(guestEmail)
    res.json({ data, generated_at: new Date() })
})

router.post('/api/gdpr/delete', authenticateExternal, async (req, res) => {
    // 1. Identifier le demandeur
    // 2. Vérifier qu'il s'agit bien du titulaire
    // 3. Anonymiser ou supprimer :
    //    - CandidateModel.findByIdAndDelete(id)
    //    - Supprimer CV/PDF de Google Drive
    //    - Supprimer avatar de MongoDB
    //    - Conserver les logs d'audit (anonymisés)
    // 4. Confirmer la suppression
    const result = await gdprService.deleteAllData(guestEmail)
    res.json({ deleted: true, date: new Date() })
})

router.post('/api/gdpr/rectify', authenticateExternal, async (req, res) => {
    // Permet au candidat de corriger ses données personnelles
    const { fields } = req.body // { email: "new@email.com" }
    await gdprService.rectifyData(guestEmail, fields)
    res.json({ rectified: true })
})
```

**Interface front-end :**

```tsx
// pages/GdprPortal.tsx
function GdprPortal() {
    return (
        <div>
            <h1>Mes données personnelles</h1>
            <button onClick={handleExport}>Exporter mes données (JSON)</button>
            <button onClick={handleDelete}>Supprimer mon compte</button>
            <button onClick={handleRectify}>Corriger mes informations</button>
        </div>
    )
}
```

**Délai de réponse** : 1 mois (prolongeable 2 mois si complexe). Implémenter un système de tickets avec suivi.

---

## Faille 5 — Numéro de sécurité sociale en clair (Art. 9)

### Constat
Le champ `social_security_number` est stocké en clair dans MongoDB (`candidate.identity.social_security_number`). Le N° de sécurité sociale est une **donnée sensible** au sens de l'Article 9 RGPD car il permet d'identifier de manière unique une personne et peut révéler des informations médicales.

### Correction

**Option A — Chiffrement symétrique (recommandé) :**

```typescript
// external/crypto/ssn-cipher.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export class SsnCipher {
    private readonly key: Buffer

    constructor(secret: string) {
        // Dériver une clé de 32 octets depuis le secret
        this.key = scryptSync(secret, 'ssn-salt', 32)
    }

    encrypt(ssn: string): { encrypted: string; iv: string; tag: string } {
        const iv = randomBytes(16)
        const cipher = createCipheriv(ALGORITHM, this.key, iv)
        let encrypted = cipher.update(ssn, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const tag = cipher.getAuthTag().toString('hex')
        return { encrypted, iv: iv.toString('hex'), tag }
    }

    decrypt(data: { encrypted: string; iv: string; tag: string }): string {
        const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(data.iv, 'hex'))
        decipher.setAuthTag(Buffer.from(data.tag, 'hex'))
        let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
    }
}
```

**Ajouter une variable d'environnement :**

```
# .env (existant)
SSN_ENCRYPTION_KEY=<openssl rand -hex 32>
```

**Modifier le schéma candidat MongoDB :**

```typescript
// db/mongo/schemas/candidate.schema.ts — remplacer social_security_number
social_security_number: {
    encrypted: { type: String },
    iv: { type: String },
    tag: { type: String },
},
```

**Ne déchiffrer qu'à la demande** (export PDF, affichage autorisé) :

```typescript
// Dans PdfService.ts (existant, ligne 741)
function getSsnDisplay(candidate: Candidate): string {
    if (!candidate.identity.social_security_number?.encrypted) return 'Non renseigné'
    const ssnCipher = new SsnCipher(env.SSN_ENCRYPTION_KEY)
    try {
        return ssnCipher.decrypt(candidate.identity.social_security_number)
    } catch {
        return 'Erreur de déchiffrement'
    }
}
```

**Option B — Stocker uniquement les 4 derniers chiffres** si le N° SS complet n'est pas strictement nécessaire.

---

## Faille 6 — IA générative sans consentement (Art. 22)

### Constat
Le endpoint `POST /api/candidates/:id/generate-summary` (`back/src/rest/candidates/route.ts:664`) envoie les données personnelles complètes du candidat (nom, âge, ville, permis, véhicule, diplômes, expériences, qualités, hobbies, CV complet) à Ollama (qwen2.5:3b) pour générer un résumé.

Le modèle est local donc le transfert ne quitte pas la machine, mais :
1. Aucun consentement du candidat n'est demandé
2. Aucune information sur ce traitement automatisé n'est fournie
3. Le résumé peut être utilisé comme critère de sélection par les entreprises

### Correction

**1. Ajouter le champ de consentement (déjà couvert en Faille 1) :**

```typescript
// candidate.consentments.ai_processing
```

**2. Bloquer la génération si pas de consentement :**

```typescript
// rest/candidates/route.ts:664 — ajouter en début de handler
const candidate = await candidateService.findById(id)
if (!candidate?.consentments?.ai_processing) {
    res.status(403).json({
        error: "Le candidat n'a pas consenti au traitement IA de ses données.",
    })
    return
}
```

**3. Ajouter un message d'information sur le formulaire de résumé :**

```tsx
// Composant front-end
<Alert>
    Le résumé est généré par une intelligence artificielle locale (Ollama /
    qwen2.5:3b). Le candidat a consenti à ce traitement. Le résumé est
    destiné aux recruteurs et entreprises partenaires.
</Alert>
```

**4. Documenter le traitement dans la politique de confidentialité :**
- Données transmises à Ollama : nom, âge, ville, diplômes, expériences, CV
- Modèle : qwen2.5:3b, hébergé localement (aucun transfert externe)
- Finalité : génération d'un résumé professionnel à destination des entreprises
- Absence de décision automatisée exclusive (le résumé est un outil d'aide)

---

## Faille 7 — Transferts internationaux non encadrés (Chapitre V)

### Constat
Bien que les bases de données soient locales, plusieurs sous-traitants reçoivent des données personnelles et sont situés aux États-Unis (ou utilisent des serveurs US) :

| Sous-traitant | Données transférées | Destination | Cadre juridique |
|--------------|--------------------|-------------|-----------------|
| **Google** (Drive/Gmail/Calendar) | CV, PDF, emails, photos, événements | USA (serveurs GCP) | Aucun trouvé |
| **Sentry** | Session replays, logs, erreurs | USA / Allemagne | Aucun trouvé |
| **DocuSeal** | Noms, signatures, PDF | USA (api.docuseal.com → US) | Aucun trouvé |
| **ClassMarker** | Résultats de tests, nom candidat | USA | Aucun trouvé |

### Correction

**1. Vérifier le pays d'hébergement de chaque service :**

| Service | Hébergement EU possible ? |
|---------|---------------------------|
| Google Workspace | Oui — choisir la région « Europe » dans l'admin console |
| Sentry | Oui — DSN européen (de.sentry.io) déjà utilisé |
| DocuSeal | Oui — `api.docuseal.eu` au lieu de `api.docuseal.com` |
| ClassMarker | Non — USA uniquement, à documenter |

**2. Mettre à jour la configuration :**

```bash
# back/.env
DOCUSEAL_BASE_URL=https://api.docuseal.eu
DOCUSEAL_SIGN_URL=https://docuseal.eu
```

**3. Signer des Clauses Contractuelles Types (CCT) avec chaque sous-traitant :**

Pour Google (nécessaire une fois dans l'admin console) :
- Activer « CCT RGPD » dans Google Admin → RGPD → Protection des données
- Télécharger et signer les CCT via Google Cloud Console

Pour Sentry, DocuSeal, ClassMarker :
- Contacter leur support DPO
- Signer le Data Processing Agreement (DPA) proposé
- Conserver les documents signés dans le registre

**4. Mettre à jour `/back/.env` avec les endpoints EU :**

```
DOCUSEAL_BASE_URL=https://api.docuseal.eu
DOCUSEAL_SIGN_URL=https://docuseal.eu
```

**5. Ajouter les DPA signés dans un dossier `rgpd/dpas/`** :

```
rgpd/
├── dpas/
│   ├── google-dpa-2026.pdf
│   ├── sentry-dpa-2026.pdf
│   ├── docuseal-dpa-2026.pdf
│   └── classmarker-dpa-2026.pdf
├── REGISTRE-TRAITEMENTS.md
└── POLITIQUE-CONFIDENTIALITE.md
```

---

## Faille 8 — Absence de durées de conservation (Art. 5(1)(e))

### Constat
- Aucune purge automatique des données candidats/entreprises obsolètes
- Seules les notifications MongoDB ont un TTL (48h)
- Les tokens d'accès expirent (15 min / 30 jours), mais les données elles-mêmes restent indéfiniment
- Les candidats « CANCELLED », « BANNED », « NOT_SEEKING » ne sont jamais nettoyés

### Correction

**1. Définir une politique de rétention :**

| Type de donnée | Durée de conservation | Motif | Action après délai |
|----------------|----------------------|-------|-------------------|
| Candidat actif | Durée de l'accompagnement + 3 ans | Prescription civile | Suppression/anonymisation |
| Candidat « CANCELLED » | 1 an après passage CANCELLED | Aucun motif légitime | Suppression |
| Candidat « BANNED » | 3 ans | Contentieux potentiel | Anonymisation |
| Offre d'emploi | 1 an après clôture | Statistiques | Anonymisation |
| Emails / relances | 3 ans | Historique relation client | Suppression |
| Logs d'audit | 5 ans | Preuve juridique | Archivage |
| Session replays Sentry | 30 jours | Debug | Suppression auto (Sentry) |
| Notifications push | 48h | Temporel | Déjà fait (TTL index) |

**2. Implémenter un job de purge :**

```typescript
// services/GdprCleanupService.ts
export class GdprCleanupService {
    async purgeExpiredCandidates(): Promise<number> {
        const cutoff = new Date()
        cutoff.setFullYear(cutoff.getFullYear() - 3) // +3 ans

        const expired = await CandidateModel.find({
            status: { $in: ['CANCELLED', 'BANNED', 'NOT_SEEKING'] },
            updatedAt: { $lt: cutoff },
        })

        for (const c of expired) {
            // Supprimer les fichiers Drive
            if (c.drive_folder_id) {
                try {
                    await this.driveService.deleteFolder(c.drive_folder_id)
                } catch (e) {
                    logger.warn({ err: e, id: c._id }, 'Échec suppression Drive')
                }
            }
            // Supprimer l'avatar
            await CandidateAvatarModel.deleteOne({ candidate_id: c._id })
            // Anonymiser ou supprimer
            await CandidateModel.findByIdAndDelete(c._id)
            // Journaliser
            await this.auditService.log('candidate_purged', { id: c._id })
        }

        return expired.length
    }

    async purgeExpiredCompanies(): Promise<number> {
        // Logique similaire
    }
}
```

**3. Planifier l'exécution (cron/docker) :**

```typescript
// schedulers/gdprCleanup.scheduler.ts
export function startGdprCleanupScheduler(): void {
    // Tous les jours à 3h du matin
    setInterval(async () => {
        const service = new GdprCleanupService()
        const purged = await service.purgeExpiredCandidates()
        logger.info({ purged }, 'Nettoyage RGPD terminé')
    }, 24 * 60 * 60 * 1000)
}
```

**4. Exposer les durées dans la politique de confidentialité** et les communiquer au moment du consentement.

---

## Faille 9 — Sentry session replays sans consentement

### Constat
Dans `front/disciplina-front/src/main.tsx` :

```typescript
Sentry.init({
    dataCollection: {
        // userInfo: false,     ← COMMENTÉ → userInfo ENVOYÉ
        // httpBodies: [],      ← COMMENTÉ → httpBodies ENVOYÉS
    },
    integrations: [
        Sentry.replayIntegration(),                // Session replays actifs
    ],
    replaysSessionSampleRate: 0.1,   // 10% des sessions
    replaysOnErrorSampleRate: 1.0,   // 100% des erreurs
    enableLogs: true,                               // Logs console envoyés
    tracePropagationTargets: ['localhost', /^https:\/\/app-reunion.disciplina.re\/api/],
})
```

Les session replays enregistrent **tout ce qui se passe à l'écran** (navigation, formulaires, données affichées) et l'envoient à Sentry. Aucun consentement n'est demandé, aucun bandeau cookie n'est affiché.

### Correction

**Option A (recommandée) — Activer `userInfo: false` et réduire le sample rate :**

```typescript
Sentry.init({
    dataCollection: {
        userInfo: false,
        httpBodies: [/password/i, /token/i, /secret/i, /ssn/i, /social_security/i],
    },
    replaysSessionSampleRate: 0,      // Désactiver les replays de session
    replaysOnErrorSampleRate: 0.1,    // 10% des erreurs seulement
})
```

**Option B — Bandeau de consentement avant d'activer Sentry :**

```tsx
// components/ConsentBanner.tsx
function ConsentBanner() {
    const [accepted, setAccepted] = useState(
        localStorage.getItem('sentry-consent') === 'true'
    )

    useEffect(() => {
        if (!accepted) return
        // Initialiser Sentry ici (dynamique)
        initSentry()
    }, [accepted])

    if (accepted) return null

    return (
        <Banner>
            <p>Ce site utilise Sentry pour détecter les erreurs techniques.</p>
            <p>
                Vous pouvez choisir d'activer ou non ce service. Aucune donnée
                personnelle n'est collectée si vous refusez.
            </p>
            <button onClick={() => setAccepted(true)}>Accepter</button>
            <button onClick={() => setAccepted(false)}>Refuser</button>
        </Banner>
    )
}
```

**Option C (idéale) — Combiner les deux :**
- `userInfo: false` en toutes circonstances
- `replaysSessionSampleRate: 0` (désactivé)
- `replaysOnErrorSampleRate: 0` (désactivé)
- `enableLogs: false`
- Sentry utilisé uniquement pour les erreurs, sans replay ni logs

**Changer le DSN Sentry** pour pointer vers l'instance européenne si ce n'est pas déjà le cas :
```
VITE_SENTRY_DSN=https://4fafd3cd757f557e5fc524c684a78565@o4511805861527552.ingest.de.sentry.io/4511806042800208
                                    ↑ o4511805861527552  → déjà de.sentry.io ✅
```

---

## Faille 10 — Photos / avatars non chiffrés

### Constat
Les avatars sont stockés dans MongoDB (collection `candidate_avatars`) en tant que `Buffer` (BSON Binary) **non chiffré**.

### Correction

**Option A — Chiffrer avant stockage :**

```typescript
// external/crypto/image-cipher.ts
export class ImageCipher {
    encrypt(buffer: Buffer): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
        const cipher = createCipheriv('aes-256-gcm', this.key, randomBytes(16))
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
        return { encrypted, iv: cipher.getIV(), tag: cipher.getAuthTag() }
    }

    decrypt(data: { encrypted: Buffer; iv: Buffer; tag: Buffer }): Buffer {
        const decipher = createDecipheriv('aes-256-gcm', this.key, data.iv)
        decipher.setAuthTag(data.tag)
        return Buffer.concat([decipher.update(data.encrypted), decipher.final()])
    }
}
```

**Option B — Ne pas stocker les avatars dans MongoDB** :
- Uploader vers Google Drive uniquement
- Stocker seulement le lien Drive dans MongoDB
- Servir l'avatar via le proxy Drive existant (`GET /api/candidates/:id/avatar`)

**Option C — Stocker en base de données mais avec champ chiffré :**

```typescript
// Schéma avatar modifié
const candidateAvatarSchema = new Schema({
    candidate_id: { type: String, required: true },
    encrypted_data: { type: Buffer, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    content_type: { type: String, required: true },
    updated_at: { type: Date, default: Date.now },
})
```

---

## Faille 11 — Secrets en clair dans le dépôt Git

### Constat
Les fichiers `.env` (root et `back/.env`) contiennent des secrets en clair et sont **commités** dans Git :

```
back/.env :
- JWT_SECRET=JWTSecret974            → trivial
- JWT_REFRESH_SECRET=JWTRefreshSecret974 → trivial
- SESSION_SECRET=SessionSecret974     → trivial
- MYSQL_URI=mysql://user:pass@tidbcloud... → accès TiDB Cloud
- GOOGLE_CLIENT_SECRET=GOCSPX-...     → OAuth Google
- DOCUSEAL_API_KEY=...
- FILIZ_CLIENT_SECRET=...
- SMTP_PASS=...
- CLASSMARKER_API_KEY=toto            → placeholder

.env (root) :
- MONGO_URI=mongodb+srv://user:pass@atlas... → accès MongoDB Atlas
- DIGIFORMA_API_KEY=eyJ...            → token JWT valide
```

### Correction

**1. Ajouter `.env` aux `.gitignore` :**

```gitignore
# .gitignore (root) — VÉRIFIER QUE .env EST PRÉSENT
.env
back/.env
```

**2. Nettoyer l'historique Git :**

```bash
# Supprimer les fichiers .env de l'historique Git (attention : réécriture)
# Cela invalidera les clones existants — à coordonner avec l'équipe
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch back/.env .env" \
  --prune-empty --tag-name-filter cat -- --all
```

**3. Générer des secrets robustes pour la production :**

```bash
# Générer des secrets de 32+ caractères
openssl rand -hex 32   # → JWT_SECRET, SESSION_SECRET, etc.
```

**4. Remplacer les placeholders par des valeurs réelles dans `back/.env.back.example` :**

```bash
# .env.back.example
SESSION_SECRET=                         # <-- laisser vide, obliger à configurer
JWT_SECRET=                             # <-- idem
```

**5. Vérifier qu'aucun secret ne fuit dans les logs :** (déjà en place dans `env.ts` avec `INSECURE_DEFAULTS` qui bloque les valeurs faibles en production)

---

## Faille 12 — Pas de DPA avec les sous-traitants

### Constat
Aucun Data Processing Agreement (DPA) n'a été trouvé dans le dépôt ni référencé dans le code.

### Correction

**1. Lister tous les sous-traitants :**

| Service | Type de données | DPA disponible ? | URL |
|---------|----------------|------------------|-----|
| Google Cloud (Drive, Gmail, Calendar) | Documents, emails | Oui (Admin Console) | https://cloud.google.com/terms/data-processing-terms |
| Sentry | Erreurs, replays | Oui (dashboard Sentry) | https://sentry.io/legal/dpa/ |
| DocuSeal | Signatures | Oui | https://docuseal.com/privacy |
| ClassMarker | Tests | Oui | https://www.classmarker.com/company/privacy-policy.php |
| Brevo (SMTP) | Emails | Oui | https://www.brevo.com/legal/dpa/ |

**2. Signer et archiver chaque DPA :**

Créer un dossier `rgpd/dpas/` et y placer les DPA signés. Ne pas commiter les documents signés si trop volumineux — stocker sur le Drive organisationnel et référencer le lien dans le registre.

**3. Ajouter une vérification automatique :**

```typescript
// À lancer manuellement ou via un script
export function assertDpaExists(service: string): void {
    const dpas = {
        google: 'rgpd/dpas/google-dpa-2026.pdf',
        sentry: 'rgpd/dpas/sentry-dpa-2026.pdf',
        docuseal: 'rgpd/dpas/docuseal-dpa-2026.pdf',
        classmarker: 'rgpd/dpas/classmarker-dpa-2026.pdf',
    }
    if (!fs.existsSync(dpas[service])) {
        throw new Error(`DPA manquant pour ${service}`)
    }
}
```

---

## Faille 13 — Minimisation des données non respectée

### Constat
- Tous les employés avec accès Google Drive voient **tous les dossiers candidats**
- Le champ `social_security_number` est collecté sans utilité métier claire
- Des champs comme `description` (texte libre sur le candidat) peuvent contenir des données excessives

### Correction

**1. Restreindre l'accès Google Drive par dossier :**

```typescript
// services/drive/accessControl.ts
// Ne partager le dossier candidat qu'avec le RH assigné, pas toute l'organisation
export async function shareCandidateFolder(
    driveService: GoogleDriveService,
    folderId: string,
    userEmail: string,
): Promise<void> {
    // Au lieu de partager avec tout le domaine, partager avec l'utilisateur spécifique
    await driveService.createPermission(folderId, {
        type: 'user',
        role: 'writer',
        emailAddress: userEmail,
    })
}
```

**2. Rendre `social_security_number` optionnel et masqué par défaut :**

```typescript
// Interface utilisateur
// Ne collecter le N° SS que si strictement nécessaire (ex: contrat d'apprentissage)
// Sinon, le champ est masqué
{showSsnField && (
    <SsnInput
        value={ssn}
        onChange={setSsn}
        label="Numéro de sécurité sociale (optionnel, requis pour le contrat)"
    />
)}
```

**3. Valider les champs de type `description` contre la minimisation :**

```typescript
// Implémenter un validateur qui refuse les données manifestement excessives
function validateDescription(text: string): { valid: boolean; reason?: string } {
    if (text.length > 2000) {
        return { valid: false, reason: 'Description trop longue (max 2000 caractères)' }
    }
    // Détecter les patterns de données sensibles
    const sensitivePatterns = [
        /[0-9]{15,}/,              // Carte bancaire
        /[0-9]{13,15}/,            // N° SS
        /mot de passe|password/i,
    ]
    for (const pattern of sensitivePatterns) {
        if (pattern.test(text)) {
            return { valid: false, reason: 'La description ne doit pas contenir de données sensibles' }
        }
    }
    return { valid: true }
}
```

---

## Faille 14 — Journalisation / audit des accès externalisés

### Constat
Les `candidate_history`, `company_history` et `offer_history` tracent les modifications, mais :
- Aucune journalisation des **consultations** (qui a vu quelles données et quand)
- Aucun audit des **exports PDF**
- Aucune traçabilité des **accès aux portails externes** (qui, quand, a téléchargé quel CV)

### Correction

**Ajouter un log d'accès centralisé :**

```typescript
// repositories/mysql/AccessLogRepository.ts
export class AccessLogRepository {
    async log(params: {
        userId: number
        action: 'VIEW' | 'EXPORT' | 'DOWNLOAD' | 'SEARCH'
        targetType: 'CANDIDATE' | 'COMPANY' | 'OFFER'
        targetId: string
        details?: string
    }): Promise<void> {
        await query(
            `INSERT INTO access_logs (user_id, action, target_type, target_id, details, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [params.userId, params.action, params.targetType, params.targetId, params.details ?? null],
        )
    }
}
```

**Table MySQL à créer :**

```sql
-- database/mysql/mysql-init.sql
CREATE TABLE IF NOT EXISTS access_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action ENUM('VIEW', 'EXPORT', 'DOWNLOAD', 'SEARCH') NOT NULL,
    target_type ENUM('CANDIDATE', 'COMPANY', 'OFFER') NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Ajouter dans `REQUIRED_COLUMNS`** du système de migration :
```
REQUIRED_COLUMNS = {
    // ... existant
    access_logs: ['id', 'user_id', 'action', 'target_type', 'target_id', 'details', 'created_at'],
}
```

**Instrumenter les accès :**

```typescript
// middleware/auditAccess.ts
export function auditAccess(
    action: 'VIEW' | 'EXPORT' | 'DOWNLOAD' | 'SEARCH',
    targetType: 'CANDIDATE' | 'COMPANY' | 'OFFER',
): RequestHandler {
    return async (req, res, next) => {
        const original = res.json.bind(res)
        res.json = function (body) {
            const logRepo = new AccessLogRepository()
            logRepo.log({
                userId: req.user!.id,
                action,
                targetType,
                targetId: req.params.id,
                details: action === 'SEARCH' ? JSON.stringify(req.query) : undefined,
            }).catch((err) => logger.warn({ err }, 'Audit log failed'))
            return original(body)
        }
        next()
    }
}
```

---

## Faille 15 — Portails externes sans mentions légales

### Constat
Les portails accessibles aux candidats et entreprises via lien signé (`/public/match`, `/public/interview`, `/public/external`) ne contiennent aucune mention légale ni lien vers la politique de confidentialité.

### Correction

**Ajouter un footer RGPD à tous les portails publics :**

```tsx
// components/PublicFooter.tsx
function PublicFooter() {
    return (
        <footer className="text-sm text-gray-500 p-4 text-center">
            <p>
                <a href="/privacy" target="_blank">
                    Politique de confidentialité
                </a>
                {' · '}
                <a href="/legal" target="_blank">
                    Mentions légales
                </a>
                {' · '}
                Centre de formation [Nom] — SIRET [xxx] — © {new Date().getFullYear()}
            </p>
            <p className="mt-1">
                Conformément au RGPD, vous disposez d'un droit d'accès, de
                rectification et de suppression de vos données.
                <a href="/gdpr">  En savoir plus</a>
            </p>
        </footer>
    )
}
```

**Ajouter dans chaque page de portail :**

```tsx
// pages/public/MatchPortal.tsx (exemple)
function MatchPortal() {
    return (
        <div>
            <MatchPortalContent />
            <PublicFooter />  {/* ← ajouter ceci */}
        </div>
    )
}
```

**Ajouter les mentions légales dans les templates d'emails :**

```typescript
// services/MatchMailService.ts (existant, ligne 38)
const html = `
    <p>Bonjour,</p>
    <p>...</p>
    <hr />
    <p style="font-size: 12px; color: #666;">
        [Nom du centre] — SIRET [xxx]<br />
        Conformément au RGPD, vous pouvez accéder à vos données ou demander
        leur suppression : <a href="${baseUrl}/gdpr">${baseUrl}/gdpr</a>
    </p>
`
```

---

## 16. Checklist récapitulative

### Priorité critique (faire dans le mois)

- [ ] **F1** Ajouter le consentement explicite des candidats (checkbox + stockage)
- [ ] **F2** Créer et publier la politique de confidentialité (`/privacy`)
- [ ] **F3** Créer le registre des traitements
- [ ] **F4** Implémenter les endpoints d'accès / suppression / rectification
- [ ] **F5** Chiffrer le numéro de sécurité sociale en base
- [ ] **F11** Nettoyer les secrets du dépôt Git + `.gitignore`
- [ ] **F15** Ajouter mentions légales + footer RGPD sur les portails publics

### Priorité haute (faire dans le trimestre)

- [ ] **F6** Bloquer la génération IA sans consentement
- [ ] **F7** Signer les DPA avec Google / Sentry / DocuSeal / ClassMarker
- [ ] **F9** Désactiver les session replays Sentry ou ajouter consentement
- [ ] **F8** Implémenter les jobs de purge automatique des données obsolètes
- [ ] **F12** Archiver les DPA signés dans `rgpd/dpas/`

### Priorité moyenne (faire dans l'année)

- [ ] **F10** Chiffrer les avatars stockés en base
- [ ] **F13** Restreindre les accès Drive par dossier + valider la minimisation
- [ ] **F14** Ajouter les logs d'accès (consultation, export) en base
- [ ] **F7** Basculer DocuSeal vers `api.docuseal.eu`
- [ ] **F11** Remplacer les secrets faibles (`JWTSecret974` → `openssl rand -hex 32`)

### Déjà conforme ✅

- [x] Bases de données hébergées localement (Mac mini)
- [x] Mots de passe hashés en bcrypt (10 rounds)
- [x] Tokens OAuth chiffrés en AES-256-GCM
- [x] Refresh tokens avec rotation et détection de vol
- [x] Rate limiting sur les endpoints sensibles
- [x] Audit trails (company_history, candidate_history, offer_history)
- [x] CSRF double-submit cookie
- [x] Redaction des PII dans les logs (email, téléphone, N° SS, dates naissance)
- [x] Ollama hébergé localement (pas de transfert IA vers le cloud)
- [x] Webhooks vérifiés par HMAC (ClassMarker, DocuSeal, YouSign)
- [x] CSP et HSTS activés en production
