export interface FilizDegreeRef {
    _id: string; // degreeId Filiz
    degree_type: string;
    title: string;
    prepared_title: string;
    synced_at: Date;
}

export interface FilizClassRef {
    _id: string; // classId Filiz
    degree_id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    apprenticeship_contract: boolean;
    professionalization_contract: boolean;
    synced_at: Date;
}
