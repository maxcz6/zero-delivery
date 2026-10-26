import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHealthStatus() {
    return {
      status: "ok",
      service: "zero-delivery-api",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
