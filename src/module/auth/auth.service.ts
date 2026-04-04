import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { EmailService } from '../email/email.service';
import { generateOtp } from '../../utils/generateOtp';

import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/forgot-password.dto';

import { OtpType, OtpChannel } from '../../../prisma/generated/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private jwt: JwtService
  ) {}

  // ================= REGISTER =================
  async register(dto: CreateAuthDto) {
    const { name, email, password } = dto;

    const existing = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (existing) throw new ConflictException('User already exists');

    const hashed = await bcrypt.hash(password, 13);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: `${name}'s Business` },
      });

      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashed,
          tenantId: tenant.id,
          role: 'OWNER',
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isVerified: true,
          tenantId: true,
          createdAt: true,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'FREE',
        },
      });

      return user;
    });

    // OTP outside transaction
    const otpCode = generateOtp();

    await this.prisma.otp.create({
      data: {
        email,
        code: otpCode,
        type: OtpType.REGISTER,
        channel: OtpChannel.EMAIL,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.emailService.sendOtpEmail(email, otpCode);

    return user;
  }

  // ================= LOGIN =================
  async login(dto: LoginDto, req: any) {
    const { email, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isVerified)
      throw new UnauthorizedException('User not verified');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email);

    return tokens;
  }

  // ================= VERIFY OTP =================
  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otp.findFirst({
      where: {
        email: dto.email,
        code: dto.code,
        type: OtpType.REGISTER,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new UnauthorizedException('Invalid OTP');
    if (otp.expiresAt < new Date())
      throw new UnauthorizedException('OTP expired');

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    const user = await this.prisma.user.update({
      where: {
        email_isDeleted: {
          email: dto.email,
          isDeleted: false,
        },
      },
      data: { isVerified: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        tenantId: true,
        createdAt: true,
      },
    });

    return user;
  }

  // ================= RESEND OTP =================
  async resendOtp(email: string) {
    const lastOtp = await this.prisma.otp.findFirst({
      where: { email, type: OtpType.REGISTER },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < 60_000) {
      throw new BadRequestException('Wait before requesting another OTP');
    }

    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified)
      throw new BadRequestException('Already verified');

    const otpCode = generateOtp();

    await this.prisma.otp.create({
      data: {
        email,
        code: otpCode,
        type: OtpType.REGISTER,
        channel: OtpChannel.EMAIL,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.emailService.sendOtpEmail(email, otpCode);

    return { message: 'OTP resent' };
  }

  // ================= FORGOT PASSWORD =================
  async forgotPassword(email: string) {
    const lastOtp = await this.prisma.otp.findFirst({
      where: { email, type: OtpType.RESET_PASSWORD },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < 60_000) {
      throw new BadRequestException('Wait before requesting another OTP');
    }

    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (!user) throw new NotFoundException('User not found');

    const otp = generateOtp();

    await this.prisma.otp.create({
      data: {
        email,
        code: otp,
        type: OtpType.RESET_PASSWORD,
        channel: OtpChannel.EMAIL,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.emailService.sendPasswordResetEmail(email, otp);

    return { message: 'OTP sent for password reset' };
  }

  // ================= RESET PASSWORD =================
  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        email,
        code: otp,
        type: OtpType.RESET_PASSWORD,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) throw new BadRequestException('Invalid OTP');
    if (otpRecord.expiresAt < new Date())
      throw new BadRequestException('OTP expired');

    const hashed = await bcrypt.hash(newPassword, 10);

    const user = await this.prisma.user.update({
      where: {
        email_isDeleted: {
          email,
          isDeleted: false,
        },
      },
      data: { password: hashed },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        tenantId: true,
        createdAt: true,
      },
    });

    await this.prisma.otp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    return user;
  }

  // ================= TOKENS =================
  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  // ================= REFRESH =================
  async refreshToken(token: string, req: any) {
    // const session = await this.sessionService.findByToken(token);

    // if (!session || session.isRevoked)
    //   throw new UnauthorizedException('Invalid session');

    // if (session.expiresAt < new Date())
    //   throw new UnauthorizedException('Session expired');

    // const payload = await this.jwt.verifyAsync(token, {
    //   secret: process.env.JWT_REFRESH_SECRET,
    // });

    // const user = await this.prisma.user.findUnique({
    //   where: { id: payload.sub },
    // });
    // if (!user) throw new NotFoundException('User not found');

    // const tokens = await this.generateTokens(user.id, user.email);

    // await this.sessionService.revokeSession(session.id);

    // await this.sessionService.createSession({
    //   userId: user.id,
    //   refreshToken: tokens.refreshToken,
    //   userAgent: req.headers['user-agent'],
    //   ipAddress: req.ip,
    // });

    return token;
  }

  // ================= LOGOUT =================
  async logout(token: string, req: any) {
    // const session = await this.sessionService.findByToken(token);
    // if (!session) throw new UnauthorizedException();

    // await this.sessionService.revokeSession(session.id);
  }

  async logoutAll(token: string, req: any) {
    // const session = await this.sessionService.findByToken(token);
    // if (!session) throw new UnauthorizedException();

    // await this.sessionService.revokeAllUserSessions(session.userId);
  }
}