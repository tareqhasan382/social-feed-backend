import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @Length(4, 6)
  code: string;
}

export class ResendOtpDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}