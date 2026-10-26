import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthService } from "../../modules/identity/auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let token: string | undefined = undefined;

    // 1. Extraer de cookie segura zd_session
    if (request.cookies && request.cookies["zd_session"]) {
      token = request.cookies["zd_session"];
    }

    // 2. Fallback cabecera Authorization: Bearer <token>
    if (!token && request.headers.authorization) {
      const parts = (request.headers.authorization as string).split(" ");
      if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException("Sesión no autenticada");
    }

    const actor = await this.authService.validateSession(token);
    request.actor = actor;
    request.user = actor;

    return true;
  }
}
