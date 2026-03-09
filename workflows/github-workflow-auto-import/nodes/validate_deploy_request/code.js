const item = $input.first().json;
const missing = [];

if (!item.receivedSecret) missing.push('X-Deploy-Secret header');
if (!item.expectedSecret) missing.push('N8N_DEPLOY_WEBHOOK_SECRET env');
if (!item.rawUrl) missing.push('body.rawUrl');
if (!item.workflowName) missing.push('body.workflowName');
if (!item.n8nBaseUrl) missing.push('N8N_API_BASE_URL env');
if (!item.n8nApiKey) missing.push('N8N_API_KEY env');

if (missing.length > 0) {
  throw new Error(`Missing required values: ${missing.join(', ')}`);
}

if (item.receivedSecret !== item.expectedSecret) {
  throw new Error('Invalid deploy secret');
}

if (!/^https?:\/\//.test(item.rawUrl)) {
  throw new Error('body.rawUrl must start with http:// or https://');
}

return [
  {
    json: {
      ...item,
      validationStatus: 'ok',
    },
  },
];
