import { Injectable,UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
//import {jwtConstants} from '../../../common/jwt.constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService,private config: ConfigService, ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'fallback-secret',
      //secretOrKey: jwtConstants.secret,
    });
  }


  async validate(payload: any) {
   //console.log("payload-------->",payload)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    //console.log("user------------>", user);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isVerified !== true) {
      throw new UnauthorizedException('User is inactive');
    }

    const {
      password,
      ...safeUser
    } = user;

    // safeUser is now attached to req.user
    return safeUser;
  }
}