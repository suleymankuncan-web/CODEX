/** HR Axis mail identity. All renderers and the generated Keycloak theme use this. */
export const mailVisualLanguage = {
  background: "#f2f5ff",
  surface: "#ffffff",
  ink: "#06142d",
  muted: "#596780",
  primary: "#325daf",
  accent: "#7367cf",
  border: "#dce4ff",
  info: "#eef2ff",
  warning: "#fff7e6",
  warningInk: "#7c3f00",
  font: "'Segoe UI', Arial, sans-serif",
  width: 600,
  radius: 22,
  padding: 20,
  headingSize: 26,
  operationalHeadingSize: 22,
  bodySize: 15,
  iconSize: 96,
  operationalIconSize: 48,
} as const;

export type MailIcon = "security" | "approval" | "people" | "sync";
export const mailEmoji: Record<MailIcon, string> = { security: "🔐", approval: "✅", people: "👥", sync: "⚠️" };

/** Small original vector family; rasterised for email clients, never external icon URLs. */
export function mailIconArtwork(icon: MailIcon): string {
  const shapes: Record<MailIcon, string> = {
    security: '<path d="M48 22 69 32v17c0 16-12 25-21 29-9-4-21-13-21-29V32z" fill="url(#shield)" stroke="#b4b5ee"/><rect x="39" y="45" width="18" height="16" rx="4" fill="#fff"/><path d="M42 45v-5a6 6 0 0 1 12 0v5"/><circle cx="48" cy="52" r="2" fill="#7367cf"/><path d="M48 54v3" stroke="#7367cf"/>',
    approval: '<rect x="29" y="25" width="38" height="49" rx="8" fill="url(#shield)" stroke="#b4b5ee"/><rect x="39" y="22" width="18" height="9" rx="4" fill="#fff"/><path d="m37 49 7 7 15-16M38 64h20"/>',
    people: '<circle cx="48" cy="37" r="10" fill="url(#shield)" stroke="#b4b5ee"/><path d="M29 69v-6c0-11 9-17 19-17s19 6 19 17v6" fill="url(#shield)" stroke="#b4b5ee"/><path d="M23 43a8 8 0 0 1 5-14M68 29a8 8 0 0 1 5 14M21 62c0-8 4-13 10-15M65 47c6 2 10 7 10 15" stroke="#8c89d5"/>',
    sync: '<path d="M29 42a21 21 0 0 1 36-10l6 8M67 55a21 21 0 0 1-36 10l-6-8" stroke="url(#shield)" stroke-width="6"/><path d="M71 28v13H58M25 69V56h13" stroke="#7367cf"/><path d="M48 39v14" stroke="#325daf"/><circle cx="48" cy="60" r="2" fill="#325daf"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 96 96"><defs><linearGradient id="shield" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b9adf5"/><stop offset="1" stop-color="${mailVisualLanguage.primary}"/></linearGradient></defs><circle cx="48" cy="48" r="46" fill="#f7f5ff"/><circle cx="48" cy="48" r="35" fill="${mailVisualLanguage.info}"/><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${shapes[icon]}</g><circle cx="76" cy="20" r="3" fill="#9a91e8"/><circle cx="20" cy="73" r="2" fill="#b4b5ee"/></svg>`;
}
