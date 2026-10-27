import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHealthStatus() {
    return {
      ok: true,
      status: "ok",
      service: "zero-delivery-api",
      version: "4.0.0",
      mode: "estándar",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
