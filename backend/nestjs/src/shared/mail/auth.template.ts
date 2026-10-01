import type { MailContent } from "./base.template";

/** Presentation only. Link and lifetime must come from the identity provider. */
export function passwordMailContent(input: { kind: "setup" | "reset"; name?: string; url: string; expiration: string }): MailContent {
  const setup = input.kind === "setup";
  return {
    title: setup ? "Hesabınız hazır" : "Şifrenizi yenileyin", icon: "security",
    preheader: setup ? "HR Axis hesabınızın kurulumunu tamamlayın." : "HR Axis hesabınız için şifre yenileme bağlantısı.",
    greeting: input.name ? `Merhaba ${input.name},` : "Merhaba,",
    paragraphs: [setup ? "HR Axis hesabınızın kurulumunu tamamlamak için e-posta adresinizi doğrulayın ve şifrenizi oluşturun." : "HR Axis hesabınız için şifre yenileme talebi aldık. Şifrenizi güvenli bir şekilde yenilemek için aşağıdaki düğmeyi kullanabilirsiniz."],
    action: { label: setup ? "Hesabımı etkinleştir" : "Şifremi yenile", url: input.url },
    notice: { text: `Bu bağlantı ${input.expiration} boyunca geçerlidir.` },
    footnote: "Bu işlemi siz yapmadıysanız, bu e-postayı dikkate almayın.",
  };
}
