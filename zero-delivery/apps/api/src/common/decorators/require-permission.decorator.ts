import { SetMetadata } from "@nestjs/common";
import { PermissionKey } from "@zero-delivery/shared-types";

export const PERMISSION_KEY = "permission";
export const RequirePermission = (permission: PermissionKey) => SetMetadata(PERMISSION_KEY, permission);
