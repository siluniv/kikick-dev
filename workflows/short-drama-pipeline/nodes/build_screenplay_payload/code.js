const item = $input.first().json;
const storyNode = item.storyDevelopment ? item : ($node['Assemble Story Development']?.json ?? item);
const planningNode = $node['Context Selection Engine']?.json ?? {};
const episodeNode = $node['Assemble Episode Context']?.json ?? {};
const normalizedNode = $node['Assemble Normalized Input']?.json ?? {};

const normalizedInput =
  storyNode.normalizedInput
  ?? planningNode.normalizedInput
  ?? episodeNode.normalizedInput
  ?? normalizedNode.normalizedInput
  ?? {};
const episodeContext =
  storyNode.episodeContext
  ?? planningNode.episodeContext
  ?? episodeNode.episodeContext
  ?? {};
const planningContext =
  storyNode.planningContext
  ?? planningNode.planningContext
  ?? {};
const storyDevelopment =
  storyNode.storyDevelopment
  ?? item.storyDevelopment
  ?? {};

return [{
  json: {
    ...storyNode,
    normalizedInput,
    episodeContext,
    planningContext,
    storyDevelopment,
    screenplayInput: {
      normalized_input: normalizedInput,
      episode_context: episodeContext,
      planning_context: planningContext,
      story_development: storyDevelopment,
    },
  },
}];
