export const authFlowTr = {
  'authFlow.tenantProductTitle': 'Mağaza Yönetim Paneli',
  'authFlow.loginTitle': 'Giriş yap',
  'authFlow.emailLabel': 'E-posta',
  'authFlow.emailPlaceholder': 'ornek@lufian.com',
  'authFlow.passwordLabel': 'Şifre',
  'authFlow.passwordPlaceholder': 'Şifreniz',
  'authFlow.emailPasswordRequired': 'E-posta ve şifre gerekli.',
  'authFlow.emailPasswordFailed': 'E-posta veya şifre hatalı.',
  'authFlow.additionalVerificationRequired': 'Giriş için ek doğrulama gerekiyor.',
  'authFlow.loginSubmitting': 'Giriş yapılıyor',
  'authFlow.loginPreparing': 'Giriş hazırlanıyor',
  'authFlow.loginUnavailableButton': 'Giriş yapılamıyor',
  'authFlow.loginTemporarilyUnavailable': 'Giriş şu anda kullanılamıyor.',
  'authFlow.loginUnavailableCopy': 'Giriş başlatılamadı. Lütfen daha sonra tekrar dene.',
  'authFlow.loginHelpCopy': 'Erişim yetkin yoksa yöneticinle iletişime geç.',
  'authFlow.loginHeroEyebrow': 'Kimlik girişi',
  'authFlow.loginHeroTitle': 'Uygulama admin veya mağaza kabuklarını açmadan önce gerçek giriş buradan yapılacak.',
  'authFlow.loginHeroCopy':
    'Bu route gerçek kimlik doğrulama için Phase 7 giriş noktasıdır. Clerk artık tarayıcı oturumunu oluşturabilir; gerçek HR Axis rolleri ve kapsamı yine backend belirler.',
  'authFlow.route': 'Route',
  'authFlow.providerFlow': 'Sağlayıcı akışı',
  'authFlow.configured': 'Hazırlandı',
  'authFlow.needsEnv': 'Ortam gerekli',
  'authFlow.returnTo': 'Dönüş yolu',
  'authFlow.realAuthPath': 'Gerçek auth yolu',
  'authFlow.realAuthPathNote': 'Sağlayıcı ayarı hazır olduğunda bu route authorization code + PKCE başlatır.',
  'authFlow.sharedContract': 'Ortak kontrat',
  'authFlow.sharedContractNote': 'Admin ve mağaza kabukları tek bearer-token kontratını paylaşmaya devam eder.',
  'authFlow.manualFallback': 'Manuel yedek yol',
  'authFlow.manualFallbackNote': 'Sağlayıcı akışı devreye alınırken oturum kurulumu kullanılabilir kalır.',
  'authFlow.currentState': 'Mevcut durum',
  'authFlow.currentStateTitle': 'Bu route şu anda ne yapabilir',
  'authFlow.providerReady': 'Sağlayıcı hazır',
  'authFlow.scaffolded': 'İskelet',
  'authFlow.providerRedirect': 'Sağlayıcı yönlendirmesi',
  'authFlow.providerRedirectClerk':
    'Clerk yapılandırıldı; bu route hosted Clerk giriş akışını açabilir ve oluşan oturum tokenını backend bearer kontratına eşitleyebilir.',
  'authFlow.providerRedirectOidc':
    'OIDC tarzı sağlayıcı ayarları mevcut; bu route kullanıcıyı yapılandırılmış authorization endpointine devredebilir.',
  'authFlow.providerRedirectNeedsEnv':
    'Sağlayıcı kontratı bağlı, ancak gerçek yönlendirme için Clerk publishable key veya OIDC env-backed authorization ayarları gerekiyor.',
  'authFlow.returnPathAwareness': 'Dönüş yolu farkındalığı',
  'authFlow.returnPathAwarenessCopy':
    'Login girişi hedef kabuk yolunu koruyabilir; callback doğrulamadan sonra kullanıcıyı doğru yüzeye geri gönderebilir.',
  'authFlow.availableActions': 'Kullanılabilir aksiyonlar',
  'authFlow.availableActionsTitle': 'Bugüne uyan geçiş yolunu kullan',
  'authFlow.startProviderLogin': 'Sağlayıcı girişini başlat',
  'authFlow.simulateCallbackRoute': 'Callback route simülasyonu',
  'authFlow.manualSessionSetup': 'Manuel oturum kurulumu',
  'authFlow.providerLoginNotReady': 'Sağlayıcı girişi hazır değil: {error}',
  'authFlow.clerkReadyCopy':
    'Clerk kullanıcıyı içeri alır, frontend Clerk oturum tokenını mevcut bearer token olarak saklar ve /api/auth/session gerçek DB rolünü ve kapsamı çözer.',
  'authFlow.providerReadyCopy':
    'Sağlayıcı girişi /auth/callback üzerinden döner, kodu PKCE ile değiştirir ve doğrulanmış oturum /admin mi /store mu doğru iniş kabuğu kararını verir.',
  'authFlow.providerNeedsEnvCopy':
    'Bu sayfayı ana login geçişi olarak kullanmadan önce backend auth bootstrap config veya OIDC env değerlerini ekle.',
  'authFlow.contractShape': 'Kontrat şekli',
  'authFlow.contractShapeTitle': 'Frontend auth bootstrap beklentileri',
  'authFlow.loginHandoff': 'Login devri',
  'authFlow.loginHandoffCopy':
    'Env config üzerinden authorization URL oluştur, tarayıcıyı yönlendir, sonra sağlayıcı kodunu /auth/callback üzerinde al ve PKCE ile değiştir.',
  'authFlow.verificationGate': 'Doğrulama kapısı',
  'authFlow.verificationGateCopy':
    'Callback bearer tokenı yalnızca code exchange sonrası saklar. Kabuk seçimi yine /api/auth/session gerçek rol ve kapsam bağlamını doğruladıktan sonra yapılır.',
  'authFlow.clerkPublishableKeyMissingTitle': 'Clerk publishable key eksik',
  'authFlow.clerkPublishableKeyMissingCopy':
    'VITE_AUTH_PROVIDER clerk olarak ayarlı, ancak bu frontend build için VITE_CLERK_PUBLISHABLE_KEY yapılandırılmamış.',
  'authFlow.loadingClerk': 'Clerk yükleniyor',
  'authFlow.clerkSignedIn': 'Clerk oturumu açık',
  'authFlow.clerkSyncingUser': 'Oturum doğrulanıyor.',
  'authFlow.signInWithClerk': 'E-posta ile giriş yap',
  'authFlow.createClerkUser': 'Clerk kullanıcısı oluştur',

  'authFlow.callbackEyebrow': 'Kimlik callback',
  'authFlow.callbackFailedTitle': 'Login callback başarısız oldu',
  'authFlow.providerError': 'Sağlayıcı hatası',
  'authFlow.providerReturnedError':
    'Sağlayıcı {error} döndürdü. Entegrasyon tamamlanırken girişi yeniden dene veya manuel oturum kurulumuna dön.',
  'authFlow.secureExchangeFailedTitle': 'Güvenli login değişimi başarısız oldu',
  'authFlow.pkceError': 'PKCE hatası',
  'authFlow.bootstrapUnavailable': 'Auth bootstrap metadata kullanılamıyor',
  'authFlow.completingSecureLoginTitle': 'Güvenli giriş tamamlanıyor',
  'authFlow.completingSecureLoginCopy':
    'Callback authorization code aldı ve uygulama oturumunu açmadan önce kayıtlı PKCE verifier ile değiştiriyor.',
  'authFlow.noCredentialTitle': 'Callback credential bulunamadı',
  'authFlow.noCredentialCopy':
    'Bu callback route hazır, ancak query string veya URL hash içinde authorization `code`, `access_token` veya `token` bulunamadı.',
  'authFlow.manualTokenDisabledTitle': 'Manuel token callback kapalı',
  'authFlow.productionHardening': 'Production sertleştirme',
  'authFlow.manualTokenDisabledCopy':
    'Bu build yalnızca Authorization Code + PKCE callback yolunu kabul eder. Uygulamanın kodu değiştirip oturumu normal şekilde doğrulaması için sağlayıcı üzerinden girişi yeniden başlat.',
  'authFlow.placeholderReadyTitle': 'Callback route gerçek sağlayıcı yanıtı için hazır',
  'authFlow.placeholderToken': 'Yer tutucu token',
  'authFlow.placeholderReadyCopy':
    'Gerçek sağlayıcı daha sonra burada geçerli bir bearer token veya code exchange sonucu döndürecek. Bu yer tutucu, sahte tokenın kullanılabilir olduğunu iddia etmeden route ve handoff şeklini kanıtlar.',
  'authFlow.intendedReturnPath': 'Hedeflenen dönüş yolu: {returnTo}',
  'authFlow.completingLoginTitle': 'Giriş tamamlanıyor',
  'authFlow.completingLoginCopy':
    'Callback bearer token aldı, mevcut oturum olarak sakladı ve uygulamayı şimdi doğrulanmış kabuk akışına geri yönlendiriyor.',

  'authFlow.logoutTitle': 'Çıkış yapılıyor',
  'authFlow.logoutCopy':
    'İstemci bearer oturumu temizleniyor ve uygulama yapılandırılmış çıkış hedefine dönüyor.',
} as const

