---
title: AI form generation
description: Describe a form in plain words and get a draft in the builder. Providers, default models, and instance-wide keys.
---

Probe can draft a form from a sentence. You describe what you want to ask. A model picks the questions and field types. The draft opens in the builder, where you change anything you like.

Probe does not charge for AI and does not include a model. You connect a provider with your own API key, or the instance operator sets one for everyone.

## Connect a provider

1. Go to **Settings → AI form generation**.
2. Pick a provider.
3. Paste your API key. Optionally set a model. Leave it blank to use the default.
4. Save.

Probe checks the key with the provider before saving it. A rejected key is not stored. Saved keys are encrypted with AES-256-GCM and are only decrypted on the server when you generate a form. They are never sent back to the browser.

## Generate a form

Go to **Forms → New form**. The page asks **What do you want to ask?** and shows the provider and model in use.

Type a description, or start from an example: event signup, customer feedback, job application or investor intake. Be specific about the questions and any choices. Click **Generate form**, or press Ctrl+Enter (Cmd+Enter on a Mac).

The draft uses the theme you selected below, or the first theme if you did not pick one. It opens in the builder as an unpublished draft. Nothing is public until you click **Publish**.

The model writes the form in the language of your description.

## Providers

| Provider | Default model | Get a key |
|---|---|---|
| Anthropic (Claude) | `claude-opus-5-5` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| OpenAI | `gpt-4.1-mini` | [platform.openai.com](https://platform.openai.com/api-keys) |
| DeepSeek | `deepseek-flash` | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| Google Gemini | `gemini-2.5-flash` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| OpenRouter | `openrouter/auto` | [openrouter.ai](https://openrouter.ai/keys) |
| Groq | `llama-3.3-70b-versatile` | [console.groq.com](https://console.groq.com/keys) |
| Mistral | `mistral-small-latest` | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| Custom (OpenAI-compatible) | none, set one | Your own endpoint |

Anthropic uses its own API. Every other provider uses the OpenAI-compatible chat completions API.

### DeepSeek

DeepSeek is cheap and drafts forms well. Use `deepseek-flash`, the default. The older `deepseek-chat` and `deepseek-reasoner` models were retired on 2026-07-24. If you saved one of them as your model, clear the model field or change it. For heavier use, `deepseek-v4-pro` is also available.

### Custom endpoints

**Custom** sends requests to any OpenAI-compatible base URL, such as a local Ollama at `http://localhost:11434/v1` or LM Studio. The key is optional. You must set a model, because there is no default.

Only admins can save a custom endpoint. A custom base URL makes the Probe server call an address you choose, so it is not open to every user.

Remember that the URL is called from the Probe server, not from your browser. `localhost` means the machine Probe runs on.

## Instance-wide default

The operator can switch AI on for every user without per-user keys. Set these on the server:

| Variable | Value |
|---|---|
| `AI_PROVIDER` | `anthropic`, `openai`, `deepseek`, `gemini`, `openrouter`, `groq`, `mistral` or `custom` |
| `AI_API_KEY` | The provider's key. Optional only for `custom`. |
| `AI_MODEL` | Optional. Each provider's default is used when blank. Required for `custom`. |
| `AI_BASE_URL` | Only for `custom`. |

For example:

```bash
AI_PROVIDER=deepseek
AI_API_KEY=sk-...
AI_MODEL=deepseek-flash
```

Restart Probe after changing them. A user's own key always wins over the instance default. Costs for the instance default go to the operator's account.

## Privacy

Your description is sent to the provider you picked, and nothing else. Probe does not send existing forms or responses. What the provider does with the prompt is set by its own terms. If that matters, use a provider you trust or a local model through **Custom**.

## When generation fails

- **The key was rejected.** Check the key, or that it has credit.
- **The model wasn't found.** Fix the model name, or clear it to use the default.
- **Rate-limited.** Wait and try again.
- **Malformed or empty draft.** Try again, or describe the form more plainly. Smaller local models are more likely to return a broken draft.

Requests time out after 90 seconds.
