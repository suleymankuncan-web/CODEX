import freemarker.template.*;
import java.io.*;
import java.util.*;

/** Focused renderer check: java -cp <freemarker.jar> this-file.java <email-theme-dir>. */
class VerifyMailKeycloakTemplate {
    static Configuration configuration;
    static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }

    static Map<String, Object> model(List<String> actions) {
        Map<String, Object> data = new HashMap<>();
        data.put("subject", "HR Axis hesap işlemi");
        data.put("realmName", "HR Axis");
        data.put("link", "https://identity.example.test/action?key=private&client=axis");
        data.put("linkExpiration", 47);
        data.put("requiredActions", actions);
        data.put("url", Map.of("resourcesUrl", "https://identity.example.test/resources/mail"));
        data.put("user", Map.of("firstName", "<script>unsafe</script>"));
        data.put("linkExpirationFormatter", (TemplateMethodModelEx) args -> "47 dakika");
        data.put("msg", (TemplateMethodModelEx) args -> {
            String key = args.get(0).toString();
            if (key.equals("executeActionsBodyHtml")) return "<p>Provider actions: " + args.get(4).toString() + "</p>";
            return key;
        });
        data.put("kcSanitize", (TemplateMethodModelEx) args -> args.get(0).toString());
        return data;
    }

    static String render(String file, Map<String, Object> data) throws Exception {
        StringWriter result = new StringWriter();
        configuration.getTemplate("html/" + file).process(data, result);
        return result.toString();
    }

    static void authAssertions(String html) {
        require(html.contains("47 dakika"), "provider expiry must remain dynamic");
        require(html.contains("href=\"https://identity.example.test/action?key=private&amp;client=axis\""), "real link must be escaped once");
        require(html.contains("&lt;script&gt;unsafe&lt;/script&gt;"), "first name must be escaped");
        require(!html.contains("<script>"), "unescaped personal data");
        require(!html.contains("AXIS_"), "unresolved generator placeholder");
    }

    public static void main(String[] args) throws Exception {
        configuration = new Configuration(Configuration.VERSION_2_3_32);
        configuration.setDirectoryForTemplateLoading(new File(args[0]));
        configuration.setDefaultEncoding("UTF-8");
        configuration.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        configuration.setLogTemplateExceptions(false);
        configuration.setWrapUncheckedExceptions(true);
        String setup = render("executeActions.ftl", model(List.of("VERIFY_EMAIL", "UPDATE_PASSWORD")));
        require(setup.contains("Hesabınız hazır"), "setup copy");
        authAssertions(setup);
        String reset = render("executeActions.ftl", model(List.of("UPDATE_PASSWORD")));
        require(reset.contains("Şifrenizi yenileyin"), "admin reset copy");
        authAssertions(reset);
        authAssertions(render("password-reset.ftl", model(List.of())));
        String other = render("executeActions.ftl", model(List.of("UPDATE_PROFILE")));
        require(other.contains("Provider actions: requiredAction.UPDATE_PROFILE"), "other actions must retain provider content");
        require(!other.contains("Şifrenizi yenileyin"), "other actions must not become password reset");
        Map<String, Object> missingUrl = model(List.of("UPDATE_PASSWORD"));
        missingUrl.remove("url");
        missingUrl.put("user", Map.of());
        String textFallback = render("executeActions.ftl", missingUrl);
        require(textFallback.contains("Merhaba,"), "missing first name fallback");
        require(textFallback.contains("Şifremi yenile"), "missing image context must not hide action");
        require(!textFallback.contains("<img"), "missing URL must not emit broken resources");
        Map<String, Object> noActions = model(List.of());
        noActions.remove("requiredActions");
        require(render("executeActions.ftl", noActions).contains("Provider actions:"), "missing actions fallback");
        System.out.println("PASS: Keycloak FreeMarker setup/reset/other-actions/missing-context/escaping/expiry.");
    }
}
