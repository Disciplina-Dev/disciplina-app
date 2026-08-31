export function buildMatchingLink(offerId: string, needsAnalysisId?: string | null): string {
    if (!needsAnalysisId) return `/rh/matching?offer=${offerId}`;
    return `/rh/matching?needsAnalysis=${needsAnalysisId}&offer=${offerId}`;
}
