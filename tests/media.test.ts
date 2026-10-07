import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { sanitizeFilename, sniffImageMime } from "@/backend/services/media";

describe("Upload validation", () => {
  it("detects real image types from their bytes", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer();
    const jpg = await sharp(png).jpeg().toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    const gif = await sharp(png).gif().toBuffer();
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(jpg)).toBe("image/jpeg");
    expect(sniffImageMime(webp)).toBe("image/webp");
    expect(sniffImageMime(gif)).toBe("image/gif");
  });

  it("rejects disguised files (HTML/SVG/scripts named .jpg)", () => {
    expect(sniffImageMime(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(sniffImageMime(Buffer.from("<?php echo 'x'; ?>            "))).toBeNull();
  });

  it("sanitises file names", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    const name = sanitizeFilename("Mon <désign> \"x\".png");
    expect(name).toBe("Mon design x.png");
    expect(sanitizeFilename("a<b>/c<script>.png")).not.toMatch(/[<>/\\]/);
  });
});
