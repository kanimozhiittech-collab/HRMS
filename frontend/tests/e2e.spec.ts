import { expect, test } from "@playwright/test";

const API = "http://localhost:8000";
const SUPER = { email: "superadmin@hrms.com", password: "Admin@123" };

test.describe.configure({ mode: "serial" });

let token = "";

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/auth/login`, { data: SUPER });
  expect(res.ok()).toBeTruthy();
  token = (await res.json()).access_token;
});

/* ---------- Auth (no stored token) ---------- */

test.describe("auth", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login rejects wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("superadmin@hrms.com").fill(SUPER.email);
    await page.getByPlaceholder("••••••••").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Wrong email or password")).toBeVisible();
  });

  test("login works and lands on dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("superadmin@hrms.com").fill(SUPER.email);
    await page.getByPlaceholder("••••••••").fill(SUPER.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });
});

/* ---------- Console (token injected before each test) ---------- */

test.describe("super admin console", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem("hrms_token", t);
      localStorage.setItem(
        "hrms_user",
        JSON.stringify({ name: "Super Admin", role: "super_admin" }),
      );
    }, token);
  });

  test("dashboard shows KPIs and expiring subscriptions", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Total Companies")).toBeVisible();
    await expect(page.getByText("Revenue This Month")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Subscriptions Expiring Soon" }),
    ).toBeVisible();
    // Seeded: Coimbatore expires in 3 days -> must appear in expiring table
    await expect(
      page.getByRole("cell", { name: "Coimbatore Software Solutions" }),
    ).toBeVisible();
  });

  test("sidebar navigates to every page and shows badges", async ({ page }) => {
    await page.goto("/dashboard");
    // Pending Approvals badge >= 1 (Salem Auto Parts is pending)
    await expect(
      page.getByRole("link", { name: /Pending Approvals/ }),
    ).toContainText(/[1-9]/);

    const pages: [string, string][] = [
      ["Companies", "Companies"],
      ["Plans", "Subscription Plans"],
      ["Subscriptions", "Subscriptions"],
      ["Platform Users", "Platform Users"],
      ["Support Tickets", "Support Tickets"],
      ["Payments & Invoices", "Payments & Invoices"],
      ["Reports", "Reports & Analytics"],
      ["Audit Logs", "Audit Logs"],
      ["Global Settings", "Global Settings"],
      ["Notifications", "Notifications"],
    ];
    for (const [link, heading] of pages) {
      // Badge counts are part of the accessible name ("Support Tickets 3"),
      // so match on the label prefix instead of an exact name.
      await page
        .getByRole("link", { name: new RegExp(`^${link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })
        .first()
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    }
  });

  test("company can be registered and approved (temp password shown)", async ({
    page,
    request,
  }) => {
    // Register a fresh company through the public API
    const stamp = Date.now();
    const name = `E2E Test Co ${stamp}`;
    const plans = await (await request.get(`${API}/plans`)).json();
    const basic = plans.find((p: { plan_name: string }) => p.plan_name === "Basic");
    const reg = await request.post(`${API}/companies/register`, {
      data: {
        company_name: name,
        admin_name: "E2E Admin",
        admin_email: `e2e${stamp}@test.com`,
        phone: "9000000000",
        plan_id: basic.id,
      },
    });
    expect(reg.ok()).toBeTruthy();

    // Approve it from the UI
    await page.goto("/companies?status=pending");
    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Company Approved")).toBeVisible();
    await expect(page.getByText("Temp password:")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("div.fixed").click({ position: { x: 5, y: 5 } }); // close overlay

    // Now it should be listed as active
    await page.getByRole("button", { name: "Active", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
      "active",
    );
  });

  test("plan can be created and deactivated", async ({ page }) => {
    await page.goto("/plans");
    for (const p of ["Free", "Basic", "Professional", "Enterprise"]) {
      await expect(page.getByRole("heading", { name: p, exact: true })).toBeVisible();
    }

    const planName = `E2E Plan ${Date.now()}`;
    await page.getByRole("button", { name: "New Plan" }).click();
    await page.getByLabel("Plan name").fill(planName);
    await page.getByLabel("Monthly price (₹)").fill("499");
    await page.getByLabel("Max employees").fill("50");
    await page.getByLabel("Included modules (comma separated)")
      .fill("Attendance, Leave Management");
    await page.getByRole("button", { name: "Save Plan" }).click();

    const card = page.locator("div.rounded-2xl").filter({ hasText: planName });
    await expect(card.getByRole("heading", { name: planName })).toBeVisible();
    await expect(card.getByText("Attendance", { exact: true })).toBeVisible();

    await card.getByRole("button", { name: "Deactivate" }).click();
    await expect(card.getByText("inactive")).toBeVisible();
  });

  test("subscriptions: expiring tab, extend, expiry check", async ({ page }) => {
    await page.goto("/subscriptions");
    await page.getByRole("button", { name: "Expiring Soon" }).click();
    await expect(
      page.getByRole("cell", { name: "Coimbatore Software Solutions" }),
    ).toBeVisible();

    // Extend Chennai Textiles by 30 days
    await page.getByRole("button", { name: "All", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: "Chennai Textiles" });
    await row.getByRole("button", { name: "Extend" }).first().click();
    const modal = page.locator("div.fixed");
    await modal.getByLabel("Days to add").fill("30");
    await modal.getByRole("button", { name: "Extend", exact: true }).click();
    await expect(modal).toBeHidden();

    // Manual expiry check reports its result
    await page.getByRole("button", { name: "Run Expiry Check" }).click();
    await expect(page.getByText("Expiry check done")).toBeVisible();
  });

  test("invoice can be generated and marked paid", async ({ page }) => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "Generate Invoice" }).click();
    await page
      .getByLabel("Company")
      .selectOption({ label: "Chennai Textiles Pvt Ltd" });
    await page.getByRole("button", { name: "Create Invoice" }).click();
    await expect(page.locator("div.fixed")).toBeHidden();

    // Newest invoice is the first row — grab its invoice number
    const firstRow = page.getByRole("row").nth(1);
    await expect(firstRow).toContainText("pending");
    const invoice = await firstRow.getByRole("cell").first().innerText();

    await firstRow.getByRole("button", { name: "Mark Paid" }).click();
    const modal = page.locator("div.fixed");
    await modal.getByRole("button", { name: "Confirm Payment" }).click();
    await expect(modal).toBeHidden();
    await expect(
      page.getByRole("row").filter({ hasText: invoice }),
    ).toContainText("paid");
  });

  test("ticket status can be updated", async ({ page }) => {
    await page.goto("/tickets");
    const row = page
      .getByRole("row")
      .filter({ hasText: "Payroll module not loading" });
    await expect(row).toContainText("open");

    await row.locator("select").nth(1).selectOption("in_progress");
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "Payroll module not loading" }),
    ).toContainText("in progress");

    // put it back so demo data stays clean
    await page
      .getByRole("row")
      .filter({ hasText: "Payroll module not loading" })
      .locator("select")
      .nth(1)
      .selectOption("open");
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "Payroll module not loading" }),
    ).toContainText("open");
  });

  test("reports show revenue and distributions", async ({ page }) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { level: 1, name: "Reports & Analytics" }),
    ).toBeVisible();
    // Paid demo invoice (999) + the invoice paid in the test above -> total > 0
    await expect(page.getByText(/Total:/)).toContainText(/₹[1-9]/);
    await expect(page.getByText("Companies by Status")).toBeVisible();
    await expect(page.getByText("Companies by Plan")).toBeVisible();
    await expect(page.getByText("New Companies", { exact: true })).toBeVisible();
  });

  test("audit logs list recorded actions", async ({ page }) => {
    await page.goto("/audit-logs");
    await expect(
      page.getByRole("heading", { level: 1, name: "Audit Logs" }),
    ).toBeVisible();
    const rows = page.getByRole("row");
    await expect(rows.nth(1)).toBeVisible(); // at least one data row
  });

  test("settings can be edited and saved", async ({ page }) => {
    await page.goto("/settings");
    const row = page
      .locator("div.flex.flex-wrap")
      .filter({ hasText: "platform_name" });
    const input = row.locator("input");
    const original = await input.inputValue();

    await input.fill("E2E Platform Name");
    await page.getByRole("button", { name: /Save 1 change/ }).click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();
    await expect(input).toHaveValue("E2E Platform Name");

    // revert
    await input.fill(original);
    await page.getByRole("button", { name: /Save 1 change/ }).click();
    await expect(input).toHaveValue(original);
  });

  test("notifications can be marked read", async ({ page }) => {
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mark All Read" }).click();
    await page.getByRole("button", { name: "Unread Only" }).click();
    await expect(page.getByText("No notifications")).toBeVisible();
  });
});
