import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { IdentityLifecycleRepository } from "./identity-lifecycle.repository";
import { KeycloakAdminClient } from "./keycloak-admin.client";

@Injectable()
export class IdentityLifecycleWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdentityLifecycleWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repository: IdentityLifecycleRepository,
    private readonly keycloak: KeycloakAdminClient,
  ) {}

  onModuleInit() {
    if (!this.keycloak.configured) {
      this.logger.warn("Keycloak identity lifecycle worker is disabled because runtime credentials are absent");
      return;
    }
    this.timer = setInterval(() => void this.drain(), 5_000);
    this.timer.unref();
    void this.drain();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (let index = 0; index < 20; index += 1) {
        const job = await this.repository.claimNext();
        if (!job) break;
        try {
          const user = await this.repository.getUserSnapshot(job.user_id);
          if (!user) throw new Error("identity_user_missing");
          if (job.operation === "provision") {
            const subject = await this.keycloak.provision(user);
            const completed = await this.repository.completeProvision(job.identity_lifecycle_job_id, user.user_id, subject);
            if (!completed) await this.keycloak.disable(subject);
          } else {
            if (!user.provider_subject) throw new Error("identity_subject_missing");
            if (job.operation === "disable") await this.keycloak.disable(user.provider_subject);
            else await this.keycloak.enable(user.provider_subject, user);
            const completed = job.operation === "enable"
              ? await this.repository.completeEnable(job.identity_lifecycle_job_id, user.user_id)
              : await this.repository.complete(job.identity_lifecycle_job_id);
            if (!completed && job.operation === "enable") await this.keycloak.disable(user.provider_subject);
          }
        } catch (error) {
          const code = sanitizeErrorCode(error);
          const terminal = await this.repository.retry(job.identity_lifecycle_job_id, job.attempts, code);
          this.logger.warn(`Identity lifecycle job ${terminal ? "failed" : "retry scheduled"}: ${code}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

function sanitizeErrorCode(error: unknown) {
  const raw = error instanceof Error ? error.message : "identity_lifecycle_failed";
  return /^[a-z0-9_]{1,80}$/i.test(raw) ? raw : "identity_lifecycle_failed";
}
