import { describe, expect, it } from "vitest";
import { campaignLink, classifyTraffic, deviceOf, slugify } from "@/shared/lib/traffic";

const SITE = "https://boulboul.example";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

describe("classifyTraffic", () => {
  it("uses utm_source first, with aliases", () => {
    const t = classifyTraffic({ url: `${SITE}/wall-art?utm_source=IG&utm_medium=Story&utm_campaign=Ramadan 2027`, referrer: null, userAgent: IPHONE });
    expect(t).toMatchObject({ source: "instagram", medium: "story", campaign: "ramadan-2027", landingPath: "/wall-art" });
  });

  it("keeps custom utm sources (e.g. an influencer)", () => {
    expect(classifyTraffic({ url: `${SITE}/?utm_source=Sara_Deco`, referrer: null }).source).toBe("sara_deco");
  });

  it("detects social in-app browsers that hide the referrer", () => {
    expect(classifyTraffic({ url: `${SITE}/`, referrer: null, userAgent: `${IPHONE} Instagram 350.0.0` }).source).toBe("instagram");
    expect(classifyTraffic({ url: `${SITE}/`, referrer: null, userAgent: `${IPHONE} [FBAN/FBIOS;FBAV/480.0]` }).source).toBe("facebook");
    expect(classifyTraffic({ url: `${SITE}/`, referrer: null, userAgent: `${IPHONE} musical_ly_37.0 BytedanceWebview/d8a21c6` }).source).toBe("tiktok");
  });

  it("maps referrer hosts, including link shims and search engines", () => {
    expect(classifyTraffic({ url: `${SITE}/`, referrer: "https://l.facebook.com/" }).source).toBe("facebook");
    expect(classifyTraffic({ url: `${SITE}/`, referrer: "https://www.google.dz/" }).source).toBe("google");
    expect(classifyTraffic({ url: `${SITE}/`, referrer: "https://youtu.be/abc" }).source).toBe("youtube");
    const other = classifyTraffic({ url: `${SITE}/`, referrer: "https://blog.example.org/post" });
    expect(other).toMatchObject({ source: "other", referrerHost: "blog.example.org" });
  });

  it("uses ad click ids, flags paid traffic, and falls back to direct", () => {
    expect(classifyTraffic({ url: `${SITE}/?ttclid=x`, referrer: null })).toMatchObject({ source: "tiktok", medium: "paid" });
    expect(classifyTraffic({ url: `${SITE}/?fbclid=x`, referrer: null }).source).toBe("facebook");
    expect(classifyTraffic({ url: `${SITE}/?gclid=x`, referrer: null })).toMatchObject({ source: "google", medium: "paid" });
    expect(classifyTraffic({ url: `${SITE}/`, referrer: `${SITE}/wall-art` })).toMatchObject({ source: "direct", referrerHost: null });
    expect(classifyTraffic({ url: `${SITE}/`, referrer: "" }).source).toBe("direct");
  });
});

describe("helpers", () => {
  it("slugify keeps only safe characters", () => {
    expect(slugify("  Été Promo!! <script> ")).toBe("ete-promo-script");
    expect(slugify("")).toBeNull();
  });

  it("deviceOf", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("desktop");
  });

  it("campaignLink builds a tracked URL", () => {
    expect(campaignLink(SITE, "/wall-art", { source: "tiktok", medium: "paid", campaign: "Miroirs LED" })).toBe(`${SITE}/wall-art?utm_source=tiktok&utm_medium=paid&utm_campaign=miroirs-led`);
  });
});
