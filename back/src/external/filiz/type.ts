import { Date } from 'mongoose';

export interface FilizToken {
    token: string;
    expires_in: number;
    token_type: string;
}
