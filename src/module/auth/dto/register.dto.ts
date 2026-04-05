import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'John', description: 'User first name' })
    @IsString()
    firstName: string;

    @ApiProperty({ example: 'Doe', description: 'User last name' })
    @IsString()
    lastName: string;
    
    @ApiProperty({ example: 'user@example.com', description: 'User email' })
    @IsEmail()
    email: string;
  
    @ApiProperty({ example: 'password123', description: 'User password (min 6 characters)', minLength: 6 })
    @IsString()
    @MinLength(6)
    password: string;
}
