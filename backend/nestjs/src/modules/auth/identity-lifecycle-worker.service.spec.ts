import { IdentityLifecycleWorkerService } from "./identity-lifecycle-worker.service";
import type { IdentityLifecycleRepository, IdentityUserSnapshot } from "./identity-lifecycle.repository";
import type { KeycloakAdminClient } from "./keycloak-admin.client";

describe("IdentityLifecycleWorkerService", () => {
  const user: IdentityUserSnapshot = {
    user_id: "user-1",
    employee_id: "employee-1",
    username: "ada.lovelace",
    email: "ada@example.test",
    provider_subject: null,
    is_active: false,
    first_name: "Ada",
    last_name: "Lovelace",
    role_codes: ["STORE_PERSONNEL"],
    company_ids: ["company-1"],
    region_ids: ["region-1"],
    store_ids: ["store-1"],
    assigned_store_ids: ["store-1"],
  };

  it("disables a provisioned identity when offboarding superseded the claimed job", async () => {
    const repository = {
      claimNext: jest.fn()
        .mockResolvedValueOnce({ identity_lifecycle_job_id: "job-1", user_id: "user-1", operation: "provision", attempts: 1 })
        .mockResolvedValueOnce(null),
      getUserSnapshot: jest.fn().mockResolvedValue(user),
      completeProvision: jest.fn().mockResolvedValue(false),
      retry: jest.fn(),
    } as unknown as IdentityLifecycleRepository;
    const keycloak = {
      configured: true,
      provision: jest.fn().mockResolvedValue("subject-1"),
      disable: jest.fn().mockResolvedValue(undefined),
    } as unknown as KeycloakAdminClient;
    const service = new IdentityLifecycleWorkerService(repository, keycloak);

    await (service as unknown as { drain(): Promise<void> }).drain();

    expect(keycloak.disable).toHaveBeenCalledWith("subject-1");
    expect(repository.retry).not.toHaveBeenCalled();
  });

  it("re-disables an identity when offboarding supersedes a claimed enable job", async () => {
    const repository = {
      claimNext: jest.fn()
        .mockResolvedValueOnce({ identity_lifecycle_job_id: "job-2", user_id: "user-1", operation: "enable", attempts: 1 })
        .mockResolvedValueOnce(null),
      getUserSnapshot: jest.fn().mockResolvedValue({ ...user, provider_subject: "subject-1" }),
      completeEnable: jest.fn().mockResolvedValue(false),
      retry: jest.fn(),
    } as unknown as IdentityLifecycleRepository;
    const keycloak = {
      configured: true,
      enable: jest.fn().mockResolvedValue(undefined),
      disable: jest.fn().mockResolvedValue(undefined),
    } as unknown as KeycloakAdminClient;
    const service = new IdentityLifecycleWorkerService(repository, keycloak);

    await (service as unknown as { drain(): Promise<void> }).drain();

    expect(keycloak.enable).toHaveBeenCalled();
    expect(keycloak.disable).toHaveBeenCalledWith("subject-1");
    expect(repository.retry).not.toHaveBeenCalled();
  });
});
