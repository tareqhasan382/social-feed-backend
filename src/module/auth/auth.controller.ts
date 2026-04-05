import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiResponse, ApiBody, ApiOperation } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyOtpDto, ResendOtpDto } from './dto/verify-otp.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ================= REFRESH TOKEN =================
  @Public()
  @Post('refresh-token')
  @ApiOperation({ summary: 'Get new access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    //console.log("refesh api hit--------->")
    const tokens = await this.authService.refreshToken(dto);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      data: { 
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
    };
  }

  // ================= REGISTER =================
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User created successfully. OTP sent to email.' })
  async register(
    @Body() dto: RegisterDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.register(dto);

    return res.status(HttpStatus.CREATED).json({
      success: true,
      message: 'User created successfully. OTP sent to email.',
      data: result,
    });
  }

  // ================= LOGIN =================
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user and get tokens' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log("login api hit--------->")
    const {token,users} = await this.authService.login(dto);
  
    res.cookie('refreshToken', token.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  
    return {
      success: true,
      data: { 
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        user: users 
      },
    };
  }

  // ================= VERIFY OTP =================
  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify email OTP' })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto);

    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'OTP verified successfully',
      data: result,
    });
  }

  // ================= RESEND OTP =================
  @Public()
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend verification OTP' })
  @ApiBody({ type: ResendOtpDto })
  async resendOtp(
    @Body() dto: ResendOtpDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.resendOtp(dto.email);

    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'OTP resent successfully',
      data: result,
    });
  }

  // ================= FORGOT PASSWORD =================
  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ================= RESET PASSWORD =================
  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using OTP' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ================= LOGOUT =================
  @Post('logout')
  @ApiOperation({ summary: 'Logout user and clear session' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.id;
    if (userId) {
      await this.authService.logout(userId);
    }
    res.clearCookie('refreshToken');
    return { success: true, message: 'Logged out successfully' };
  }
}
