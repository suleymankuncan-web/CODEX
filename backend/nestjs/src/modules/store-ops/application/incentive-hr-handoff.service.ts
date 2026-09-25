import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { IncentiveHrHandoffRepository, hrSnapshotReady, hrSnapshotVersion, type HrSnapshot, type HrDeliveryConfig } from "../infrastructure/incentive-hr-handoff.repository";
import { IncentiveHrMailer } from "../infrastructure/incentive-hr-mailer";
import { incentiveFinalApprovalCompanyIds } from "./incentive-final-approval-scope";
import { buildIncentiveHrWorkbook, sumHrMoney } from "./incentive-hr-workbook";

@Injectable()
export class IncentiveHrHandoffService {
  constructor(private readonly repository: IncentiveHrHandoffRepository, private readonly mailer: IncentiveHrMailer) {}

  async preview(actor: AuthenticatedUser, period: string) {
    const companyIds = incentiveFinalApprovalCompanyIds(actor).sort();
    const snapshot = await this.repository.read(period, companyIds);
    return this.summary(period, snapshot, this.deliveryConfig(snapshot));
  }

  async send(actor: AuthenticatedUser, period: string, version: string) {
    const companyIds = incentiveFinalApprovalCompanyIds(actor).sort();
    const snapshot = await this.repository.read(period, companyIds);
    const config = this.deliveryConfig(snapshot);
    const preview = this.summary(period, snapshot, config);
    if (preview.version !== version) throw new BadRequestException("Dönem veya alıcı bilgileri değişti. Özeti yeniden açın.");
    if (!preview.canSend) throw new BadRequestException("İK gönderimi için tüm müdür paketlerinin onaylanması ve e-posta ayarlarının tamamlanması gerekir.");
    const attachments = preview.companies.filter(company => company.status === "not_sent").map(company => {
      const buffer = buildIncentiveHrWorkbook(period, snapshot.packages.filter(row => row.company_id === company.companyId), snapshot.rows.filter(row => row.company_id === company.companyId));
      if (buffer.length > 15 * 1024 * 1024) throw new BadRequestException("Prim dosyası e-posta eki sınırını aşıyor.");
      return { companyId: company.companyId, companyName: company.companyName, buffer, sha256: createHash("sha256").update(buffer).digest("hex") };
    });
    const claimed = await this.repository.claim({ period, companyIds, actorId: actor.userId, version, config, attachments });
    let uncertain = false;
    for (const delivery of claimed) {
      const attachment = attachments.find(item => item.companyId === delivery.company_id)!;
      try {
        const messageId = await this.mailer.send({ recipients: config.find(item => item.companyId === delivery.company_id)!.recipients, filename: `Primler-${period}.xlsx`, attachment: attachment.buffer, period, companyName: attachment.companyName, deliveryId: delivery.delivery_id });
        await this.repository.finish(delivery.delivery_id, "sent", messageId);
      } catch {
        // A timeout or partial SMTP acceptance can already have delivered the attachment.
        // Persist uncertainty and never automatically repeat this company-period send.
        uncertain = true;
        await this.repository.finish(delivery.delivery_id, "uncertain", null);
      }
    }
    if (uncertain) throw new ServiceUnavailableException("Bazı e-postaların gönderimi doğrulanamadı. Tekrar gönderilmedi; posta sunucusu kayıtları kontrol edilmeli.");
    return this.preview(actor, period);
  }

  private deliveryConfig(snapshot: HrSnapshot): HrDeliveryConfig[] {
    return [...new Set(snapshot.packages.map(row => row.company_id))].sort().map(companyId => ({ companyId, recipients: this.mailer.recipients(companyId) }));
  }

  private summary(period: string, snapshot: HrSnapshot, config: HrDeliveryConfig[]) {
    const allApproved = hrSnapshotReady(snapshot);
    const mailConfigured = this.mailer.ready();
    const companies = config.map(item => {
      const packages = snapshot.packages.filter(row => row.company_id === item.companyId);
      const rows = snapshot.rows.filter(row => row.company_id === item.companyId);
      const receipt = snapshot.deliveries.find(row => row.company_id === item.companyId);
      return { companyId: item.companyId, companyName: packages[0].company_name, recipients: item.recipients,
        managerPackageCount: packages.length, approvedPackageCount: packages.filter(row => row.package_status === "admin_approved").length,
        storeCount: new Set(packages.flatMap(row => row.store_ids)).size, personnelCount: rows.length,
        totalAmount: sumHrMoney(rows.map(row => row.final_amount)),
        status: receipt?.status ?? "not_sent", sentAt: receipt?.sent_at ?? null };
    });
    const canSend = allApproved && mailConfigured && companies.length > 0 && companies.every(company => company.recipients.length > 0 && ["not_sent", "sent"].includes(company.status)) && companies.some(company => company.status === "not_sent");
    return { period, version: hrSnapshotVersion(period, snapshot, config), allApproved, mailConfigured, canSend, companies };
  }
}
