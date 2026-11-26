export interface FilizDegreeRef {
    _id: string; // degreeId Filiz
    degree_type: string;
    title: string;
    prepared_title: string;
    synced_at: Date;
}

export interface FilizPersonRef {
    first_name: string;
    last_name: string;
    mail_address: string;
}

export interface FilizAddressRef {
    housenumber: string;
    street: string;
    complement: string;
    city: string;
    postcode: string;
    country: string;
    formatted: string;
}

export interface FilizClassRef {
    _id: string; // classId Filiz
    degree_id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    apprenticeship_contract: boolean;
    professionalization_contract: boolean;
    head_teacher: FilizPersonRef | null;
    referent_teacher: FilizPersonRef | null;
    realization_address: FilizAddressRef | null;
    synced_at: Date;
}
