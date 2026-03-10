const item = $input.first().json;
const storyNode = item.storyDevelopment ? item : ($node['Assemble Story Development']?.json ?? item);

return [{
  json: {
    ...storyNode,
    screenplayInput: {
      normalized_input: storyNode.normalizedInput ?? {},
      episode_context: storyNode.episodeContext ?? {},
      planning_context: storyNode.planningContext ?? {},
      story_development: storyNode.storyDevelopment ?? {},
    },
  },
}];
