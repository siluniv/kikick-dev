const deploy = $node['Validate Deploy Request'].json;
const searchResult = $input.first().json;
const importedWorkflow = $node['Download Workflow Definition'].json;

const candidateList = Array.isArray(searchResult?.data)
  ? searchResult.data
  : Array.isArray(searchResult?.items)
    ? searchResult.items
    : Array.isArray(searchResult)
      ? searchResult
      : [];

const existingWorkflow = candidateList.find(
  (workflow) => workflow && workflow.name === deploy.workflowName,
);

const requestBody = {
  name: importedWorkflow.name || deploy.workflowName,
  nodes: importedWorkflow.nodes || [],
  connections: importedWorkflow.connections || {},
  settings: importedWorkflow.settings || {},
};

if (importedWorkflow.staticData) {
  requestBody.staticData = importedWorkflow.staticData;
}

if (Array.isArray(importedWorkflow.tags) && importedWorkflow.tags.length > 0) {
  requestBody.tags = importedWorkflow.tags;
}

if (importedWorkflow.projectId) {
  requestBody.projectId = importedWorkflow.projectId;
}

const requestMethod = existingWorkflow ? 'PATCH' : 'POST';
const requestUrl = existingWorkflow
  ? `${deploy.n8nBaseUrl}/api/v1/workflows/${existingWorkflow.id}`
  : `${deploy.n8nBaseUrl}/api/v1/workflows`;

return [
  {
    json: {
      ...deploy,
      operation: existingWorkflow ? 'update' : 'create',
      existingWorkflowId: existingWorkflow?.id || '',
      requestMethod,
      requestUrl,
      requestBody,
    },
  },
];
