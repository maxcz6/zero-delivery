import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    let message = "Error interno del servidor";
    let errors: unknown = undefined;
    let code: string | undefined = undefined;
    let extra: Record<string, unknown> = {};

    if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null
    ) {
      const respObj = exceptionResponse as Record<string, unknown>;
      message = (respObj["message"] as string) || message;
      errors = respObj["errors"];
      code = typeof respObj["code"] === "string" ? respObj["code"] : undefined;
      // Campos adicionales del contrato (p. ej. bloqueado_hasta en ACCOUNT_LOCKED).
      const { message: _m, errors: _e, code: _c, statusCode: _s, ...rest } = respObj;
      extra = rest;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Error: ${message}`,
        exception instanceof Error ? exception.stack : undefined
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(code ? { code } : {}),
      ...(errors ? { errors } : {}),
      ...extra,
    });
  }
}
