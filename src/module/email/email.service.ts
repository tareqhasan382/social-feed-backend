import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  async sendMail(params: {
    to: string;
    subject: string;
    html: string;
  }) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM', '"Buddy Script" <noreply@buddyscript.com>'),
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      this.logger.log(`Email sent successfully to ${params.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${params.to}`, error);
      throw error;
    }
  }

  private baseTemplate(content: string): string {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background-color: #f4f4f7; color: #333;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <div style="background-color: #4f46e5; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Buddy Script</h1>
          </div>
          <div style="padding: 40px;">
            ${content}
          </div>
          <div style="padding: 20px; background-color: #f9fafb; text-align: center; border-top: 1px solid #edf2f7;">
            <p style="font-size: 12px; color: #718096; margin: 0;">
              &copy; ${new Date().getFullYear()} Buddy Script. All rights reserved.
            </p>
            <p style="font-size: 12px; color: #a0aec0; margin-top: 5px;">
              If you did not request this, please ignore this email.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private otpTemplate(title: string, otp: string): string {
    return this.baseTemplate(`
      <h2 style="color: #1a202c; margin-top: 0;">${title}</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">
        To complete your request, please use the following verification code:
      </p>
      <div style="background-color: #f7fafc; border: 1px dashed #cbd5e0; padding: 20px; text-align: center; margin: 30px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${otp}</span>
      </div>
      <p style="font-size: 14px; color: #718096;">
        This code is valid for 5 minutes. Please do not share this code with anyone.
      </p>
    `);
  }

  async sendOtpEmail(to: string, otp: string, title = 'Email Verification') {
    return this.sendMail({
      to,
      subject: `[Buddy Script] ${title}`,
      html: this.otpTemplate(title, otp),
    });
  }

  async sendPasswordResetEmail(to: string, otp: string) {
    return this.sendOtpEmail(to, otp, 'Password Reset OTP');
  }
}
