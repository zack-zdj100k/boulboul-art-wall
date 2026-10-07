import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/backend/auth/password";
import { prisma } from "@/backend/db";
import { memoryProvider } from "@/backend/email/providers";
import { authenticate, registerUser } from "@/backend/services/user";
import { createOrder } from "@/backend/services/order";
import { createProductFixture, createUser, customer, resetDb } from "./helpers";

const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string; fullName: string; role: "ADMIN" | "CUSTOMER" } }));
const created = vi.hoisted(() => ({ sessions: [] as string[] }));
vi.mock("@/backend/auth/session", () => ({ getCurrentUser: async () => session.user, createSession: async (userId: string) => void created.sessions.push(userId) }));
// Traffic attribution reads a cookie; outside a real request, pretend the visitor came from TikTok.
vi.mock("@/backend/services/traffic", () => ({ readAttribution: async () => ({ source: "tiktok", campaign: "promo-led" }) }));
// Route handlers read the language cookie; outside a real request the locale is French.
vi.mock("@/shared/i18n/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/shared/i18n/server")>()), getLocale: async () => "fr" }));

beforeEach(async () => {
  await resetDb();
  memoryProvider.reset();
  session.user = null;
  created.sessions = [];
});

describe("Passwords", () => {
  it("are hashed with scrypt and never stored in plaintext", async () => {
    const hash = await hashPassword("Secret123");
    expect(hash).not.toContain("Secret123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Secret123", hash)).toBe(true);
    expect(await verifyPassword("secret123", hash)).toBe(false);
  });
});

describe("Registration & login", () => {
  const input = {
    fullName: "Yacine Test",
    age: 28,
    phone: "0661234567",
    email: "yacine@test.dz",
    password: "Password123",
    confirmPassword: "Password123",
    referralSource: "TIKTOK" as const,
    referralOther: undefined,
  };

  it("registers customers only (role can never come from the client)", async () => {
    const user = await registerUser({ ...input, role: "ADMIN" } as typeof input);
    expect(user.role).toBe("CUSTOMER");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).not.toContain("Password123");
  });

  it("rejects duplicate emails and wrong passwords", async () => {
    await registerUser(input);
    await expect(registerUser(input)).rejects.toMatchObject({ code: "errors.emailTaken" });
    await expect(authenticate(input.email, "WrongPass1")).rejects.toMatchObject({ code: "errors.invalidCredentials" });
    await expect(authenticate("nobody@test.dz", "WrongPass1")).rejects.toMatchObject({ code: "errors.invalidCredentials" });
    expect((await authenticate(input.email, input.password)).email).toBe(input.email);
  });
});

describe("Ordering requires an account", () => {
  const account = { age: 31, password: "Password123", confirmPassword: "Password123", referralSource: "INSTAGRAM" };

  async function postOrder(productId: string, extra: Record<string, unknown> = {}) {
    const { POST } = await import("@/app/api/orders/route");
    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ items: [{ productId, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer, ...extra }),
    });
    return POST(req, { params: Promise.resolve({}) });
  }

  it("links the order of a signed-in customer to their account", async () => {
    const { product } = await createProductFixture();
    const c = await createUser("CUSTOMER");
    session.user = { id: c.id, email: c.email, fullName: c.fullName, role: "CUSTOMER" };
    const res = await postOrder(product.id);
    expect(res.status).toBe(201);
    const order = await prisma.order.findFirstOrThrow();
    expect(order.userId).toBe(c.id);
    expect(order).toMatchObject({ trafficSource: "tiktok", trafficCampaign: "promo-led" });
    expect(created.sessions).toHaveLength(0);
  });

  it("refuses a visitor without account details, creates the account with the order otherwise", async () => {
    const { product } = await createProductFixture();
    expect((await postOrder(product.id)).status).toBe(422);
    expect((await postOrder(product.id, { account: { ...account, confirmPassword: "Other1234" } })).status).toBe(422);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);

    const res = await postOrder(product.id, { account });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: customer.email.toLowerCase() } });
    expect(user).toMatchObject({ role: "CUSTOMER", fullName: customer.customerName, age: 31, referralSource: "INSTAGRAM", signupSource: "tiktok" });
    expect(user.passwordHash).not.toContain("Password123");
    expect((await prisma.order.findFirstOrThrow()).userId).toBe(user.id);
    expect(created.sessions).toEqual([user.id]); // signed in right away
  });

  it("asks an existing customer to sign in, and never leaves an account behind when the order fails", async () => {
    const { product } = await createProductFixture();
    await createUser("CUSTOMER", customer.email.toLowerCase());
    const taken = await postOrder(product.id, { account });
    expect(taken.status).toBe(409);
    expect((await taken.json()).error.fields).toEqual({ "customer.email": "checkout.emailTaken" });

    await prisma.user.deleteMany();
    const bad = await postOrder(product.id, { account, customer: { ...customer, commune: "Commune inconnue" } });
    expect(bad.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("Admin authorization (server-side)", () => {
  async function patchStatus(orderId: string, status: string, origin = "http://localhost:3000") {
    const { PATCH } = await import("@/app/api/admin/orders/[id]/route");
    const req = new NextRequest(`http://localhost:3000/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ status }),
    });
    return PATCH(req, { params: Promise.resolve({ id: orderId }) });
  }

  async function seedOrder() {
    const { product } = await createProductFixture();
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    memoryProvider.reset();
    return order;
  }

  it("rejects anonymous visitors (401) and customers (403)", async () => {
    const order = await seedOrder();
    expect((await patchStatus(order.id, "CONFIRMED")).status).toBe(401);
    const c = await createUser("CUSTOMER");
    session.user = { id: c.id, email: c.email, fullName: c.fullName, role: "CUSTOMER" };
    expect((await patchStatus(order.id, "CONFIRMED")).status).toBe(403);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(memoryProvider.outbox).toHaveLength(0);
  });

  it("rejects cross-site requests even from an admin session (CSRF)", async () => {
    const order = await seedOrder();
    const a = await createUser("ADMIN");
    session.user = { id: a.id, email: a.email, fullName: a.fullName, role: "ADMIN" };
    expect((await patchStatus(order.id, "CONFIRMED", "https://evil.example")).status).toBe(403);
  });

  it("lets an admin confirm an order, which emails the customer", async () => {
    const order = await seedOrder();
    const a = await createUser("ADMIN");
    session.user = { id: a.id, email: a.email, fullName: a.fullName, role: "ADMIN" };
    const res = await patchStatus(order.id, "CONFIRMED");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "CONFIRMED", from: "PENDING", email: { ok: true } });
    expect(memoryProvider.outbox.map((m) => m.to)).toEqual(["amina@test.dz"]);
  });

  it("does not expose another customer's order through the public API", async () => {
    const order = await seedOrder();
    const { GET } = await import("@/app/api/orders/[orderNumber]/route");
    const req = (token = "") => new NextRequest(`http://localhost:3000/api/orders/${order.orderNumber}?token=${token}`);
    const ctx = { params: Promise.resolve({ orderNumber: order.orderNumber }) };
    expect((await GET(req("wrong"), ctx)).status).toBe(404);
    const ok = await GET(req(order.publicToken), ctx);
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.order.publicToken).toBeUndefined();
    expect(body.order.email).toBeUndefined();
  });
});
