import { Request, Response } from 'express'
import PDFDocument from 'pdfkit'
import { pool } from '../db'
import { saveSignedAB, type SubmitPayload } from './abController'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

function getYousignConfig() {
  return {
    baseUrl: process.env.YOUSIGN_BASE_URL ?? 'https://api-sandbox.yousign.app/v3',
    apiKey:  process.env.YOUSIGN_API_KEY  ?? '',
  }
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

function generateAbPdf(payload: SubmitPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const line = (label: string, value: unknown) => {
      if (value === null || value === undefined || value === '') return
      doc.fontSize(10).fillColor('#555').text(`${label} :`, { continued: true })
      doc.fillColor('#1A1A2E').text(` ${String(value)}`)
    }

    doc.fontSize(20).fillColor('#1A1AE6').text('ANALYSE DE BESOIN', { align: 'center' })
    doc.fontSize(12).fillColor('#1A1A2E').text('Disciplina — Centre de Formation par Apprentissage', { align: 'center' })
    doc.moveDown(1.5)

    doc.fontSize(13).fillColor('#1A1AE6').text("1. Identité de l'entreprise")
    doc.moveDown(0.3)
    line('Raison sociale', payload.raison_sociale)
    line('SIRET', payload.siret)
    line('Adresse', `${payload.adresse ?? ''} ${payload.code_postal ?? ''} ${payload.commune ?? ''}`.trim())
    line('Activité', payload.description_activite)
    doc.moveDown(0.8)

    doc.fontSize(13).fillColor('#1A1AE6').text('2. Contacts')
    doc.moveDown(0.3)
    line('Représentant légal', payload.representant_legal.nom_prenom)
    line('Fonction', payload.representant_legal.fonction)
    line('Téléphone', payload.representant_legal.telephone)
    line('Email', payload.representant_legal.email)
    doc.moveDown(0.4)
    line('Resp. recrutement', payload.responsable_recrutement.nom_prenom)
    line('Fonction', payload.responsable_recrutement.fonction)
    doc.moveDown(0.8)

    doc.fontSize(13).fillColor('#1A1AE6').text('3. Le poste')
    doc.moveDown(0.3)
    line('Domaine', payload.domaine)
    line('Niveau', payload.niveau)
    line('Intitulé métier', payload.intitule_metier)
    line('Localisation', payload.localisation_poste)
    line('Nombre de postes', payload.nb_postes)
    line('Description missions', payload.description_missions)
    line('Profil recherché', payload.profil_recherche)
    line('Compétences / savoir-être', payload.competences)
    doc.moveDown(0.8)

    doc.fontSize(13).fillColor('#1A1AE6').text("4. L'apprenti")
    doc.moveDown(0.3)
    line('Âge exigé', payload.age_exige)
    line('Permis', payload.permis)
    line('Expérience', payload.experience)
    doc.moveDown(0.8)

    doc.fontSize(13).fillColor('#1A1AE6').text('5. Recrutement')
    doc.moveDown(0.3)
    line('Méthode', payload.methode_recrutement)
    line('PMSMP', payload.pmsmp)
    doc.moveDown(0.8)

    doc.fontSize(13).fillColor('#1A1AE6').text('6. Engagements & Signature')
    doc.moveDown(0.3)
    line('Lieu', payload.lieu_signature)
    line('Date', payload.date_signature)
    doc.moveDown(1.5)

    doc.fontSize(9).fillColor('#999').text(
      'En signant ce document, les parties confirment avoir pris connaissance et accepté les conditions de collaboration avec Disciplina.',
      { align: 'justify' }
    )
    doc.moveDown(2)
    doc.text("Signature de l'entreprise : ___________________________", { align: 'right' })

    doc.end()
  })
}

// ─── sendToYousign ────────────────────────────────────────────────────────────
// Reçoit le payload complet du formulaire, génère le PDF, envoie à YouSign
// et stocke le payload en attente dans ab_pending

