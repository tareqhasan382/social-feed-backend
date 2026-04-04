import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateAuthDto {
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    name: string;
    
    @ApiProperty({ example: 'user@gmail.com' })
    @IsEmail()
    email: string;
  
    @ApiProperty({ example: '12345678' })
    @IsString()
    @MinLength(6)
    password: string;
}
