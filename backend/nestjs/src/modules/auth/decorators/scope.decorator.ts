import { SetMetadata } from "@nestjs/common";

export type RequiredScope = "company" | "region" | "store" | "authenticated";
export type RequiredActionScope = "store" | "authenticated";

export const REQUIRED_SCOPE_KEY = "required_scope";
export const RequireScope = (scope: RequiredScope) =>
  SetMetadata(REQUIRED_SCOPE_KEY, scope);

export const REQUIRED_ACTION_SCOPE_KEY = "required_action_scope";
export const RequireActionScope = (scope: RequiredActionScope) =>
  SetMetadata(REQUIRED_ACTION_SCOPE_KEY, scope);
