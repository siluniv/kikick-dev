const item = $input.first().json;
const episodeNode = item.episodeContext ? item : ($node['Assemble Episode Context']?.json ?? item);
const normalizedInput =
  episodeNode.normalizedInput
  ?? $node['Assemble Normalized Input']?.json?.normalizedInput
  ?? {};
const episodeContext = episodeNode.episodeContext ?? {};

const story = normalizedInput.story_text_structured ?? {};
const segments = Array.isArray(story.segments) ? story.segments : [];
const characterCandidates = Array.isArray(normalizedInput.entity_candidates?.characters)
  ? normalizedInput.entity_candidates.characters
  : [];
const locationCandidates = Array.isArray(normalizedInput.entity_candidates?.locations)
  ? normalizedInput.entity_candidates.locations
  : [];
const relationshipProgressions = Array.isArray(episodeContext.relationship_progressions)
  ? episodeContext.relationship_progressions
  : [];
const continuityWatchouts = Array.isArray(episodeContext.continuity_watchouts)
  ? episodeContext.continuity_watchouts
  : [];
const contextReferences = item.contextReferences ?? {
  include_recent: 0,
  specific_episodes: [],
  auto_context: false,
};

const uniqueStrings = (values) => [...new Set(
  values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean),
)];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildStableId = (prefix, index) => `${prefix}_${String(index + 1).padStart(2, '0')}`;

const inferArcPhase = () => {
  if (segments.length <= 2) {
    return 'setup';
  }

  if (episodeContext.dramatic_question) {
    return 'rising_action';
  }

  return 'inciting_incident';
};

const inferCurrentEmotion = (characterName) => {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const characters = Array.isArray(segment.entities?.characters) ? segment.entities.characters : [];

    if (characters.includes(characterName)) {
      return Array.isArray(segment.emotion_tone) && segment.emotion_tone.length > 0
        ? segment.emotion_tone[0]
        : '';
    }
  }

  return '';
};

const inferRecentActions = (characterName) => uniqueStrings(
  segments.flatMap((segment) => {
    const characters = Array.isArray(segment.entities?.characters) ? segment.entities.characters : [];
    return characters.includes(characterName) && Array.isArray(segment.key_actions)
      ? segment.key_actions
      : [];
  }),
).slice(-3);

const buildCharacterContext = () => characterCandidates.map((character, index) => ({
  id: buildStableId('char', index),
  name: character.name ?? `character_${index + 1}`,
  full_profile: uniqueStrings([
    character.role ?? '',
    ...(Array.isArray(character.traits) ? character.traits : []),
  ]).join(', '),
  current_emotional_state: inferCurrentEmotion(character.name ?? ''),
  recent_actions: inferRecentActions(character.name ?? ''),
  traits: Array.isArray(character.traits) ? character.traits : [],
  reference_pack: {
    base: '',
    expressions: [],
  },
}));

const buildLocationContext = () => locationCandidates.map((location, index) => {
  const relatedSceneIds = segments
    .filter((segment) => Array.isArray(segment.entities?.locations) && segment.entities.locations.includes(location.name))
    .map((segment) => segment.scene_id)
    .filter((sceneId) => typeof sceneId === 'string' && sceneId);

  return {
    id: buildStableId('loc', index),
    name: location.name ?? `location_${index + 1}`,
    visual_spec: uniqueStrings([
      ...(Array.isArray(location.attributes) ? location.attributes : []),
      ...(Array.isArray(location.evidence) ? location.evidence : []),
    ]).join(', '),
    mood: normalizedInput.production_hints?.dominant_mood ?? '',
    reference_images: [],
    related_scene_ids: relatedSceneIds,
  };
});

const activePlotThreads = [];

if (episodeContext.dramatic_question) {
  activePlotThreads.push({
    thread_id: 'thread_main_question',
    description: episodeContext.dramatic_question,
    status: 'unresolved',
    urgency: 'high',
  });
}

relationshipProgressions.slice(0, 3).forEach((progression, index) => {
  activePlotThreads.push({
    thread_id: `thread_relationship_${index + 1}`,
    description: progression.current_implication ?? progression.change ?? '',
    status: progression.confidence === 'high' ? 'active' : 'unresolved',
    urgency: progression.confidence === 'high' ? 'medium' : 'high',
  });
});

if (continuityWatchouts.length > 0) {
  activePlotThreads.push({
    thread_id: 'thread_continuity_watchout',
    description: continuityWatchouts[0],
    status: 'warning',
    urgency: 'medium',
  });
}

const normalizedContinuityScore = clamp((episodeContext.continuity_score ?? 70) / 100, 0, 1);
const continuityPressure = Number((1 - normalizedContinuityScore).toFixed(2));
const tensionTarget = Number(clamp(
  0.45 + (activePlotThreads.length * 0.08) + (continuityWatchouts.length > 0 ? 0.05 : 0),
  0.45,
  0.95,
).toFixed(2));

const seriesContext = {
  series_id: item.seriesId ?? item.workflowName ?? 'short-drama-pipeline',
  world_setting: `${uniqueStrings(locationCandidates.map((location) => location.name)).join(', ') || '현재 에피소드 공간'} 중심의 단일 에피소드 PoC 컨텍스트`,
  themes: uniqueStrings([
    normalizedInput.production_hints?.dominant_mood ?? '',
    episodeContext.central_conflict ? '관계 붕괴' : '',
    episodeContext.dramatic_question ? '미스터리' : '',
  ]),
  tone: normalizedInput.production_hints?.dominant_mood ?? 'drama',
  total_episodes: item.totalEpisodes ?? 1,
  current_episode_number: item.currentEpisodeNumber ?? 1,
  context_mode: 'current_episode_only',
};

const planningContext = {
  series_context: seriesContext,
  character_context: buildCharacterContext(),
  location_context: buildLocationContext(),
  narrative_context: {
    arc_phase: inferArcPhase(),
    active_threads: activePlotThreads,
    tension_target: tensionTarget,
    episode_goal: episodeContext.central_conflict || episodeContext.dramatic_question || story.summary || '',
  },
  creative_constraints: {
    max_new_characters: continuityPressure >= 0.3 ? 0 : 1,
    max_new_locations: continuityPressure >= 0.5 ? 0 : 1,
    creative_freedom: Number(clamp(0.45 - continuityPressure * 0.3, 0.15, 0.45).toFixed(2)),
    continuity_priority: continuityPressure,
    context_references: contextReferences,
  },
};

return [{
  json: {
    ...episodeNode,
    planningContextStatus: 'ready',
    planningContextInputVersion: 'v1',
    planningContext,
  },
}];
