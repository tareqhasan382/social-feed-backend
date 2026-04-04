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
      secure: false,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  // ========================
  // Generic Email Sender
  // ========================
  async sendMail(params: {
    to: string;
    subject: string;
    html: string;
  }) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM'),
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      this.logger.log(`Email sent to ${params.to}`);
    } catch (error) {
      this.logger.error(`Email sending failed to ${params.to}`, error);
      throw error;
    }
  }

  // ========================
  // Template Renderer
  // ========================
  private baseTemplate(content: string): string {
    return `
      <div style="font-family: Arial; padding: 20px;">
        <div style="max-width: 500px; margin: auto;">
          <h2 style="color: #333;">POS SaaS</h2>
          <hr />
          ${content}
          <hr />
          <p style="font-size: 12px; color: gray;">
            If you did not request this, please ignore this email.
          </p>
        </div>
      </div>
    `;
  }

  private otpTemplate(title: string, otp: string): string {
    return this.baseTemplate(`
      <h3>${title}</h3>
      <p>Your OTP code is:</p>
      <h1 style="letter-spacing: 4px;">${otp}</h1>
      <p>This code will expire in 5 minutes.</p>
    `);
  }

  // ========================
  // OTP Email (Generic)
  // ========================
  async sendOtpEmail(to: string, otp: string, title = 'OTP Verification') {
    return this.sendMail({
      to,
      subject: title,
      html: this.otpTemplate(title, otp),
    });
  }

  // ========================
  // Password Reset Email
  // ========================
  async sendPasswordResetEmail(to: string, otp: string) {
    return this.sendOtpEmail(to, otp, 'Password Reset OTP');
  }
}