export async function sendToYousign(req: Request, res: Response): Promise<void> {
  const payload = req.body as SubmitPayload
  const { baseUrl, apiKey } = getYousignConfig()

  if (!apiKey) {
    res.status(500).json({ error: 'YOUSIGN_API_KEY non configurée' })
    return
  }

  try {
    const pdfBuffer = await generateAbPdf(payload)
    const nomEntreprise = payload.raison_sociale.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)

    // 1. Créer la demande de signature
    const srRes = await fetch(`${baseUrl}/signature_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        name: `AB_${nomEntreprise}_${Date.now()}`,
        delivery_mode: 'email',
        timezone: 'Indian/Reunion',
      }),
    })
    if (!srRes.ok) {
      console.error('[yousign] create SR failed', await srRes.text())
      res.status(502).json({ error: 'Erreur YouSign (création)' }); return
    }
    const sr = await srRes.json() as { id: string }
    const signatureRequestId = sr.id

    // 2. Upload du PDF
    const formData = new FormData()
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), `AB_${nomEntreprise}.pdf`)
    formData.append('nature', 'signable_document')
    formData.append('parse_anchors', 'false')

    const docRes = await fetch(`${baseUrl}/signature_requests/${signatureRequestId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })
    if (!docRes.ok) {
      console.error('[yousign] upload doc failed', await docRes.text())
      res.status(502).json({ error: 'Erreur YouSign (upload document)' }); return
    }
    const docJson = await docRes.json() as { id: string }

    // 3. Ajouter le signataire
    const signerEmail = payload.responsable_recrutement.email ?? payload.representant_legal.email
    const signerName  = payload.responsable_recrutement.nom_prenom ?? payload.representant_legal.nom_prenom ?? 'Signataire'
    const [prenom, ...rest] = signerName.split(' ')
    const nom = rest.join(' ') || prenom

    const signerRes = await fetch(`${baseUrl}/signature_requests/${signatureRequestId}/signers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        info: { first_name: prenom, last_name: nom, email: signerEmail, locale: 'fr' },
        signature_level: 'electronic_signature',
        signature_authentication_mode: 'otp_email',
        fields: [{
          document_id: docJson.id,
          type: 'signature',
          page: 1, x: 340, y: 720, width: 200, height: 50,
        }],
      }),
    })
    if (!signerRes.ok) {
      console.error('[yousign] add signer failed', await signerRes.text())
      res.status(502).json({ error: 'Erreur YouSign (signataire)' }); return
    }

    // 4. Activer
    const activateRes = await fetch(`${baseUrl}/signature_requests/${signatureRequestId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!activateRes.ok) {
      console.error('[yousign] activate failed', await activateRes.text())
      res.status(502).json({ error: 'Erreur YouSign (activation)' }); return
    }

    // 5. Stocker le payload en attente de signature
    await pool.query<ResultSetHeader>(
      'INSERT INTO ab_pending (yousign_request_id, payload) VALUES (?, ?)',
      [signatureRequestId, JSON.stringify(payload)]
    )

    res.json({ success: true, signature_request_id: signatureRequestId })
  } catch (err) {
    console.error('[sendToYousign]', err)
    res.status(500).json({ error: 'Erreur serveur YouSign' })
  }
}

// ─── Webhook YouSign ──────────────────────────────────────────────────────────
// Appelé par YouSign quand l'entreprise a signé → sauvegarde en DB

export async function yousignWebhook(req: Request, res: Response): Promise<void> {
  const event = req.body as {
    event_type?: string
    data?: { signature_request?: { id?: string }; documents?: Array<{ url?: string }> }
  }

  try {
    const eventType          = event.event_type ?? ''
    const signatureRequestId = event.data?.signature_request?.id

    if (!signatureRequestId) {
      res.status(200).json({ received: true }); return
    }

    if (eventType === 'signature_request.completed') {
      // Récupérer le payload en attente
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT payload FROM ab_pending WHERE yousign_request_id = ?',
        [signatureRequestId]
      )

      if (rows.length > 0) {
        const payload = rows[0]['payload'] as SubmitPayload
        const documentUrl = event.data?.documents?.[0]?.url ?? null

        // Sauvegarder en DB principale
        const ab_id = await saveSignedAB(payload, signatureRequestId)

        // Mettre à jour avec statut signé et URL du document
        await pool.query(
          `UPDATE analyse_besoin SET statut='signe', signed_at=NOW(), yousign_document_url=? WHERE id=?`,
          [documentUrl, ab_id]
        )

        // Supprimer de la table temporaire
        await pool.query('DELETE FROM ab_pending WHERE yousign_request_id = ?', [signatureRequestId])

        console.log(`[webhook] AB signé et sauvegardé — id=${ab_id}`)
      }
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[yousignWebhook]', err)
    res.status(500).json({ error: 'Erreur webhook' })
  }
}
