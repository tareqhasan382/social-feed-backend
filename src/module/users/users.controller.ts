import {
  Controller,
  Get,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { UsersService } from './users.service';
import sendResponse from 'src/utils/sendResponse';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/request-with-user.interface';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


 @UseGuards(JwtAuthGuard)
 @Get('get-me')
 @ApiOperation({ summary: 'Get authenticated user profile' })
 async getMe(
   @Req() req: RequestWithUser,
   @Res() res: Response,
 ) {
  //console.log("req.user--------->",req.user)
   const data = await this.usersService.getMe(req.user.id);
   return sendResponse(res, {
     statusCode: HttpStatus.OK,
     success: true,
     message: 'Profile retrieved successfully.',
     data,
   });
 }
  //@Public()
  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  async findAll() {
    console.log("hit retrive all users")
    const data = await this.usersService.findAll();
    return data
  }

}