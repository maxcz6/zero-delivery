import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { loginSchema, LoginDto } from "./dto/login.dto";
import { ActorContext } from "@zero-delivery/shared-types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await this.authService.login(
      dto.inquilino_slug,
      dto.nombre_usuario,
      dto.password,
      ip,
      userAgent
    );

    // Establecer cookie HttpOnly zd_session
    res.cookie("zd_session", result.rawToken, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiraEn,
    });

    return {
      ok: true,
      // El token viaja únicamente en la cookie HttpOnly `zd_session`.
      // Exponerlo en el body anularía la protección frente a XSS.
      usuario: {
        id: result.usuario.id,
        nombre_usuario: result.usuario.nombre_usuario,
        nombre_mostrado: result.usuario.nombre_mostrado,
        rol: result.usuario.rol,
      },
      inquilino: {
        id: result.inquilino.id,
        slug: result.inquilino.slug,
        nombre: result.inquilino.nombre,
      },
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    let token = req.cookies?.["zd_session"] as string | undefined;
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
        token = parts[1];
      }
    }

    if (token) {
      await this.authService.logout(token);
    }

    res.clearCookie("zd_session", {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
    });

    return { ok: true, message: "Sesión cerrada correctamente" };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  getMe(@CurrentActor() actor: ActorContext) {
    return {
      ok: true,
      actor,
    };
  }
}
