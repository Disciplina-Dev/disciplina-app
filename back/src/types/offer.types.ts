import { CompanyRegion, SalerInfo, Referents, Position } from './needsAnalysisNoSql.types';
import { Matching } from './matching.types';

export interface OfferCompanyInfos {
    id?: number;
    name?: string;
    sector?: CompanyRegion;
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
