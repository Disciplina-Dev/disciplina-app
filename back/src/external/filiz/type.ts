export interface FilizToken {
    access_token: string;
    expires_in: number;
    token_type: string;
}

export interface FilizDegree {
    degreeId: string;
    degreeTitle: string;
    preparedTitleName: string;
}

export interface FilizClass {
    degreeId: string;
    classId: string;
    className: string;
    startDate: string;
    endDate: string;
}
