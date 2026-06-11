import { Companies } from '../../types/company.types';
import { SireneEtablissement } from '../../external/insee/types';

export interface ContactInfo {
    name: string;
    value: string;
}

export interface SalePersonInfo {
    id: number;
    email: string;
    name: string;
}

export interface CompanyWithSalePerson {
    company: Companies;
    salePerson: SalePersonInfo | null;
}

export interface SirenSearchResult {
    siren: string;
    companiesWithSale: CompanyWithSalePerson[];
    etablissements: SireneEtablissement[];
}
