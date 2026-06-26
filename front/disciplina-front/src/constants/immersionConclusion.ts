export enum ImmersionConclusion {
    REJECTED = 'REJECTED',
    CONTRACT = 'CONTRACT',
}

export const IMMERSION_CONCLUSION_LABELS: Record<ImmersionConclusion, string> = {
    [ImmersionConclusion.REJECTED]: 'Non concluant',
    [ImmersionConclusion.CONTRACT]: 'Contrat',
}

export const IMMERSION_CONCLUSION_BADGE_CLASS: Record<ImmersionConclusion, string> = {
    [ImmersionConclusion.REJECTED]: 'bg-danger text-white',
    [ImmersionConclusion.CONTRACT]: 'bg-success text-white',
}
