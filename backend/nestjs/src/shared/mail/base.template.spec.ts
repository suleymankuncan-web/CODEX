import { renderBaseTemplate, renderMailHtml, type MailContent } from "./base.template";
import { buildKeycloakTemplates } from "./keycloak-theme";
import { incentiveHandoffContent, noPositiveSalesContent } from "./notification.templates";
import { incentiveApprovalContent, failedImportContent } from "./operational.templates";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as nodemailer from "nodemailer";

const content: MailContent = { title: "Şifrenizi yenileyin", preheader: "Hesap", icon: "security", paragraphs: ["İçerik"] };

describe("shared mail presentation contract", () => {
  it("escapes every content surface while preserving Turkish copy in plain text", () => {
    const attack = '<script>alert("x")</script>&';
    const mail = renderBaseTemplate({ ...content, title: attack, preheader: attack, greeting: attack,
      paragraphs: [attack], facts: [{ label: attack, value: attack }], rows: [{ primary: attack, secondary: attack }],
      notice: { text: attack }, footnote: attack, action: { label: attack, url: "https://example.test/reset?a=1&b=2" },
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;");
    expect(mail.html).toContain('href="https://example.test/reset?a=1&amp;b=2"');
    expect(mail.text).toContain(attack);
    expect(mail.text).toContain("https://example.test/reset?a=1&b=2");
  });

  it.each(["http://example.test", "javascript:alert(1)", "data:text/html,hi", "https://user:pass@example.test", "https://example.test/\nreset"])("rejects unsafe action %s", url => {
    expect(() => renderBaseTemplate({ ...content, action: { label: "Devam", url } })).toThrow();
  });

  it("keeps every real alert row rather than truncating personnel to fit the card", () => {
    const mail = renderBaseTemplate(noPositiveSalesContent(Array.from({ length: 75 }, (_, i) => ({ display_name: `Personel ${i}`, store_name: "LP Store", business_date: "2026-09-30" }))));
    for (let i = 0; i < 75; i++) expect(mail.text).toContain(`Personel ${i} · LP Store`);
    expect(mail.text).toContain("İadeler süreyi sıfırlamaz");
    expect(mail.text).toContain("prim kesintisi oluşturmaz");
  });

  it("packages real inline PNGs and emits multipart HTML/plain/CID MIME without network access", async () => {
    const rendered = renderBaseTemplate(content);
    for (const attachment of rendered.attachments) {
      expect(attachment.content.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(rendered.html).toContain(`cid:${attachment.cid}`);
    }
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix", disableFileAccess: true, disableUrlAccess: true });
    const result = await transport.sendMail({ from: "axis@example.test", to: "owner@example.test", subject: content.title, ...rendered });
    const mime = result.message.toString();
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain("multipart/related");
    expect(mime).toContain("Content-ID: <hr-axis-security>");
    expect(mime).toContain("Content-ID: <hr-axis-logo>");
  });

  it("does not invent amounts in final HR handoff or confuse it with stage approvals", () => {
    const final = renderBaseTemplate(incentiveHandoffContent({ companyName: "Lufian", period: "2026-09", filename: "Primler.xlsx" }));
    expect(final.text).toContain("Prim listesi onaylandı");
    expect(final.text).not.toContain("Mağaza ve personel");
    expect(final.text).not.toContain("Satış direktörü onayladı");
    expect(final.text).not.toContain("TL");
  });

  it.each(["region-manager","sales-director","hr","general-manager"] as const)("keeps %s approval mail to one named approval and detail link, without finances", stage => {
    const model = incentiveApprovalContent({stage,approverName:"Süleyman Kuncan",period:"Eylül 2026",detailUrl:"https://example.test/store/incentives?period=2026-09"});
    const mail = renderBaseTemplate(model);
    expect(model.layout).toBe("centered");
    expect(model.paragraphs).toEqual([]);
    expect(model.facts).toBeUndefined();
    expect(model.notice).toBeUndefined();
    expect(mail.text).toContain("📋 Prim detayına git");
    expect(mail.html).toContain("✅");
    expect(mail.text).not.toMatch(/TL|net satış|hedef|değişikliği|Şablon görünümü/);
    if(stage!=="hr") expect(mail.text).toContain("Süleyman Kuncan");
    else expect(mail.text).toContain("İnsan Kaynakları prim paketini onayladı");
    if(stage==="general-manager") expect(mail.text).toContain("Eylül 2026 primleri Süleyman Kuncan tarafından onaylanmıştır");
  });

  it("shows failed components without claiming a partial import succeeded", () => {
    const html = renderMailHtml(failedImportContent({ date: "2026-09-30", attempts: 3, components: ["Satışlar"], lastAttempt: "02:45" }));
    expect(html).toContain("Satışlar");
    expect(html).toContain("Eksik veriyi tamamlanmış kabul etmeyin");
  });

  it("keeps generated Keycloak templates in sync with the shared renderer and real provider attributes", () => {
    const themeDir = resolve(__dirname, "../../../../../infra/onprem/core/keycloak/themes/hr-axis/email/html");
    for (const [file, template] of Object.entries(buildKeycloakTemplates())) expect(readFileSync(resolve(themeDir, file), "utf8")).toBe(template);
    const templates = buildKeycloakTemplates();
    expect(templates["executeActions.ftl"]).toContain('requiredActions?seq_contains("VERIFY_EMAIL")');
    expect(templates["executeActions.ftl"]).toContain('requiredActions?size == 1');
    expect(templates["executeActions.ftl"]).toContain('kcSanitize(msg("executeActionsBodyHtml"');
    expect(templates["password-reset.ftl"]).toContain('${linkExpirationFormatter(linkExpiration)}');
    expect(templates["password-reset.ftl"]).toContain('href="${link}"');
    expect(templates["password-reset.ftl"]).not.toContain("30 dakika");
  });
});
