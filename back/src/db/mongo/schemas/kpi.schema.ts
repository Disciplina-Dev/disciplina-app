import mongoose, { Document, model, Schema } from 'mongoose';
import { KpiDoc } from '../../../types/kpiDoc.types';
import { KPI_SITES } from '../../../types/kpi.types';

const kpiSchema = new Schema<KpiDoc & Document>(
    {
        _id: { type: String, required: true },
        kind: { type: String, enum: ['commercial', 'rh'], required: true },
        user_id: { type: Number, default: null },
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        week: { type: Number, required: true },
        site: { type: String, enum: KPI_SITES },
        sector: { type: String },
        user_name: { type: String },
        // Compteurs à géométrie variable (union typée côté TS, sanitize à la
        // lecture via sanitizeCommercialMetrics / sanitizeRhKpiMetrics).
        metrics: { type: Schema.Types.Mixed, default: () => ({}) },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    {
        collection: 'kpis',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    },
);

// Bucket unique : kind discrimine la dimension renseignée (site pour commercial,
// sector pour rh). Contrairement à MySQL, un index unique Mongo rejette les
// doublons de null : le filtre partiel exclut donc les lignes orphelines
// (user_id non numérique hérité d'imports Excel), qui restent illimitées et
// distinctes comme avec une clé unique MySQL sur NULL.
kpiSchema.index(
    { kind: 1, user_id: 1, site: 1, sector: 1, year: 1, month: 1, week: 1 },
    { unique: true, partialFilterExpression: { user_id: { $type: 'number' } } },
);

export const KpiModel = mongoose.models.Kpi || model<KpiDoc & Document>('Kpi', kpiSchema);
