import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser = require("cookie-parser");
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

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

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ],
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
  await app.listen(port);
  console.log(`[Zero Delivery API] Backend corriendo en http://localhost:${port}/api/v1`);
}

void bootstrap();
