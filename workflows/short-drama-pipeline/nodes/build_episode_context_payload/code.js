const item = $input.first().json;
const normalizedInput = item.normalizedInput ?? {};
const story = normalizedInput.story_text_structured ?? {};
const segments = Array.isArray(story.segments) ? story.segments : [];

const episodeContextAnalysisInput = {
  story_text_structured: {
    summary: story.summary ?? '',
    segments: segments.map((segment) => ({
      scene_id: segment.scene_id ?? '',
      scene_heading: segment.scene_heading ?? '',
      summary: segment.summary ?? '',
      intent: segment.intent ?? '',
      emotion_tone: Array.isArray(segment.emotion_tone) ? segment.emotion_tone : [],
      key_actions: Array.isArray(segment.key_actions) ? segment.key_actions : [],
      relationship_signals: Array.isArray(segment.relationship_signals) ? segment.relationship_signals : [],
      continuity_risks: Array.isArray(segment.continuity_risks) ? segment.continuity_risks : [],
      entities: {
        characters: Array.isArray(segment.entities?.characters) ? segment.entities.characters : [],
        locations: Array.isArray(segment.entities?.locations) ? segment.entities.locations : [],
        props: Array.isArray(segment.entities?.props) ? segment.entities.props : [],
      },
    })),
  },
  entity_candidates: normalizedInput.entity_candidates ?? {
    characters: [],
    locations: [],
    props: [],
    relationships: [],
  },
  bible_patch_candidates: Array.isArray(normalizedInput.bible_patch_candidates)
    ? normalizedInput.bible_patch_candidates
    : [],
  production_hints: normalizedInput.production_hints ?? {
    dominant_mood: '',
    visual_keywords: [],
    core_conflict: '',
    estimated_complexity: 'unknown',
  },
  input_metadata: normalizedInput.input_metadata ?? {
    source_type: item.sourceType ?? 'text_story_form',
    language: item.detectedLanguage ?? 'ko',
    scene_count: segments.length,
    detected_character_count: 0,
    detected_location_count: 0,
    bible_patch_candidate_count: 0,
    attachment_count: 0,
    estimated_complexity: 'unknown',
  },
};

return [{
  json: {
    ...item,
    contextScope: 'current_episode_only',
    scoringMode: 'heuristic_plus_llm',
    episodeContextAnalysisInput,
  },
}];
