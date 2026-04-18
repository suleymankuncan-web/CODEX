import { SetMetadata } from "@nestjs/common";

export type RequiredScope = "company" | "region" | "store" | "authenticated";

export const REQUIRED_SCOPE_KEY = "required_scope";
export const RequireScope = (scope: RequiredScope) =>
  SetMetadata(REQUIRED_SCOPE_KEY, scope);
