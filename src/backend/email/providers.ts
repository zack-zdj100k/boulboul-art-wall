import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { env } from "@/backend/env";
import { logger } from "@/backend/logger";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string; from?: string };
export type SendResult = { id?: string };

export interface EmailProvider {
  name: string;
  send(message: OutgoingEmail): Promise<SendResult>;
}

/** Development: writes each email as an .html file under storage/emails/ so it can be opened in a browser. */
const logProvider: EmailProvider = {
  name: "log",
  async send(message) {
    const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "storage/emails");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${message.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.html`);
    await writeFile(file, message.html, "utf8");
    logger.info("Email written (log provider)", { to: message.to, subject: message.subject, file });
    return { id: path.basename(file) };
  },
};

function smtpProvider(): EmailProvider {
  // Gmail: smtp.gmail.com + an App Password, which Google displays in groups ("abcd efgh ijkl mnop").
  const gmail = /(^|\.)gmail\.com$/i.test(env.SMTP_HOST);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: gmail ? env.SMTP_PASSWORD.replace(/\s+/g, "") : env.SMTP_PASSWORD } : undefined,
    // A slow mail server must not hold up the order: failures are logged and can be resent.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    name: "smtp",
    async send(message) {
      const info = await transport.sendMail({ ...message, from: message.from ?? env.EMAIL_FROM });
      return { id: info.messageId };
    },
  };
}

function resendProvider(): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: message.from ?? env.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { id?: string };
      return { id: data.id };
    },
  };
}

/** Tests: keeps messages in memory; set `failNext` to simulate a provider outage. */
export const memoryProvider = {
  name: "memory",
  outbox: [] as OutgoingEmail[],
  failNext: false,
  async send(message: OutgoingEmail): Promise<SendResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Simulated provider failure");
    }
    this.outbox.push(message);
    return { id: `mem-${this.outbox.length}` };
  },
  reset() {
    this.outbox = [];
    this.failNext = false;
  },
};

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  switch (env.EMAIL_PROVIDER) {
    case "smtp":
      cached = smtpProvider();
      break;
    case "resend":
      cached = resendProvider();
      break;
    case "memory":
      cached = memoryProvider;
      break;
    default:
      cached = logProvider;
  }
  return cached;
}
