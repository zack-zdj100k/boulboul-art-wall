import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { prisma } from "@/server/db";
import { memoryProvider } from "@/server/email/providers";
import { authenticate, registerUser } from "@/server/services/user";
import { createOrder } from "@/server/services/order";
import { createProductFixture, createUser, customer, resetDb } from "./helpers";

const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string; fullName: string; role: "ADMIN" | "CUSTOMER" } }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => session.user }));
// Route handlers read the language cookie; outside a real request the locale is French.
vi.mock("@/i18n/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/i18n/server")>()), getLocale: async () => "fr" }));

beforeEach(async () => {
  await resetDb();
  memoryProvider.reset();
  session.user = null;
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
  async function postOrder(productId: string) {
    const { POST } = await import("@/app/api/orders/route");
    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ items: [{ productId, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer }),
    });
    return POST(req, { params: Promise.resolve({}) });
  }

  it("refuses visitors who are not signed in (401) and links the order to the account otherwise", async () => {
    const { product } = await createProductFixture();
    expect((await postOrder(product.id)).status).toBe(401);
    expect(await prisma.order.count()).toBe(0);
    const c = await createUser("CUSTOMER");
    session.user = { id: c.id, email: c.email, fullName: c.fullName, role: "CUSTOMER" };
    const res = await postOrder(product.id);
    expect(res.status).toBe(201);
    expect((await prisma.order.findFirstOrThrow()).userId).toBe(c.id);
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
