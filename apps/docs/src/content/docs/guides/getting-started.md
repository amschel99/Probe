---
title: Getting started
description: Create the admin account, build and publish a form, share it, and read the responses.
---

This guide takes you from a fresh Probe instance to a published form with responses. It uses the live instance at [probe.jahazi.city](https://probe.jahazi.city). Your own instance works the same way.

## Create the first account

Open `/register` and sign up with an email and a password of at least 8 characters.

The first account registered on an instance becomes its admin. Admins can see every form and user, and switch integrations on for everyone. Every account after that is a normal user.

Register yourself first, right after you deploy. Do not run `pnpm db:seed` on a public instance. It creates demo accounts with passwords that are published in this repo.

### If you forget your password

Click **Forgot password?** on `/login`. Probe emails a reset link that is valid for one hour. If email is not configured on the instance, the link is printed in the server logs instead. Resetting the password signs that account out of every session.

If you run the instance and email is not working, you can set a password directly. See [Reset a password from the command line](/docs/guides/deployment/#reset-a-password-from-the-command-line).

## Create a form

Go to **Forms** and click **New form**. There are two ways to start.

### Describe it

If an AI provider is connected, the page asks **What do you want to ask?** Type a sentence or two about the form, or click one of the examples (event signup, customer feedback, job application, investor intake). Click **Generate form**. The draft opens in the builder, where you can change everything.

No provider yet? Connect one in **Settings → AI form generation**. See [AI form generation](/docs/guides/ai-generation/).

### Start from scratch

Under **or start from scratch**, give the form a title, an optional description, a visibility, and a theme. Click **Create form**.

- **Unlisted** forms are reachable only by link.
- **Public** forms also appear on `/explore`.

## Build the form

The builder has three parts: the field list on the left, the form in the middle, and settings for the selected field on the right.

### Field types

Probe has 18 field types:

| Group | Types |
|---|---|
| Text | Short text, long text, email, number, phone, URL |
| Choice | Single select, multi select, checkbox, ranking |
| Scales | Rating (stars, numbers or emoji), linear scale with end labels |
| Date and place | Date, time, address |
| Other | Signature, file upload, page break |

File upload is available only when the instance has R2 storage configured. Otherwise the builder shows it as disabled.

### Field settings

Select a field to edit its label, placeholder, help text and whether it is required. Choice fields have an option list. Rating and scale fields have their range and labels.

Under **Advanced**, a field can be hidden and prefilled from the URL. Set a **URL query key**, then link to `/f/<slug>?<key>=value`. Hidden fields are useful for tracking where a respondent came from.

Labels and help text can include an earlier answer. Write `{{<fieldId>}}` and Probe replaces it with that answer.

### Pages

Add a **Page break** field to split the form into pages with Back and Next buttons. The page break's label becomes the page title and its help text the page intro.

Or set **Layout** to **One question per page** in form settings. **Show progress bar** adds a progress bar to multi-page forms.

Answers are saved in the respondent's browser as they type, so they can leave and come back. They are cleared on submit.

### Form settings

Click the form settings to change:

- Visibility and theme. Probe ships with 11 themes, including Paper.
- **Email me on submissions** and **Send confirmation email** to the respondent.
- **Success message** and **Redirect after submit**.
- **Max responses**. The form closes when it is full.
- **Quiz scoring**. Give select options a score and define outcomes by score range. The matching outcome is shown on the success screen.

Some settings are available through the [API](/docs/guides/api-and-agents/) but not yet in the builder:

- **Conditional logic.** Show a field only if earlier answers match rules (`equals`, `not_equals`, `contains`, `is_filled`, `is_empty`). All rules must pass. Hidden fields are never required.
- **Password.** `forms.setPassword` puts the form behind a password.
- **Close date.** `forms.update` with `expiresAt`. After that time the form shows as closed.

## Publish

Click **Publish**. The form is live at `/f/<slug>`. Click **Unpublish** to take it down. Drafts are never visible to the public.

## Share

Open the **Share** tab. It has:

- **The link.** Copy it.
- **Share on WhatsApp.** Shows the preview card WhatsApp will display, and a message with the title, description and link. Edit the message, then click **Share on WhatsApp**. It opens WhatsApp so you can pick a chat or group. Keep the link on its own line so WhatsApp shows the preview.
- **QR code.** Download it as a PNG for posters and slides.
- **Embed.** An `<iframe>` snippet for any web page. Hosted forms can be framed from any site.

Every form has a link-preview card. When the link is pasted into WhatsApp, Slack, X or iMessage, it shows the form's title, description and a generated image.

## Read responses

The **Responses** tab lists every submission with the time, email and answers. It shows the total, completion rate, average time and views. Filter by date range and search the answers. Click a response to see it in full.

Export responses as **CSV**, **Excel** or **PDF**. The date range applies to the export.

## Analytics

The **Analytics** tab shows views, starts, completions and completion rate, a chart of submissions over the last 30 days, the average completion time, and the top drop-off field: the question where most people give up.

## Next steps

- Already have a site with a form? Use an [endpoint form](/docs/guides/endpoint-forms/).
- Want an agent to build forms for you? See [API and agents](/docs/guides/api-and-agents/).
- Running your own instance? See [Deployment](/docs/guides/deployment/).
