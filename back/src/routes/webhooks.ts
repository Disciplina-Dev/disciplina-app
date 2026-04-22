import { Router, Request, Response } from 'express';
import { AnalyseBesoinRepository } from '../repositories/AnalyseBesoinRepository';
import { getSignedDocument } from '../services/yousign';
import { sendSignedPdfEmail } from '../services/brevo';

const router = Router();
const repo = new AnalyseBesoinRepository();

/**
 * POST /api/webhooks/yousign
 * Écoute les événements YouSign.
 * À configurer dans le dashboard YouSign : https://your-domain/api/webhooks/yousign
 */
router.post('/yousign', async (req: Request, res: Response) => {
  // Répondre immédiatement 200 pour confirmer la réception à YouSign
  res.sendStatus(200);

  const { event_name, data } = req.body as {
    event_name: string;
    data: { signature_request: { id: string } };
  };

  const signatureRequestId = data?.signature_request?.id;

  if (!signatureRequestId) {
    console.error('[webhook/yousign] Payload invalide — pas de signature_request.id');
    return;
  }

  console.log(`[webhook/yousign] event=${event_name} id=${signatureRequestId}`);

  if (event_name === 'signature_request.done') {
    try {
      // Récupérer le PDF signé
      const pdfBuffer = await getSignedDocument(signatureRequestId);

      // Récupérer les infos de l'entreprise
      const row = await repo.findByYousignId(signatureRequestId);
      const raisonSociale = row?.raison_sociale || 'Entreprise Inconnue';

      // Envoi du PDF par email via Brevo au lieu de le sauvegarder sur le serveur
      await sendSignedPdfEmail({
        raisonSociale,
        pdfBuffer,
      });

      // Mettre à jour le statut en base via yousign_procedure_id
      await repo.updateByYousignId(signatureRequestId, {
        statut: 'signee',
        is_signed: 1,
        pdf_url: null,
      });

      console.log(`[webhook/yousign] AB ${signatureRequestId} → statut=signée`);
    } catch (err) {
      console.error('[webhook/yousign] Erreur traitement signature.done:', err);
    }
    return;
  }

  if (event_name === 'signature_request.expired') {
    console.log(`[webhook/yousign] Signature request expirée : ${signatureRequestId}`);
    return;
  }

  console.log(`[webhook/yousign] Événement ignoré : ${event_name}`);
});

export default router;
