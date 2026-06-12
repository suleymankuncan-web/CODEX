import {
  parseCookieHeader,
  serializeBrowserSessionCookie,
  serializeClearCookie,
} from "./browser-session-cookie";

describe("browser session cookies", () => {
  it("serializes host-only HttpOnly app-session cookies", () => {
    const cookie = serializeBrowserSessionCookie({
      httpOnly: true,
      maxAgeSeconds: 900,
      name: "hr_axis_browser_session",
      sameSite: "lax",
      secure: true,
      value: "signed.value",
    });

    expect(cookie).toContain("hr_axis_browser_session=signed.value");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Max-Age=900");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });

  it("clears readable compatibility cookies without forcing HttpOnly", () => {
    const cookie = serializeClearCookie({
      httpOnly: false,
      name: "hr_axis_csrf_nonce",
      sameSite: "strict",
      secure: false,
    });

    expect(cookie).toContain("hr_axis_csrf_nonce=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).not.toContain("Domain=");
  });

  it("parses cookie headers by name", () => {
    expect(parseCookieHeader("a=1; hr_axis_browser_session=signed%2Evalue")).toEqual({
      a: "1",
      hr_axis_browser_session: "signed.value",
    });
  });

  it("ignores unrelated malformed cookie values instead of throwing", () => {
    expect(
      parseCookieHeader("tracking=100%; hr_axis_browser_session=signed%2Evalue"),
    ).toEqual({
      hr_axis_browser_session: "signed.value",
    });
  });
});
