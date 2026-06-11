export interface Companies {
    id: number;
    userID: number | null;
    legalReferent: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    sector: string | null;
    mainActivity: string | null;
    siret: string | null;
    idcc: string | null;
    ape: string | null;
    notes: string | null;
    conclusion: string | null;
    status: string | null;
    relanceDate: string | null;
    createdAt: string | null;
    relanceType: number | null;
    relanceTemplateId: string | null;
}
