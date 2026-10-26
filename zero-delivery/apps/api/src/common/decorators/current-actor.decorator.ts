import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ActorContext } from "@zero-delivery/shared-types";

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.actor;
  }
);
