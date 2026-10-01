import { AccountSecurityWorkerService } from "./account-security-worker.service";
import { AccountSecurityRepository } from "./account-security.repository";
import { KeycloakAdminClient } from "./keycloak-admin.client";

describe("password link worker", () => {
  const setup = (state = "queued") => {
    const link = { user_id: "user", provider_subject: "subject", email: "synthetic@example.invalid", kind: "reset", state };
    const repository = { getLink: jest.fn().mockResolvedValue(link), beginSend: jest.fn().mockResolvedValue(link),
      outcome: jest.fn(), claimObservations: jest.fn().mockResolvedValue([]), observe: jest.fn() };
    const provider = { passwordMetadata: jest.fn().mockResolvedValue({ state: "present", setAt: 1000 }), sendPasswordLink: jest.fn() };
    const service = new AccountSecurityWorkerService(repository as unknown as AccountSecurityRepository, provider as unknown as KeycloakAdminClient);
    return { repository, provider, service };
  };
  it("records SMTP acceptance separately from password completion", async () => {
    const { repository, provider, service } = setup();
    await service.send("job");
    expect(provider.sendPasswordLink).toHaveBeenCalledWith("subject", "reset");
    expect(repository.outcome).toHaveBeenCalledWith("job", "sent", null);
    expect(repository.observe).not.toHaveBeenCalled();
  });
  it.each(["sending", "sent", "unconfirmed", "completed", "failed"])("never automatically resends a durable %s request", async state => {
    const { provider, service } = setup(state);
    await service.send("job");
    expect(provider.passwordMetadata).not.toHaveBeenCalled();
    expect(provider.sendPasswordLink).not.toHaveBeenCalled();
  });
  it("refuses email when the current account binding changed", async () => {
    const { repository, provider, service } = setup();
    repository.beginSend.mockResolvedValue(null);
    await service.send("job");
    expect(provider.sendPasswordLink).not.toHaveBeenCalled();
    expect(repository.outcome).toHaveBeenCalledWith("job", "failed", "account_changed");
  });
  it.each(["keycloak_http_500", "private timeout URL", "keycloak_token_http_503"])("retains uncertainty without a blind send retry: %s", async error => {
    const { repository, provider, service } = setup();
    provider.sendPasswordLink.mockRejectedValue(new Error(error));
    await service.send("job");
    expect(repository.outcome).toHaveBeenCalledWith("job", "unconfirmed", "send_unconfirmed");
  });
  it.each(["keycloak_http_400_send_setup_email_user_disabled", "keycloak_http_404"])("records a definite rejection: %s", async error => {
    const { repository, provider, service } = setup();
    provider.sendPasswordLink.mockRejectedValue(new Error(error));
    await service.send("job");
    expect(repository.outcome).toHaveBeenCalledWith("job", "failed", "provider_rejected");
  });
  it("checks metadata ownership before the durable send boundary", async () => {
    const { repository, provider, service } = setup();
    provider.passwordMetadata.mockRejectedValue(new Error("keycloak_identity_owner_conflict"));
    await service.send("job");
    expect(repository.beginSend).not.toHaveBeenCalled();
    expect(provider.sendPasswordLink).not.toHaveBeenCalled();
    expect(repository.outcome).toHaveBeenCalledWith("job", "failed", "observation_unavailable");
  });
  it("bounds polling frequency and does not infer completion from unavailable observations", async () => {
    const { repository, provider, service } = setup();
    const claim = { user_id: "user", provider_subject: "subject", email: "synthetic@example.invalid", observation_id: "observation" };
    repository.claimObservations.mockResolvedValue([claim]);
    provider.passwordMetadata.mockRejectedValue(new Error("private provider detail"));
    await service.poll(); await service.poll();
    expect(repository.claimObservations).toHaveBeenCalledTimes(1);
    expect(repository.observe).toHaveBeenCalledWith(claim, null);
  });
});
