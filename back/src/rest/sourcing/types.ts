import { Companies } from '../../types/company.types';
import { SireneEtablissement } from '../../external/insee/types';

export interface ContactInfo {
    name: string;
    value: string;
}

export interface SalePersonInfo {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
}

export interface CompanyWithSalePerson {
    company: Companies;
    salePerson: SalePersonInfo | null;
}

export interface BlacklistedCompanyInfo {
    name: string | null;
    siret: string | null;
    conclusion: string | null;
}

export interface SirenSearchResult {
    siren: string;
    companiesWithSale: CompanyWithSalePerson[];
    etablissements: SireneEtablissement[];
    blacklisted: BlacklistedCompanyInfo[];
    allBlacklisted: boolean;
    message?: string;
}
