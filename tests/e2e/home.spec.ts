import { test, expect } from "@playwright/test";

// Smoke test: the smallest end-to-end signal that the whole stack —
// Next.js, middleware, auth.js providers, Tailwind, Nunito font —
// boots cleanly. Unauthenticated traffic to / should be redirected
// to /signin, which renders the Google sign-in button.

test("unauthenticated visitor sees the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: /welcome to partyroom/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
});

test("auth providers endpoint advertises google", async ({ request }) => {
  const res = await request.get("/api/auth/providers");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty("google");
});
