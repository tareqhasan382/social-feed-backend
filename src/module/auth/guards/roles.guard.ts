import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { ROLES_KEY } from '../guards/roles.decorator';
  
  @Injectable()
  export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}
  
    canActivate(context: ExecutionContext): boolean {
      const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
  
      // No roles defined on route → allow access
      if (!requiredRoles) return true;
  
      const { user } = context.switchToHttp().getRequest();
  
      if (!requiredRoles.includes(user?.role)) {
        throw new ForbiddenException('You do not have permission');
      }
  
      return true;
    }
  }