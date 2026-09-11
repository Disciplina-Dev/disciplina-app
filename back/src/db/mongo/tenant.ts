import type { Connection, Model } from 'mongoose';
import mongoose from 'mongoose';
import { getRegion } from '../tenant';
import type { Region } from '../../types/tenant';
import { CandidateAvatarModel, CandidateModel } from './schemas/candidate.schema';
import { NeedsAnalysisModel } from './schemas/needsAnalysis.schema';
import { OfferHistoryModel, OfferModel } from './schemas/offer.schema';
import { KpiModel } from './schemas/kpi.schema';
import { NotificationModel } from './schemas/notification.schema';
import { MailSignatureModel, MailTemplateModel } from './schemas/mailTemplate.schema';
import { CommercialSignatureModel } from './schemas/commercialSignature.schema';
import { CandidateHistoryModel } from './schemas/candidateHistory.schema';
import { AbDriveConfigModel } from './schemas/abDriveConfig.schema';
import { DriveFolderConfigModel } from './schemas/driveFolderConfig.schema';
import { getAnnemasseConnection } from './connection';

function tenantConnection(region: Region): Connection {
    return region === 'annemasse' ? getAnnemasseConnection() : mongoose.connection;
}

function modelOn<T>(region: Region, source: Model<T>): Model<T> {
    if (region === 'reunion') return source;
    const conn = tenantConnection(region);
    const existing = conn.models[source.modelName];
    return (existing as Model<T> | undefined) ?? conn.model<T>(source.modelName, source.schema);
}

export function getModels() {
    const region = getRegion();
    return {
        Candidate: modelOn(region, CandidateModel),
        CandidateAvatar: modelOn(region, CandidateAvatarModel),
        NeedsAnalysis: modelOn(region, NeedsAnalysisModel),
        Offer: modelOn(region, OfferModel),
        OfferHistory: modelOn(region, OfferHistoryModel),
        Kpi: modelOn(region, KpiModel),
        Notification: modelOn(region, NotificationModel),
        MailTemplate: modelOn(region, MailTemplateModel),
        MailSignature: modelOn(region, MailSignatureModel),
        CommercialSignature: modelOn(region, CommercialSignatureModel),
        CandidateHistory: modelOn(region, CandidateHistoryModel),
        AbDriveConfig: modelOn(region, AbDriveConfigModel),
        DriveFolderConfig: modelOn(region, DriveFolderConfigModel),
    };
}

export type TenantModels = ReturnType<typeof getModels>;