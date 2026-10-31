---
title: API and agents
description: Personal API keys, tRPC over HTTP, curl recipes, and the /llms.txt contract for agents.
---

Everything the dashboard does goes through the same API. Scripts and agents can use it with a personal API key. They act as you, and the forms they create show up in your dashboard.

The full contract for agents is at [/llms.txt](https://probe.jahazi.city/llms.txt). Point an agent at it. This page covers the same ground for people.

## Create an API key

1. Go to **Settings → API keys**.
2. Give the key a name, such as "My agent", and click **Create key**.
3. Copy the key. It is shown once.

Keys start with `probe_`. Probe stores only a hash of each key. The list shows each key's prefix, when it was created and when it was last used.

Send the key on every request, with either header:

```http
Authorization: Bearer probe_xxxxxxxxxxxxxxxx
X-API-Key: probe_xxxxxxxxxxxxxxxx
```

Keys do not expire. They stop working when you click **Revoke**. Treat them like passwords.

An API key cannot create or revoke API keys. Those calls need a signed-in dashboard session. `apiKeys.list` works with a key.

## How the API works

The API is tRPC over HTTP at `/trpc/<router>.<procedure>`. It uses the superjson transformer, so inputs and outputs are wrapped in `{"json": …}`.

| | Request |
|---|---|
| Query (read) | `GET /trpc/<proc>?input=<url-encoded {"json":{…}}>` |
| Mutation (write) | `POST /trpc/<proc>` with body `{"json":{…}}` |

A success looks like `{"result":{"data":{"json": …}}}`. An error looks like `{"error":{"json":{"message":"…","data":{"code":"NOT_FOUND"}}}}`. Codes include `UNAUTHORIZED`, `BAD_REQUEST`, `NOT_FOUND` and `TOO_MANY_REQUESTS`. Resources you do not own return `NOT_FOUND`, not `FORBIDDEN`.

The interactive reference is at [/api/docs](https://probe.jahazi.city/api/docs). The OpenAPI spec is at [/openapi.json](https://probe.jahazi.city/openapi.json).

## Recipe: build and publish a form

Set your key and base URL first:

```bash
export PROBE=https://probe.jahazi.city
export PROBE_API_KEY=probe_xxxxxxxxxxxxxxxx
```

### 1. Pick a theme

```bash
curl -s "$PROBE/trpc/themes.list"
```

Take an `id` from the result.

### 2. Create the form

```bash
curl -s -X POST "$PROBE/trpc/forms.create" \
  -H "Authorization: Bearer $PROBE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"json":{"title":"Feedback","themeId":"<theme-uuid>","visibility":"unlisted"}}'
```

The result has the form's `id` and `slug`. You can also pass `description` and a custom `slug`.

### 3. Add fields

Call `fields.create` once per field, with an increasing `order`:

```bash
curl -s -X POST "$PROBE/trpc/fields.create" \
  -H "Authorization: Bearer $PROBE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"json":{"formId":"<form-uuid>","type":"short_text","label":"Your name","required":true,"order":0,"config":{}}}'

curl -s -X POST "$PROBE/trpc/fields.create" \
  -H "Authorization: Bearer $PROBE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"json":{"formId":"<form-uuid>","type":"single_select","label":"Plan","order":1,"config":{"options":[{"label":"Free","value":"free"},{"label":"Pro","value":"pro"}]}}}'
```

Field types: `short_text`, `long_text`, `email`, `number`, `phone`, `url`, `single_select`, `multi_select`, `checkbox`, `rating`, `linear_scale`, `ranking`, `date`, `time`, `address`, `signature`, `file_upload` (only when storage is configured) and `page_break`.

Common `config` keys: `options`, `maxRating`, `ratingStyle` (`star`, `number` or `emoji`), `min`, `max`, `step`, `minLength`, `maxLength`, `scaleMin`, `scaleMax`, `scaleMinLabel`, `scaleMaxLabel`, `hidden`, `prefillKey`. Unknown keys are rejected.

To show a field only when earlier answers match, add `conditionalLogic`:

```json
{"conditionalLogic":{"showIf":[{"fieldId":"<field-uuid>","operator":"equals","value":"pro"}]}}
```

Operators are `equals`, `not_equals`, `contains`, `is_filled` and `is_empty`. All rules must pass.

### 4. Publish

```bash
curl -s -X POST "$PROBE/trpc/forms.publish" \
  -H "Authorization: Bearer $PROBE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"<form-uuid>"}}'
```

The form is live at `$PROBE/f/<slug>`.

### 5. Read responses

```bash
curl -s -G "$PROBE/trpc/responses.list" \
  -H "Authorization: Bearer $PROBE_API_KEY" \
  --data-urlencode 'input={"json":{"formId":"<form-uuid>","limit":25}}'
```

Hosted-form answers are in `items[].values[]`, each with a `fieldId` and `value`. Endpoint-form submissions are in `items[].payload`. Add `from` and `to` as ISO datetimes to filter by date.

Or download a file:

```bash
curl -s -H "Authorization: Bearer $PROBE_API_KEY" \
  -o responses.csv "$PROBE/forms/<form-uuid>/export.csv"
```

`.xlsx` and `.pdf` work the same way.

## Let AI draft the form

If `ai.status` returns `hasKey: true`, one call creates a full draft:

```bash
curl -s -X POST "$PROBE/trpc/ai.generateForm" \
  -H "Authorization: Bearer $PROBE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"json":{"prompt":"A feedback form with a 1-5 rating, what they liked, and an optional email","themeId":"<theme-uuid>"}}'
```

It returns `{id, slug, fieldCount}`. Review the fields, then publish. See [AI form generation](/docs/guides/ai-generation/).

## Other things you can do

- **Form settings.** `forms.update` takes `settings`, `maxResponses` and `expiresAt` (the close date). `forms.setPassword` sets or clears a password.
- **Endpoint forms.** `endpoint.create` returns an `accessKey`. `endpoint.update` sets allowed origins and `endpointSettings`, such as `allowServerSide` and `webhookUrl`. `endpoint.get` returns the webhook signing secret. See [Endpoint forms](/docs/guides/endpoint-forms/).
- **Submitting.** `/submit` needs no API key, only the form's access key. Hosted forms take public submissions through `public.submitResponse`.
- **Analytics.** `forms.getAnalytics` returns views, starts, completion rate and a daily series.

## What /llms.txt covers

[/llms.txt](https://probe.jahazi.city/llms.txt) is written for agents. It explains:

- Which surface to use: an endpoint form to collect submissions, hosted forms for a themed page, or `responses.list` to read results.
- The `/submit` contract: body fields, error codes, the origin allowlist, server-side submissions, verification and webhook signatures.
- API key authentication and the session-cookie fallback.
- The tRPC wire format with query and mutation examples.
- Recipes for creating and publishing a form, drafting one with AI, submitting to a hosted form, creating an endpoint form, and reading results.
- An index of every router and procedure.

If you run your own instance, `/llms.txt` is served from it too. Its examples use `https://probe.jahazi.city`. Tell the agent to use your origin instead.
