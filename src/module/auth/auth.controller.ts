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
import { ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto, ResendOtpDto } from './dto/verify-otp.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';
import { Public } from './decorators/public.decorator';
@Public()
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ================= REGISTER =================
  @Post('register')
  @ApiBody({ type: CreateAuthDto })
  @ApiResponse({ status: 201 })
  async register(
    @Body() dto: CreateAuthDto,
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
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto, req);
  
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  
    return {
      success: true,
      data: { accessToken: tokens.accessToken },
    };
  }

  // ================= VERIFY OTP =================
  @Post('verify-otp')
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
  @Post('resend-otp')
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
  @Post('forgot-password')
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ================= RESET PASSWORD =================
  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ================= REFRESH TOKEN =================
  @Post('refresh-token')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
    //console.log("refresh-token---->",token)
  
    if (!token) throw new UnauthorizedException();
  
    const tokens = await this.authService.refreshToken(token, req);
  
    // res.cookie('refreshToken', tokens.refreshToken, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: 'strict',
    // });
  
    return {
      success: true,
      data: { accessToken: tokens },
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
  
    if (!token) throw new UnauthorizedException();
  
    await this.authService.logout(token, req);
  
    res.clearCookie('refreshToken');
  
    return { success: true };
  }

  @Post('logout-all')
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
  
    if (!token) throw new UnauthorizedException();
  
    await this.authService.logoutAll(token, req);
  
    res.clearCookie('refreshToken');
  
    return { success: true };
  }
}