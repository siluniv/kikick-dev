# github-workflow-auto-import credential setup

## 1. Receive Deploy Webhook

- Node: `Receive Deploy Webhook`
- Authentication: `Basic Auth`
- Credential type: `Webhook` credential with `Basic auth`
- Purpose: allow GitHub Actions to call the deploy webhook with a username and password

## 2. Find Existing Workflow

- Node: `Find Existing Workflow`
- Authentication: `Generic Credential Type`
- Generic auth type: `Header Auth`
- Credential type: `HTTP Request` credential with `Header Auth`
- Header name: `X-N8N-API-KEY`
- Header value: your n8n API key

## 3. Upsert Workflow

- Node: `Upsert Workflow`
- Authentication: `Generic Credential Type`
- Generic auth type: `Header Auth`
- Credential type: reuse the same `HTTP Request` header auth credential used above

## 4. GitHub Actions secrets

- `N8N_DEPLOY_WEBHOOK_URL`: Production webhook URL from `Receive Deploy Webhook`
- `N8N_DEPLOY_WEBHOOK_USERNAME`: username from the webhook basic auth credential
- `N8N_DEPLOY_WEBHOOK_PASSWORD`: password from the webhook basic auth credential
- Make sure `N8N_DEPLOY_WEBHOOK_URL` is the production webhook URL, starts with `http://` or `https://`, and does not include extra line breaks.

## Notes

- This workflow derives the n8n base URL from the incoming webhook headers, so no extra deploy environment variable is required.
- The actual workflow create or update logic still works by workflow name.
- GitHub Actions skips `workflows/github-workflow-auto-import/workflow.json`, so this deploy workflow should be updated manually in n8n.
