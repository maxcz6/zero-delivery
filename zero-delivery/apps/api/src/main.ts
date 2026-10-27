import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as express from "express";
import cookieParser = require("cookie-parser");
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  // Confiar en el primer proxy inverso (Caddy / Nginx / Cloudflare) en producción VPS
  app.set("trust proxy", 1);

  // Permitir subida de imágenes (fotos de platos, sucursales y comprobantes) manteniendo rawBody para firmas HMAC
  app.use(
    express.json({
      limit: "15mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  app.setGlobalPrefix("api/v1");

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    })
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const envOrigins = (process.env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const publicUrl = process.env["APP_PUBLIC_URL"]?.trim();
  const voceroPublicUrl = process.env["VOCERO_PUBLIC_URL"]?.trim();

  const allowedOrigins = Array.from(
    new Set([
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      ...(publicUrl ? [publicUrl] : []),
      ...(voceroPublicUrl ? [voceroPublicUrl] : []),
      ...envOrigins,
    ])
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones server-to-server (sin Origin) o incluidas en la lista blanca
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
        return;
      }
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Requested-With",
      "X-API-Key",
      "X-Vocero-Signature",
      "X-Vocero-Dispatch-Id",
      "X-Vocero-Organization",
      "X-Vocero-Event",
      "X-Signature",
    ],
  });

  const port = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`[Zero Delivery API] Backend corriendo en http://0.0.0.0:${port}/api/v1`);
}

void bootstrap();
