<#ftl output_format="HTML" auto_esc=true>
<#-- Generated from shared/mail. Run backend mail:theme; do not edit. -->
<#macro emailLayout>
<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head><body style="margin:0;background:#f2f5ff;font-family:'Segoe UI', Arial, sans-serif;color:#06142d">
<div style="display:none;font-size:1px;color:#f2f5ff;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">HR Axis hesap bildirimi.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f2f5ff"><tr><td align="center" style="padding:18px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table class="axis-mail-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border-radius:22px;border:1px solid #dce4ff;box-shadow:0 18px 48px rgba(14,33,71,.08);table-layout:fixed"><tr><td style="padding:20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="136"><#if url??><img src="${url.resourcesUrl}/img/logo.png" width="128" height="40" alt="HR Axis" style="display:block;border:0"></#if></td><td align="right" style="font-size:10px;line-height:16px;color:#596780">Daha iyi<br>insan deneyimleri</td></tr></table>
<div style="border-top:1px solid #dce4ff;margin:14px 0"></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><#if url??><img src="${url.resourcesUrl}/img/security.png" width="96" height="96" alt="" style="display:block;border:0"></#if><h1 style="margin:10px 0 16px;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-.6px;overflow-wrap:anywhere"><span aria-hidden="true">🔐</span> ${subject}</h1></td></tr></table>
<#nested>

<div style="border-top:1px solid #dce4ff;margin:18px 0 12px"></div><p style="margin:0;text-align:center;font-size:11px;line-height:18px;color:#596780">HR Axis · Otomatik sistem bildirimi<br>Daha güçlü ekipler, daha parlak yarınlar</p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>
</#macro>
