import {
  Controller,
  Get,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Patch,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UsersService } from './users.service';
import sendResponse from '../../utils/sendResponse';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/request-with-user.interface';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getMe(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    //console.log('getMe', req.user);
    const data = await this.usersService.getMe(req.user.id);
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Profile retrieved successfully.',
      data,
    });
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateMe(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateUserDto,
    @Res() res: Response,
  ) {
    const data = await this.usersService.update(req.user.id, dto);
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Profile updated successfully.',
      data,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  async findAll(@Res() res: Response) {
    const data = await this.usersService.findAll();
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Users retrieved successfully.',
      data,
    });
  }
}
