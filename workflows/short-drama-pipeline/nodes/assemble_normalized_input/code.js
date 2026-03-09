const item = $input.first().json;
const parsed = item.output && typeof item.output === 'object' ? item.output : item;

const sceneSegments = Array.isArray(parsed.scene_segments) ? parsed.scene_segments : [];
const entityCandidates = parsed.entity_candidates ?? {
  characters: [],
  locations: [],
  props: [],
  relationships: [],
};
const biblePatchCandidates = Array.isArray(parsed.bible_patch_candidates) ? parsed.bible_patch_candidates : [];
const productionHints = parsed.production_hints ?? {
  dominant_mood: '',
  visual_keywords: [],
  core_conflict: '',
  estimated_complexity: 'unknown',
};

const uniqueStrings = (values) => [...new Set(
  values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean),
)];

const detectedCharacters = uniqueStrings([
  ...sceneSegments.flatMap((scene) => Array.isArray(scene.characters) ? scene.characters : []),
  ...((entityCandidates.characters ?? []).map((character) => character.name)),
]);

const detectedLocations = uniqueStrings([
  ...sceneSegments.flatMap((scene) => Array.isArray(scene.locations) ? scene.locations : []),
  ...((entityCandidates.locations ?? []).map((location) => location.name)),
]);

return [{
  json: {
    ...item,
    normalizationStatus: 'candidate_ready',
    normalizedInput: {
      story_text_structured: {
        summary: parsed.story_summary ?? '',
        segments: sceneSegments.map((scene, index) => ({
          scene_index: index + 1,
          scene_id: scene.scene_id ?? `scene_${String(index + 1).padStart(2, '0')}`,
          scene_heading: scene.scene_heading ?? '',
          summary: scene.summary ?? '',
          intent: scene.intent ?? '',
          emotion_tone: Array.isArray(scene.emotion_tone) ? scene.emotion_tone : [],
          key_actions: Array.isArray(scene.key_actions) ? scene.key_actions : [],
          entities: {
            characters: Array.isArray(scene.characters) ? scene.characters : [],
            locations: Array.isArray(scene.locations) ? scene.locations : [],
            props: Array.isArray(scene.props) ? scene.props : [],
          },
          relationship_signals: Array.isArray(scene.relationship_signals) ? scene.relationship_signals : [],
          continuity_risks: Array.isArray(scene.continuity_risks) ? scene.continuity_risks : [],
        })),
      },
      resolved_references: {
        characters: [],
        locations: [],
        props: [],
      },
      attachment_analysis: [],
      entity_candidates: entityCandidates,
      bible_patch_candidates: biblePatchCandidates,
      production_hints: productionHints,
      input_metadata: {
        source_type: item.sourceType ?? 'text_story_form',
        language: item.detectedLanguage ?? 'ko',
        scene_count: sceneSegments.length,
        detected_character_count: detectedCharacters.length,
        detected_location_count: detectedLocations.length,
        bible_patch_candidate_count: biblePatchCandidates.length,
        attachment_count: 0,
        estimated_complexity: productionHints.estimated_complexity ?? 'unknown',
      },
    },
  },
}];
