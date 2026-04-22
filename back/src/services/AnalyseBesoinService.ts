import { randomUUID } from 'crypto';
import { AnalyseBesoinRepository } from '../repositories/AnalyseBesoinRepository';
import { AnalyseBesoinRow } from '../repositories/interfaces';
import { generatePdf, uploadDocument, createSignatureRequest, activateSignatureRequest } from './yousign';
import { sendAbLink } from './brevo';

export class AnalyseBesoinService {
  private repo = new AnalyseBesoinRepository();

  async create(body: any): Promise<{ id: number; token: string }> {
    const token = randomUUID();

    const data: Partial<AnalyseBesoinRow> = {
      token,
      statut: 'brouillon',
      entreprise_id: Number(body.entreprise_id),
      sale_person_id: body.sale_person_id ? Number(body.sale_person_id) : null,
      campus: body.campus,
      raison_sociale: body.raison_sociale || null,
      siret: body.siret || null,
      adresse_siege: body.adresse_siege || null,
      code_postal: body.code_postal || null,
      commune: body.commune || null,
      rl_nom: body.rl_nom || null,
      rl_fonction: body.rl_fonction || null,
      rl_telephone: body.rl_telephone || null,
      rl_email: body.rl_email || null,
      rr_same_as_rl: body.rr_same_as_rl ? 1 : 0,
      rr_nom: body.rr_nom || null,
      rr_fonction: body.rr_fonction || null,
      rr_telephone: body.rr_telephone || null,
      rr_email: body.rr_email || null,
      presentation_activite: body.presentation_activite || null,
      nb_postes: body.nb_postes ? Number(body.nb_postes) : null,
      localisation_poste: body.localisation_poste || null,
      domaine: body.domaine || null,
      intitule_poste: body.intitule_poste || null,
      missions: body.missions ? JSON.stringify(body.missions) : null,
      autres_missions: body.autres_missions || null,
      profils_recherches: body.profils_recherches || null,
      competences: body.competences || null,
      commentaires: body.commentaires || null,
      niveau_formation: body.niveau_formation || null,
      permis: body.permis || null,
      experience: body.experience || null,
      age_exige: body.age_exige || null,
      methode_recrutement: body.methode_recrutement || null,
      pmsmp: body.pmsmp || null,
      jours_formation: body.jours_formation ? JSON.stringify(body.jours_formation) : null,
      fait_a: body.fait_a || null,
      fait_le: body.fait_le || null,
    };

    const id = await this.repo.create(data);

    // Envoyer le lien par email via Brevo (non-fatal)
    const recipientEmail = process.env.TEST_EMAIL || data.rr_email || data.rl_email;
    const recipientName = data.rr_nom || data.rl_nom || 'Responsable';
    if (recipientEmail) {
      try {
        await sendAbLink({
          token,
          raisonSociale: data.raison_sociale || 'votre entreprise',
          recipientEmail,
          recipientName,
        });
        await this.repo.updateByToken(token, { statut: 'envoyee' });
        console.log(`[AB] Email envoyé à ${recipientEmail} — lien: /ab/${token}`);
      } catch (err) {
        console.error('[AB] Erreur envoi email Brevo (AB créée quand même):', err);
      }
    }

    return { id, token };
  }

  async renvoyer(token: string): Promise<boolean> {
    const row = await this.repo.findByToken(token);
    if (!row) return false;

    const recipientEmail = row.rr_email || row.rl_email;
    const recipientName = row.rr_nom || row.rl_nom;
    if (!recipientEmail || !recipientName) return false;

    await sendAbLink({
      token,
      raisonSociale: row.raison_sociale || 'votre entreprise',
      recipientEmail,
      recipientName,
    });

    return true;
  }

  async findByToken(token: string) {
    const row = await this.repo.findByToken(token);
    if (!row) return null;
    return {
      ...row,
      missions: typeof row.missions === 'string' ? JSON.parse(row.missions) : (row.missions ?? null),
      jours_formation: typeof row.jours_formation === 'string' ? JSON.parse(row.jours_formation) : (row.jours_formation ?? null),
    };
  }

  async update(token: string, body: any): Promise<boolean> {
    const data: Partial<AnalyseBesoinRow> = { ...body };
    if (body.missions !== undefined) data.missions = JSON.stringify(body.missions);
    if (body.jours_formation !== undefined) data.jours_formation = JSON.stringify(body.jours_formation);
    if (body.rr_same_as_rl !== undefined) data.rr_same_as_rl = body.rr_same_as_rl ? 1 : 0;
    delete (data as any).expired;
    delete (data as any).id;
    return this.repo.updateByToken(token, data);
  }

  async valider(token: string): Promise<boolean> {
    // 1. Récupérer les données de l'AB
    const row = await this.repo.findByToken(token);
    if (!row) return false;

    // 2. Sauvegarder statut "validée" en base
    await this.repo.updateByToken(token, { statut: 'validee' });

    // 3. Générer le PDF
    const pdfBuffer = await generatePdf(row);
    const filename = `AB_${row.raison_sociale || 'entreprise'}_${token.slice(0, 8)}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-.]/g, '');

    // 4. Upload du PDF sur YouSign
    const documentId = await uploadDocument(pdfBuffer, filename);

    // 5. Créer la signature request
    const signatureRequestId = await createSignatureRequest(documentId, row);

    // 6. Activer la signature request (déclenche l'envoi de l'email)
    await activateSignatureRequest(signatureRequestId);

    // 7. Sauvegarder le yousign_procedure_id
    await this.repo.updateByToken(token, { yousign_procedure_id: signatureRequestId });

    return true;
  }

  async findAll(filters: { statut?: string; campus?: string }) {
    const rows = await this.repo.findAll(filters);
    return rows.map((r) => ({
      ...r,
      missions: r.missions ? JSON.parse(r.missions) : null,
      jours_formation: r.jours_formation ? JSON.parse(r.jours_formation) : null,
    }));
  }
}
