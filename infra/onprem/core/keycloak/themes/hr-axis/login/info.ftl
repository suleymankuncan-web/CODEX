<#import "template.ftl" as layout>
<#assign axisAccountComplete = client?? && client.clientId == "store-ops-admin-web"
  && messageHeader?? && messageHeader == "accountUpdatedTitle"
  && message?has_content && message.type == "success"
  && (requiredActions![])?size == 0 && !(actionUri!"")?has_content>
<@layout.registrationLayout displayMessage=false; section>
  <#if section == "header">
    <#if axisAccountComplete>
      ${msg("axisAccountCompleteTitle")}
    <#elseif messageHeader??>
      ${kcSanitize(msg(messageHeader))?no_esc}
    <#else>
      ${message.summary}
    </#if>
  <#elseif section == "form">
    <div id="kc-info-message">
      <#if axisAccountComplete>
        <p class="instruction">${msg("axisAccountCompleteBody")}</p>
        <a id="axis-login-return" class="axis-button axis-primary axis-login-return" href="/auth/login">${msg("axisAccountCompleteLogin")}</a>
      <#else>
        <p class="instruction">${message.summary}<#if requiredActions?has_content>: <b><#list requiredActions as action>${kcSanitize(msg("requiredAction." + action))?no_esc}<#sep>, </#sep></#list></b></#if></p>
        <#if !skipLink??>
          <#if pageRedirectUri?has_content>
            <p><a href="${pageRedirectUri}">${msg("backToApplication")}</a></p>
          <#elseif actionUri?has_content>
            <p><a href="${actionUri}">${msg("proceedWithAction")}</a></p>
          <#elseif client?? && (client.baseUrl)?has_content>
            <p><a href="${client.baseUrl}">${msg("backToApplication")}</a></p>
          </#if>
        </#if>
      </#if>
    </div>
  </#if>
</@layout.registrationLayout>