export const authFlowEn: Record<keyof typeof authFlowTr, string> = {
  'authFlow.tenantProductTitle': 'Store Management Panel',
  'authFlow.loginTitle': 'Sign in',
  'authFlow.emailLabel': 'Email',
  'authFlow.emailPlaceholder': 'name@lufian.com',
  'authFlow.passwordLabel': 'Password',
  'authFlow.passwordPlaceholder': 'Your password',
  'authFlow.emailPasswordRequired': 'Email and password are required.',
  'authFlow.emailPasswordFailed': 'Email or password is incorrect.',
  'authFlow.additionalVerificationRequired': 'Additional verification is required.',
  'authFlow.loginSubmitting': 'Signing in',
  'authFlow.loginPreparing': 'Preparing sign-in',
  'authFlow.loginUnavailableButton': 'Sign-in unavailable',
  'authFlow.loginTemporarilyUnavailable': 'Sign-in is currently unavailable.',
  'authFlow.loginUnavailableCopy': 'Sign-in could not be started. Please try again later.',
  'authFlow.loginHelpCopy': 'Contact your manager if you do not have access.',
  'authFlow.loginHeroEyebrow': 'Auth Entry',
  'authFlow.loginHeroTitle': 'Real login will enter here before the app opens admin or store shells.',
  'authFlow.loginHeroCopy':
    'This route is the Phase 7 entry point for real authentication. Clerk can now create the browser session, while the backend still decides the real HR Axis roles and scope.',
  'authFlow.route': 'Route',
  'authFlow.providerFlow': 'Provider flow',
  'authFlow.configured': 'Configured',
  'authFlow.needsEnv': 'Needs env',
  'authFlow.returnTo': 'Return to',
  'authFlow.realAuthPath': 'Real auth path',
  'authFlow.realAuthPathNote': 'This route now starts authorization code + PKCE when provider config is available.',
  'authFlow.sharedContract': 'Shared contract',
  'authFlow.sharedContractNote': 'Admin and store shells will still share one bearer-token contract.',
  'authFlow.manualFallback': 'Manual fallback',
  'authFlow.manualFallbackNote': 'Session setup remains available while the provider flow is being introduced.',
  'authFlow.currentState': 'Current State',
  'authFlow.currentStateTitle': 'What this route can do now',
  'authFlow.providerReady': 'Provider-ready',
  'authFlow.scaffolded': 'Scaffolded',
  'authFlow.providerRedirect': 'Provider redirect',
  'authFlow.providerRedirectClerk':
    'Clerk is configured, so this route can open the hosted Clerk sign-in flow and sync the resulting session token into the backend bearer contract.',
  'authFlow.providerRedirectOidc':
    'OIDC-style provider settings are present, so this route can hand the user off to the configured authorization endpoint.',
  'authFlow.providerRedirectNeedsEnv':
    'The provider contract is wired, but it still needs Clerk publishable key or OIDC env-backed authorization settings before this route can redirect for real.',
  'authFlow.returnPathAwareness': 'Return path awareness',
  'authFlow.returnPathAwarenessCopy':
    'The login entry can preserve a target shell path so the callback can send the user back into the correct surface after verification.',
  'authFlow.availableActions': 'Available Actions',
  'authFlow.availableActionsTitle': 'Use the transition path that fits today',
  'authFlow.startProviderLogin': 'Start provider login',
  'authFlow.simulateCallbackRoute': 'Simulate callback route',
  'authFlow.manualSessionSetup': 'Manual session setup',
  'authFlow.providerLoginNotReady': 'Provider login is not ready: {error}',
  'authFlow.clerkReadyCopy':
    'Clerk signs the user in, the frontend stores the Clerk session token as the current bearer token, and /api/auth/session resolves the actual DB role and scope.',
  'authFlow.providerReadyCopy':
    'Provider login will return through /auth/callback, exchange the code with PKCE, and let the verified session decide whether /admin or /store is the right landing shell.',
  'authFlow.providerNeedsEnvCopy':
    'Add backend auth bootstrap config or the OIDC env values before using this page as the primary login handoff.',
  'authFlow.contractShape': 'Contract Shape',
  'authFlow.contractShapeTitle': 'Frontend auth bootstrap expectations',
  'authFlow.loginHandoff': 'Login handoff',
  'authFlow.loginHandoffCopy':
    'Build an authorization URL from env config, redirect the browser, then receive the provider code at `/auth/callback` and exchange it with PKCE.',
  'authFlow.verificationGate': 'Verification gate',
  'authFlow.verificationGateCopy':
    'The callback only stores a bearer token after code exchange. Shell choice still happens after `/api/auth/session` confirms the real role and scope context.',
  'authFlow.clerkPublishableKeyMissingTitle': 'Clerk publishable key is missing',
  'authFlow.clerkPublishableKeyMissingCopy':
    'VITE_AUTH_PROVIDER is set to clerk, but VITE_CLERK_PUBLISHABLE_KEY is not configured for this frontend build.',
  'authFlow.loadingClerk': 'Loading Clerk',
  'authFlow.clerkSignedIn': 'Clerk signed in',
  'authFlow.clerkSyncingUser': 'Verifying session.',
  'authFlow.signInWithClerk': 'Sign in with email',
  'authFlow.createClerkUser': 'Create Clerk user',

  'authFlow.callbackEyebrow': 'Auth Callback',
  'authFlow.callbackFailedTitle': 'Login callback failed',
  'authFlow.providerError': 'Provider error',
  'authFlow.providerReturnedError':
    'The provider returned {error}. Retry login or fall back to manual session setup while the integration is still being finalized.',
  'authFlow.secureExchangeFailedTitle': 'Secure login exchange failed',
  'authFlow.pkceError': 'PKCE error',
  'authFlow.bootstrapUnavailable': 'Auth bootstrap metadata is unavailable',
  'authFlow.completingSecureLoginTitle': 'Completing secure login',
  'authFlow.completingSecureLoginCopy':
    'The callback received an authorization code and is exchanging it with the saved PKCE verifier before opening the app session.',
  'authFlow.noCredentialTitle': 'No callback credential found',
  'authFlow.noCredentialCopy':
    'This callback route is ready, but no authorization `code`, `access_token`, or `token` was found in the query string or URL hash.',
  'authFlow.manualTokenDisabledTitle': 'Manual token callback is disabled',
  'authFlow.productionHardening': 'Production hardening',
  'authFlow.manualTokenDisabledCopy':
    'This build only accepts the Authorization Code + PKCE callback path. Start login again through the provider so the app can exchange a code and verify the session normally.',
  'authFlow.placeholderReadyTitle': 'Callback route is ready for a real provider response',
  'authFlow.placeholderToken': 'Placeholder token',
  'authFlow.placeholderReadyCopy':
    'A real provider will later return a valid bearer token or code exchange result here. This placeholder proves the route and handoff shape without claiming that a fake token is usable.',
  'authFlow.intendedReturnPath': 'Intended return path: {returnTo}',
  'authFlow.completingLoginTitle': 'Completing login',
  'authFlow.completingLoginCopy':
    'The callback received a bearer token, stored it as the current session, and is routing the app back into the verified shell flow now.',
  'authFlow.logoutTitle': 'Signing out',
  'authFlow.logoutCopy':
    'The client bearer session is being cleared and the app is returning to the configured logout destination.',
}
