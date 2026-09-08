import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isEmailish } from "../src/lib/validation";
import { buildReminderEmail } from "../src/lib/reminder-email";

describe("isEmailish", () => {
  it("accepts ordinary addresses", () => {
    for (const value of ["a@b.co", "first.last+tag@example.com", "MAHA@Example.CO.UK"]) {
      assert.equal(isEmailish(value), true, value);
    }
  });

  it("rejects malformed ones", () => {
    for (const value of ["", "nope", "no@domain", "@example.com", "a b@example.com", "a@b c.com"]) {
      assert.equal(isEmailish(value), false, value);
    }
  });

  it("rejects addresses longer than the column allows", () => {
    assert.equal(isEmailish(`${"a".repeat(250)}@example.com`), false);
  });
});

describe("buildReminderEmail", () => {
  it("counts the outstanding habits in the subject", () => {
    assert.equal(buildReminderEmail(["Read"], "https://x.test").subject, "1 habit still to do today");
    assert.equal(
      buildReminderEmail(["Read", "Stretch"], "https://x.test").subject,
      "2 habits still to do today",
    );
  });

  it("lists every outstanding habit in both bodies", () => {
    const mail = buildReminderEmail(["Read", "Stretch"], "https://x.test");
    for (const name of ["Read", "Stretch"]) {
      assert.ok(mail.text.includes(name), `text missing ${name}`);
      assert.ok(mail.html.includes(name), `html missing ${name}`);
    }
    assert.ok(mail.text.includes("https://x.test"));
  });

  // Habit names are typed by users and land inside an HTML document.
  it("escapes habit names so a name cannot inject markup", () => {
    const mail = buildReminderEmail(['<img src=x onerror="alert(1)">'], "https://x.test");
    assert.ok(!mail.html.includes("<img"), "raw tag survived into the html body");
    assert.ok(!mail.html.includes('onerror="'), "raw attribute survived into the html body");
    assert.ok(mail.html.includes("&lt;img"), "expected the name to be escaped");
  });

  it("escapes the app url too", () => {
    const mail = buildReminderEmail(["Read"], 'https://x.test/"><script>');
    assert.ok(!mail.html.includes("<script>"), "raw script tag survived");
  });
});
