import { renderMailHtml, type MailContent } from "./base.template";
import { passwordMailContent } from "./auth.template";

const themeHeader = '<#ftl output_format="HTML" auto_esc=true>\n<#-- Generated from shared/mail. Run backend mail:theme; do not edit. -->\n';

function themeHtml(content: MailContent): string {
  let html = renderMailHtml(content, { logo: "AXIS_LOGO", icon: "AXIS_ICON" });
  html = html.replace(/<img src="AXIS_LOGO"[^>]+>/, tag => `<#if url??>${tag.replace("AXIS_LOGO", '${url.resourcesUrl}/img/logo.png')}</#if>`);
  html = html.replace(/<img src="AXIS_ICON"[^>]+>/, tag => `<#if url??>${tag.replace("AXIS_ICON", '${url.resourcesUrl}/img/security.png')}</#if>`);
  return html;
}

function authHtml(kind: "setup" | "reset"): string {
  return themeHtml(passwordMailContent({ kind, url: "https://axis.invalid/AXIS_LINK", expiration: "AXIS_EXPIRATION" }))
    .replace('https://axis.invalid/AXIS_LINK', '${link}')
    .replace('AXIS_EXPIRATION', '${linkExpirationFormatter(linkExpiration)}')
    .replace('Merhaba,', '<#if (user.firstName!"")?has_content>Merhaba ${user.firstName},<#else>Merhaba,</#if>');
}

/** Only supported password actions get password copy. All other provider actions keep upstream content. */
export function buildKeycloakTemplates(): Record<string, string> {
  const generic = themeHtml({ title: "AXIS_SUBJECT", preheader: "HR Axis hesap bildirimi.", icon: "security", paragraphs: ["AXIS_NESTED"] })
    .replaceAll("AXIS_SUBJECT", "${subject}")
    .replace(/<p [^>]+>AXIS_NESTED<\/p>/, "<#nested>");
  const fallbackActions = '<#outputformat "plainText"><#assign requiredActionsText><#if requiredActions??><#list requiredActions as action>${msg("requiredAction." + action)}<#sep>, </#sep></#list></#if></#assign></#outputformat>\n<#import "template.ftl" as layout>\n<@layout.emailLayout>${kcSanitize(msg("executeActionsBodyHtml", link, linkExpiration, realmName, requiredActionsText, linkExpirationFormatter(linkExpiration)))?no_esc}</@layout.emailLayout>';
  return {
    "template.ftl": `${themeHeader}<#macro emailLayout>\n${generic}\n</#macro>\n`,
    "password-reset.ftl": `${themeHeader}${authHtml("reset")}\n`,
    "executeActions.ftl": `${themeHeader}<#if requiredActions?? && requiredActions?size == 2 && requiredActions?seq_contains("VERIFY_EMAIL") && requiredActions?seq_contains("UPDATE_PASSWORD")>\n${authHtml("setup")}\n<#elseif requiredActions?? && requiredActions?size == 1 && requiredActions?seq_contains("UPDATE_PASSWORD")>\n${authHtml("reset")}\n<#else>\n${fallbackActions}\n</#if>\n`,
  };
}
