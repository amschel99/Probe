---
title: Endpoint forms
description: Post your own HTML form or JSON to /submit. Probe stores it, emails it, and sends a signed webhook.
---

An endpoint form has no page of its own. You keep the form on your site and set its `action` to Probe. Probe stores each submission, emails it to you, and can forward it to a webhook, Discord or Google Sheets.

## Create one

1. Go to **Endpoint forms** and click **New endpoint form**.
2. Enter a **Form name**, **Your website** and, optionally, a **Recipient email**.
3. Probe creates a public **access key**. Your website's origin is added to the allowed origins.

The access key is public. It goes in your HTML. It only lets someone submit to this one form.

## Send from HTML

```html
<form action="https://probe.jahazi.city/submit" method="POST">
  <input type="hidden" name="access_key" value="YOUR_ACCESS_KEY" />
  <input type="hidden" name="subject" value="New message from the website" />
  <input type="hidden" name="redirect" value="https://example.com/thanks" />

  <input type="text" name="from_name" placeholder="Your name" required />
  <input type="email" name="email" placeholder="Your email" required />
  <textarea name="message" placeholder="Message" required></textarea>

  <!-- Honeypot. Leave it empty and hidden. -->
  <input type="checkbox" name="botcheck" style="display: none" tabindex="-1" autocomplete="off" />

  <button type="submit">Send</button>
</form>
```

With `redirect`, Probe answers with a `303` to that URL. Without it, Probe returns JSON.

Ready-made contact, newsletter, waitlist and feedback pages are on [/templates/html](https://probe.jahazi.city/templates/html). Replace `YOUR_ACCESS_KEY` after downloading.

## Send with fetch

```js
const res = await fetch("https://probe.jahazi.city/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({
    access_key: "YOUR_ACCESS_KEY",
    from_name: "Ada",
    email: "ada@example.com",
    message: "Hello",
  }),
});
const data = await res.json();
// { success: true, message: "Submission received" }
```

`/submit` accepts `application/json`, `application/x-www-form-urlencoded` and `multipart/form-data`. File parts are ignored. Endpoint forms do not take uploads.

## Fields Probe reads

| Field | Required | What it does |
|---|---|---|
| `access_key` | yes | Which endpoint form this is for. |
| `email` | no | The submitter's email. Stored with the submission. |
| `from_name` | no | The submitter's name. Used as the sender name on the notification email. |
| `subject` | no | Overrides the email subject. |
| `redirect` | no | Absolute URL to send the browser to after submit. Its origin must be in the allowed origins. |
| `botcheck` | no | Honeypot. Leave it empty. |
| `h-captcha-response`, `g-recaptcha-response`, `cf-turnstile-response` | only with captcha | The captcha token. |

Every other key is stored as the submission. The limits are 50 keys and 64 KB per body.

The default subject is `New submission from {form_name}`. Change it under **Settings → Subject template**. You can use `{form_name}`, `{submitter_email}` and `{submitter_name}`.

## Rules

### Allowed origins

Browser submissions must come from an origin on the form's allowlist. Edit it under **Settings → Allowed origins**, one per line. Wildcards such as `*.example.com` work. A request from any other origin gets `403 ORIGIN_NOT_ALLOWED`.

### Server-side submissions

A request with no `Origin` or `Referer` header comes from a server, a script or an agent, such as `curl`. These are rejected unless you turn on **Allow server-to-server submissions** in the **Settings** tab.

### Honeypot

The `botcheck` field is on by default. If a bot fills it in, Probe returns a normal success and drops the submission. Turn it off in **Settings** if you need to.

### Captcha

In **Settings**, choose hCaptcha, reCAPTCHA or Cloudflare Turnstile. Enter your site key and secret key. The secret is stored encrypted. Add the provider's widget to your form. Its token field is sent with the form. A missing or failed token gets `422 SPAM_REJECTED`.

### Rate limit

Each IP can submit 5 times per hour to each form. More gets `429 RATE_LIMITED`.

### Recipient verification

A new endpoint form starts unverified. Probe emails the recipient a verification link. Until it is clicked:

- Submissions are stored and visible in the dashboard.
- No notification emails are sent.
- No webhooks are sent.

Changing the recipient email needs a fresh verification. The old address keeps receiving until the new one verifies. If the link has expired, resend it from the endpoint form's page. If the instance has no email provider, the link is printed in the server logs.

Discord and Google Sheets forwarding does not wait for verification.

## Responses

| Status | Body |
|---|---|
| `200` | `{"success": true, "message": "Submission received"}` |
| `303` | Redirect to `redirect`. |
| `400` | `INVALID_INPUT`, `TOO_MANY_FIELDS`, `INVALID_REDIRECT` |
| `401` | `INVALID_ACCESS_KEY` |
| `403` | `ORIGIN_NOT_ALLOWED` |
| `413` | `PAYLOAD_TOO_LARGE` |
| `422` | `SPAM_REJECTED` |
| `429` | `RATE_LIMITED` |

Errors look like `{"success": false, "code": "…", "message": "…"}`. Unverified forms return `200` with a message saying no email was sent.

## Webhooks

Set **Webhook URL** in the form settings. Probe creates a signing secret. For each verified submission, Probe sends:

```http
POST <your webhook URL>
Content-Type: application/json
User-Agent: Probe-Webhook/1.0
X-Probe-Signature: sha256=<hex HMAC-SHA256 of the raw body>

{"formId": "…", "formTitle": "…", "payload": { … }}
```

The signing secret is `endpointSettings.webhookSigningSecret`, returned by the `endpoint.get` API call. See [API and agents](/docs/guides/api-and-agents/).

Check the signature against the raw body, before parsing it:

```js
import crypto from "node:crypto";
import express from "express";

const app = express();
const SECRET = process.env.PROBE_WEBHOOK_SECRET;

app.post("/probe", express.raw({ type: "application/json" }), (req, res) => {
  const expected =
    "sha256=" + crypto.createHmac("sha256", SECRET).update(req.body).digest("hex");
  const received = req.get("X-Probe-Signature") ?? "";

  const ok =
    received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!ok) return res.status(401).end();

  const { formId, formTitle, payload } = JSON.parse(req.body.toString("utf8"));
  console.log(formTitle, payload);
  res.status(204).end();
});

app.listen(3000);
```

Delivery is sent once and not retried. A failing webhook never fails the submission.

## Discord and Google Sheets

An admin first enables each integration in **Admin → Integrations**. Google Sheets also needs `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` on the server. See [Environment variables](/docs/reference/environment/).

Then each form owner sets it up per form: paste a Discord webhook URL, or connect a Google account and pick a spreadsheet.

## Submissions

The **Submissions** tab shows a table with one column per field. Search filters the rows you have loaded. Click **Load more** for older ones. Click a row to expand the full submission. Export everything as **CSV** or **Excel**.

The **Snippet** tab shows the endpoint URL, the access key and ready-to-paste HTML, fetch and React snippets. The **Security** tab has **Rotate access key**, which issues a new key and stops the old one at once, and the **Audit log** of events such as verification and key rotation.
