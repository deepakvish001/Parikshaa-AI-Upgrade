import { expect, test, type Locator, type Page } from "@playwright/test";
import { local, SHORT, seedSitting } from "./support.js";

/**
 * The redesign plan's last pass (Phase E), in a real browser: a candidate
 * sits the whole paper with the keyboard alone, and at every stop the focus
 * can be seen; and the exam reads, to a screen reader, as a page of named
 * landmarks and controls.
 */

/** Whether what has focus shows it: an outline, or a ring drawn as a shadow. */
async function focusShows(page: Page): Promise<{ tag: string; name: string; shows: boolean }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || el === document.body) return { tag: "body", name: "", shows: true };
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== "none";
    const label = el.getAttribute("aria-label") ?? el.textContent ?? "";
    return { tag: el.tagName.toLowerCase(), name: label.trim().slice(0, 40), shows: outline || ring };
  });
}

/**
 * Tab until `target` has focus, checking each stop on the way shows its focus.
 * Back (Shift+Tab) when the control is above the focus: past the page's end,
 * Firefox takes the focus into its own toolbar, and it never comes back.
 * `back` says so where nothing has focus but the browser still starts from
 * below, as Firefox does from a control that has just gone.
 */
async function tabTo(page: Page, target: Locator, most = 80, back?: boolean): Promise<void> {
  back ??= await target.evaluate((el) => {
    const from = document.activeElement;
    return from !== null && from !== document.body && (el.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  for (let i = 0; i < most; i++) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    const stop = await focusShows(page);
    expect(stop.shows, `focus on ${stop.tag} "${stop.name}" cannot be seen`).toBe(true);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

test("a candidate sits the whole paper with the keyboard alone, and always sees where the focus is", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  await page.goto(local(sitting.links["CS001"]!));

  // Before the clock: the declaration, then begin.
  const declare = page.locator(".declare");
  await tabTo(page, declare.locator("input[type=checkbox]"));
  await page.keyboard.press("Space");
  await tabTo(page, declare.getByRole("button"));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  // The first question: B chooses the second option, S saves and moves on.
  await expect(page.getByRole("radio", { name: "Merge sort" })).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.getByRole("radio", { name: "Merge sort" })).toBeChecked();
  await page.keyboard.press("s");

  // The follow-up: its reply box, then Send.
  const probe = page.getByRole("region", { name: "Follow-up question" });
  await expect(probe).toBeVisible();
  await tabTo(page, probe.getByLabel("Your reply to the follow-up"));
  await page.keyboard.type("Merging never swaps equal elements.");
  await tabTo(page, probe.getByRole("button", { name: "Send reply" }));
  await page.keyboard.press("Enter");
  await expect(probe).toBeHidden();

  // The written question, typed and saved.
  const box = page.getByRole("textbox", { name: SHORT.stem });
  await tabTo(page, box);
  await page.keyboard.type("The interval halves every step.");
  await tabTo(page, page.locator(".qfoot").getByRole("button", { name: "Save answer" }));
  await page.keyboard.press("Enter");
  await expect(page.locator(".qfoot")).toContainText("Saved");

  // Submit, back up in the bar: the summary opens on "Keep working"; Tab to "Yes, submit".
  await tabTo(page, page.getByRole("button", { name: "Submit attempt" }));
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Submit your attempt?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep working" })).toBeFocused();
  await tabTo(page, dialog.getByRole("button", { name: "Yes, submit" }), 10);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();
});

test("the exam reads to a screen reader as named landmarks, a named question and a palette that says each state", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  await page.goto(local(sitting.links["CS001"]!));
  const declare = page.locator(".declare");
  await declare.locator("input[type=checkbox]").check();
  await declare.getByRole("button").click();
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  // Landmarks: the bar, the paper, and the palette as navigation.
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  const palette = page.getByRole("navigation", { name: "Questions" });
  await expect(palette).toBeAttached();

  // The question is a heading, its options a named group of radios.
  await expect(page.getByRole("heading", { name: /^1\. / })).toBeVisible();
  await expect(page.getByRole("radiogroup")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);

  // Each palette button says its question and its state, not only a colour or shape.
  await expect(palette.getByRole("button", { name: /^Question 1: / })).toBeAttached();
  await page.getByRole("radio", { name: "Merge sort" }).check();
  await page.locator(".qfoot").getByRole("button", { name: "Save & next" }).click();
  await expect(palette.getByRole("button", { name: "Question 1: Answered" })).toBeAttached();

  // The clock is read out as time, and says how long is left.
  const clock = page.getByRole("timer");
  await expect(clock).toBeAttached();
  await expect(clock).toHaveAccessibleName(/left|remaining/i);
});

test("an examiner signs in, opens an exam and works its menu with the keyboard alone", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  const { OWNER } = await import("./support.js");
  await page.goto("/console/");
  await tabTo(page, page.getByLabel("Email"));
  await page.keyboard.type(OWNER.email);
  await tabTo(page, page.getByLabel("Password", { exact: true }));
  await page.keyboard.type(OWNER.password);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

  // To the exams, then the exam, by Tab and Enter.
  await tabTo(page, page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Exams", exact: true }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("button", { name: sitting.title, exact: true }), 120);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: sitting.title })).toBeVisible();

  // The exam's "⋯", back up in its header: Enter opens it on its first item, arrows move, Escape closes it and gives focus back.
  const more = page.getByRole("button", { name: `More actions for ${sitting.title}` });
  await tabTo(page, more, 120, true);
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();
});
