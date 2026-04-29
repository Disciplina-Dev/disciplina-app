import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { transporter } from './transporter';

export async function sendEmail(req: Request, res: Response) {
    const { to, subject, body, attachment } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Champs manquants : to, subject, body' });
    }

    const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ''),
    };

    if (attachment?.content && attachment?.filename) {
        mailOptions.attachments = [{
            filename: attachment.filename,
            content: Buffer.from(attachment.content, 'base64'),
            contentType: attachment.contentType,
        }];
    }

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (err: any) {
        console.error('Email send error:', err);
        res.status(500).json({ error: err.message });
    }
}
