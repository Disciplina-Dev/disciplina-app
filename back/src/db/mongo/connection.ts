import mongoose from 'mongoose';
import { env } from '../../config/env';

const MONGO_URI = `mongodb://${env.MONGO_ROOT_USERNAME}:${env.MONGO_ROOT_PASSWORD}@nosql-db:${env.MONGO_PORT}/human_ressources?authSource=admin`;

export async function connectMongoDB(): Promise<void> {
    await mongoose.connect(MONGO_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    });
}
