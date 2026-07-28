import { CompanyRegion, SalerInfo, Referents, Position } from './needsAnalysisNoSql.types';
import { Matching } from './matching.types';

export interface OfferCompanyInfos {
    id?: number;
    name?: string;
    sector?: CompanyRegion;
    activities?: string[];
}

export interface OfferAbFilter {
    search?: string;
    statuses?: string[];
    desiredTp?: string[];
    sectors?: string[];
    localisations?: string[];
}

export interface OfferHistoryEntry {
    _id: string;
    offer_id: string;
    first_name: string | null;
    last_name: string | null;
    text: string;
    owner_email: string | null;
    created_at: Date;
}

export interface Offer extends Position {
    _id?: string;
    needs_analysis_id?: string;

    company_infos?: OfferCompanyInfos;
    saler_info?: SalerInfo;
    referents?: Referents;

    matching?: Matching;

    created_at?: Date;
    updated_at?: Date;
}
