import { Router, Request, Response } from 'express';
import { AnalyseBesoinService } from '../services/AnalyseBesoinService';

const router = Router();
const service = new AnalyseBesoinService();

// GET /api/ab — liste des ABs
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      statut: req.query.statut as string | undefined,
      campus: req.query.campus as string | undefined,
    };
    const abs = await service.findAll(filters);
    res.json(abs);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/ab — créer une AB
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.body.entreprise_id || !req.body.campus) {
      return res.status(400).json({ error: 'entreprise_id et campus sont requis' });
    }
    const result = await service.create(req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/ab/:token — récupérer une AB par token
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const ab = await service.findByToken(req.params.token);
    if (!ab) return res.status(404).json({ error: 'AB introuvable' });
    res.json(ab);
  } catch (err) {
    console.error('[GET /api/ab/:token]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/ab/:token — modifier une AB
router.put('/:token', async (req: Request, res: Response) => {
  try {
    const ok = await service.update(req.params.token, req.body);
    if (!ok) return res.status(404).json({ error: 'AB introuvable' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/ab/:token/valider — valider + générer PDF + récupérer lien YouSign
router.post('/:token/valider', async (req: Request, res: Response) => {
  try {
    const signatureLink = await service.valider(req.params.token);
    if (!signatureLink) return res.status(404).json({ error: 'AB introuvable' });
    res.json({ success: true, redirectUrl: signatureLink });
  } catch (err) {
    console.error('[POST /api/ab/:token/valider]', err);
    res.status(500).json({ error: 'Erreur lors de la génération PDF ou de YouSign' });
  }
});

// POST /api/ab/:token/renvoyer — renvoyer le lien par email
router.post('/:token/renvoyer', async (req: Request, res: Response) => {
  try {
    const ok = await service.renvoyer(req.params.token);
    if (!ok) return res.status(404).json({ error: 'AB introuvable ou destinataire manquant' });
    res.json({ success: true, message: 'Lien renvoyé par email' });
  } catch (err) {
    console.error('[POST /api/ab/:token/renvoyer]', err);
    res.status(500).json({ error: "Erreur lors de l'envoi email" });
  }
});

export default router;
