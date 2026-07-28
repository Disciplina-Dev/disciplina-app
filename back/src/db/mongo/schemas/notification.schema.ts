import mongoose, { Schema, model, Document } from 'mongoose';
import { Notification } from '../../../types/notification.types';

const TTL_SECONDS = 48 * 60 * 60; // 48h

const notificationSchema = new Schema<Notification & Document>(
    {
        _id: { type: String, required: true },
        user_id: { type: Number, required: true, index: true },
        type: { type: String, required: true },
        category: { type: String, enum: ['candidate', 'company']},
        level: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
        title: { type: String, required: true },
        message: { type: String },
        link: { type: String },
        read: { type: Boolean, default: false },
        created_at: { type: Date, default: Date.now },
    },
    { collection: 'notifications' },
);

// Suppression automatique 48h après création (cache éphémère).
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: TTL_SECONDS });

export const NotificationModel =
    mongoose.models.Notification || model<Notification & Document>('Notification', notificationSchema);
