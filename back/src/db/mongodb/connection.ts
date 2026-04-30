import mongoose from 'mongoose';
import dotenv from 'dotenv'

dotenv.config()
const ROOT = process.env.MONGO_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_ROOT_PASSWORD;
const PORT = process.env.MONGO_PORT;
const MONGO_URI = `mongodb://${ROOT}:${PASSWORD}@nosql-db:${PORT}/human_ressources?authSource=admin`;

export async function connectMongoDB(): Promise<void> {
    await mongoose.connect(MONGO_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    });
}
