export interface JwtUser {
    id: string;
    name: string;
    email: string;
    isVerified: boolean;
    role: string;
    tenantId: string;
  }
  
  export interface RequestWithUser extends Request {
    user: JwtUser;
  }