import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { generateOtp } from '../../utils/generateOtp';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/forgot-password.dto';
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRY = 300; // 5 minutes in seconds

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private jwt: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ================= REGISTER =================
  async register(dto: RegisterDto) {
    const { firstName, lastName, email, password } = dto;

    const existing = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (existing) throw new ConflictException('User already exists');

    const hashed = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashed,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isVerified: true,
        createdAt: true,
      },
    });

    // Generate and Store OTP in Redis
    const otpCode = generateOtp();
    await this.redis.setex(`otp:register:${email}`, this.OTP_EXPIRY, otpCode);

    await this.emailService.sendOtpEmail(email, otpCode, 'Registration OTP');

    return user;
  }

  // ================= LOGIN =================
  async login(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isVerified)
      throw new UnauthorizedException('Please verify your email first');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email);

    // Store refresh token in Redis for scaling/revocation
    await this.redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, tokens.refreshToken);

    return tokens;
  }

  // ================= VERIFY OTP =================
  async verifyOtp(dto: VerifyOtpDto) {
    const cachedOtp = await this.redis.get(`otp:register:${dto.email}`);

    if (!cachedOtp || cachedOtp !== dto.code) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Mark user as verified
    const user = await this.prisma.user.update({
      where: { email: dto.email },
      data: { isVerified: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isVerified: true,
      },
    });

    // Delete OTP from cache after successful verification
    await this.redis.del(`otp:register:${dto.email}`);

    return user;
  }

  // ================= RESEND OTP =================
  async resendOtp(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified)
      throw new BadRequestException('Email already verified');

    const otpCode = generateOtp();
    await this.redis.setex(`otp:register:${email}`, this.OTP_EXPIRY, otpCode);

    await this.emailService.sendOtpEmail(email, otpCode, 'Verification OTP (Resent)');

    return { message: 'OTP resent successfully' };
  }

  // ================= FORGOT PASSWORD =================
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });

    if (!user) throw new NotFoundException('User not found');

    const otp = generateOtp();
    await this.redis.setex(`otp:reset_password:${email}`, this.OTP_EXPIRY, otp);

    await this.emailService.sendPasswordResetEmail(email, otp);

    return { message: 'Password reset OTP sent to email' };
  }

  // ================= RESET PASSWORD =================
  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    const cachedOtp = await this.redis.get(`otp:reset_password:${email}`);
    if (!cachedOtp || cachedOtp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { email },
      data: { password: hashed },
    });

    await this.redis.del(`otp:reset_password:${email}`);

    return { message: 'Password reset successful' };
  }

  // ================= TOKENS =================
  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '1h',
      }),
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // ================= LOGOUT =================
  async logout(userId: string) {
    await this.redis.del(`refresh_token:${userId}`);
    return { message: 'Logged out successfully' };
  }
}
