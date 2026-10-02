<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
  <#if section == "header">
    ${kcSanitize(msg("errorTitle"))?no_esc}
  <#elseif section == "form">
    <div id="kc-error-message">
      <p class="instruction">${kcSanitize(message.summary)?no_esc}</p>
      <#if traceId??>
        <p class="instruction" id="traceId">${msg("traceIdSupportMessage", traceId)}</p>
      </#if>
      <#if !skipLink??>
        <#if (client?? && client.clientId == "store-ops-admin-web") || (!client?? && realm.name == "store-ops")>
          <a id="axis-error-login-return" class="axis-button axis-primary axis-login-return" href="/auth/login">${msg("axisRestartLogin")}</a>
        <#elseif client?? && (client.baseUrl)?has_content>
          <p><a id="backToApplication" href="${client.baseUrl}">${msg("backToApplication")}</a></p>
        </#if>
      </#if>
    </div>
  </#if>
</@layout.registrationLayout>
