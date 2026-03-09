const item = $input.first().json;
const missing = [];

if (!item.rawUrl) missing.push('body.rawUrl');
if (!item.workflowName) missing.push('body.workflowName');
if (!item.n8nBaseUrl) missing.push('derived n8n base URL from webhook headers');

if (missing.length > 0) {
  throw new Error(`Missing required values: ${missing.join(', ')}`);
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
