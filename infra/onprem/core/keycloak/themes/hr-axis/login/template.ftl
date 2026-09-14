<#import "theme-resources.ftl" as themeResourceTags>
<#macro icon name><img src="${url.resourcesPath}/img/${name}.svg" class="axis-icon" alt="" width="16" height="16"></#macro>
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f8fa">
  <title>${title!"HR Axis"}</title>
  <#list properties.styles?split(' ') as style>
    <link href="${url.resourcesPath}/${style}" rel="stylesheet">
  </#list>
  <script src="${url.resourcesPath}/js/login-studio.js" defer></script>
  <#-- Keep Keycloak 26.7.3's native session checking, passkey imports and extension scripts. -->
  <script type="importmap">
    {"imports":{"rfc4648":"${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"}}
  </script>
  <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
  <#if scripts??>
    <#list scripts as script><script src="${script}" type="text/javascript"></script></#list>
  </#if>
  <#if themeResources?? && themeResources.scripts?has_content>
    <@themeResourceTags.renderScripts themeResources.scripts url.resourcesPath "text/javascript" />
  </#if>
  <script type="module">
    <#outputformat "JavaScript">
    import { startSessionPolling } from ${(url.resourcesPath + "/js/authChecker.js")?c};
    startSessionPolling(${url.ssoLoginInOtherTabsUrl?c});
    </#outputformat>
  </script>
  <#if authenticationSession??>
    <script type="module">
      <#outputformat "JavaScript">
      import { checkAuthSession } from ${(url.resourcesPath + "/js/authChecker.js")?c};
      checkAuthSession(${authenticationSession.authSessionIdHash?c});
      </#outputformat>
    </script>
  </#if>
  <script type="module">
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-once-link]");
      if (!link) return;
      if (link.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }
      const { disabledClass } = link.dataset;
      if (disabledClass) link.classList.add(...disabledClass.trim().split(/\s+/));
      link.setAttribute("role", "link");
      link.setAttribute("aria-disabled", "true");
    });
  </script>
</head>
<body class="onprem-login-entry ${bodyClass}" data-page-id="login-${pageId}"
  data-username-placeholder="${msg('axisUsernamePlaceholder')}"
  data-password-placeholder="${msg('axisPasswordPlaceholder')}">
  <div class="login-site">
    <header class="site-header">
      <a href="${url.loginRestartFlowUrl}" class="brand" aria-label="HR Axis">
        <img src="${url.resourcesPath}/img/hr-axis-logo.png" alt="HR Axis" width="164" height="52">
      </a>
      <span class="header-caption">İnsan, her şeyin merkezinde.</span>
      <button type="button" class="help-button" id="axis-help-button" aria-expanded="false" aria-controls="axis-help">
        <@icon "life-buoy" /> ${msg("axisHelp")} <@icon "arrow-up-right" />
      </button>
    </header>
    <main class="login-stage">
      <img class="stage-image" src="${url.resourcesPath}/img/retail-editorial.png" alt="" fetchpriority="high">
      <div class="stage-shade" aria-hidden="true"></div>
      <section class="editorial-copy" aria-label="HR Axis'e hoş geldiniz">
        <div class="eyebrow"><span></span> HER GÜN, BİRLİKTE.</div>
        <h1>İyi bir gün, <br>seninle <br>başlar.</h1>
        <p>Ekibin, hedeflerin, tüm iş günün.<br>Hepsi aynı yerde.</p>
      </section>
      <section class="login-panel" aria-labelledby="kc-page-title">
        <div class="panel-brand"><span>LUFIAN</span><span class="panel-brand-line"></span><span>ÇALIŞAN PORTALI</span></div>
        <header class="welcome">
          <#if pageId == "login"><span class="welcome-kicker">YENİ BİR GÜNE</span></#if>
          <h2 id="kc-page-title"><#nested "header"></h2>
          <#if pageId == "login"><p>Devam etmek için hesabına giriş yap.</p></#if>
          <#if displayRequiredFields><p class="axis-required"><span aria-hidden="true">*</span> ${msg("requiredFields")}</p></#if>
          <#if auth?has_content && auth.showUsername() && !auth.showResetCredentials()>
            <#nested "show-username">
            <div id="kc-username">
              <span id="kc-attempted-username">${auth.attemptedUsername}</span>
              <a id="reset-login" href="${url.loginRestartFlowUrl}">${msg("restartLoginTooltip")}</a>
            </div>
          </#if>
        </header>
        <div id="kc-content">
          <div id="kc-content-wrapper">
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
              <div class="axis-message axis-message-${message.type}" role="<#if message.type == 'error'>alert<#else>status</#if>">
                ${kcSanitize(message.summary)?no_esc}
              </div>
            </#if>
            <#-- The inherited form owns loginAction, credentialId, field errors, rememberMe, reset and passkeys. -->
            <#nested "form">
            <span id="axis-caps-lock" class="field-error" role="status" hidden>${msg("axisCapsLock")}</span>
            <#if auth?has_content && auth.showTryAnotherWayLink()>
              <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                <input type="hidden" name="tryAnotherWay" value="on">
                <button type="submit" id="try-another-way" class="axis-secondary">${msg("doTryAnotherWay")}</button>
              </form>
            </#if>
            <#if switchOrganizationEnabled?? && switchOrganizationEnabled>
              <form id="kc-switch-organization-form" action="${url.loginAction}" method="post">
                <input type="hidden" name="switchOrganization" value="true">
                <button type="submit" id="switch-organization" class="axis-secondary">${msg("doSwitchOrganization")}</button>
              </form>
            </#if>
            <#nested "socialProviders">
            <#if displayInfo><div id="kc-info"><#nested "info"></div></#if>
          </div>
        </div>
        <aside id="axis-help" class="inline-notice" role="status" hidden>
          <div><strong>${msg("axisHelpTitle")}</strong><p>${msg("axisHelpBody")}</p></div>
          <button type="button" id="axis-help-close" aria-label="${msg('axisCloseHelp')}"><@icon "x" /></button>
        </aside>
        <div class="panel-footer"><@icon "lock-keyhole" /><span>Sana ait hesap. Ekibine açılan kapı.</span></div>
      </section>
    </main>
    <footer class="site-footer"><span>© ${.now?string("yyyy")} HR Axis</span><span>İyi işler, iyi ekiplerle.</span></footer>
  </div>
</body>
</html>
</#macro>
