const item = $input.first().json;
const planningNode = item.planningContext ? item : ($node['Context Selection Engine']?.json ?? item);

return [{
  json: {
    ...planningNode,
    storyDevelopmentInput: {
      normalized_input: planningNode.normalizedInput ?? {},
      episode_context: planningNode.episodeContext ?? {},
      planning_context: planningNode.planningContext ?? {},
    },
  },
}];
