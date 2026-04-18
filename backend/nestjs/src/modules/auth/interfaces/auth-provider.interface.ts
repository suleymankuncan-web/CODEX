import { AuthenticatedUser } from "../auth-context.service";

export interface AuthProvider {
  resolveUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<AuthenticatedUser | null>;
}
