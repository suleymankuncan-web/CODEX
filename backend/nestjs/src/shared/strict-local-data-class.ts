type ConfigReader = { get(key: string): string | undefined };

export function assertStrictLocalDataClass(
  config: ConfigReader,
  input: {
    dataClass: string;
    isStrictLocal: boolean;
    processRole?: "runtime" | "migrator" | "synthetic-seed" | "identity-binder";
  },
): void {
  const companyEnabled = config.get("HR_AXIS_COMPANY_DATA_ENABLED");
  if (!input.isStrictLocal) {
    if (companyEnabled && companyEnabled !== "false") {
      throw new Error("Company data opt-in requires strict-local mode");
    }
    return;
  }
  if (input.dataClass === "synthetic" && (!companyEnabled || companyEnabled === "false")) return;
  if (input.dataClass !== "company" || companyEnabled !== "true") {
    throw new Error("HR_AXIS_DATA_CLASS=synthetic is required when HR_AXIS_STRICT_LOCAL=true unless company data is explicitly enabled");
  }
  const role = input.processRole ?? "runtime";
  if (role === "synthetic-seed" || role === "identity-binder") {
    throw new Error("Synthetic seed and identity binding are forbidden in company data mode");
  }
  if (config.get("PHOTO_MEDIA_STORAGE_ENABLED") === "true" ||
    config.get("KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED") === "true" ||
    config.get("KEYCLOAK_SYNTHETIC_SUBJECT_MANIFEST_FILE")) {
    throw new Error("Synthetic media and identity fixtures are forbidden in company data mode");
  }
  if (role === "runtime" && (config.get("AUTH_MODE") !== "jwt" ||
    config.get("BROWSER_SESSION_COOKIE_ENABLED") !== "true" || !config.get("JWT_JWKS_URL") ||
    config.get("ALLOW_MOCK_AUTH") !== "false" || config.get("MIGRATIONS_HTTP_ENABLED") !== "false")) {
    throw new Error("Company data runtime requires OIDC JWKS and browser cookie sessions");
  }
}
