const item = $input.first().json;
const payloadNode = $node['Build Story Development Payload']?.json ?? {};
const planningNode = $node['Context Selection Engine']?.json ?? {};
const parsed = item.output && typeof item.output === 'object' ? item.output : item;
const normalizedInput =
  item.normalizedInput
  ?? payloadNode.normalizedInput
  ?? planningNode.normalizedInput
  ?? {};
const episodeContext =
  item.episodeContext
  ?? payloadNode.episodeContext
  ?? planningNode.episodeContext
  ?? {};
const planningContext =
  item.planningContext
  ?? payloadNode.planningContext
  ?? planningNode.planningContext
  ?? {};

const segments = Array.isArray(normalizedInput.story_text_structured?.segments)
  ? normalizedInput.story_text_structured.segments
  : [];
const sceneFunctions = Array.isArray(episodeContext.scene_functions)
  ? episodeContext.scene_functions
  : [];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const uniqueStrings = (values) => [...new Set(
  values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean),
)];

const STRATEGY_ALIASES = {
  emotional_drama: 'emotional_drama',
  emotional_collapse_to_mystery: 'emotional_drama',
  relationship_drama: 'relationship_drama',
  romance_drama: 'relationship_drama',
  suspense: 'suspense_mystery',
  suspense_mystery: 'suspense_mystery',
  mystery_hook: 'suspense_mystery',
  romantic_mystery: 'romantic_mystery',
  betrayal_reveal: 'betrayal_reveal',
  betrayal_reveal_with_mystery_hook: 'betrayal_reveal',
};

const BEAT_TYPE_ALIASES = {
  setup: 'setup',
  approach: 'approach',
  catalyst: 'catalyst',
  inciting_incident: 'catalyst',
  confrontation: 'confrontation',
  confrontation_observation: 'confrontation',
  midpoint: 'midpoint',
  emotional_fallout: 'fallout',
  fallout: 'fallout',
  mystery_setup: 'mystery_setup',
  climax: 'climax',
  cliffhanger_reveal: 'climax',
  resolution: 'resolution',
};

const normalizeStrategy = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  return STRATEGY_ALIASES[value.trim()] ?? fallback;
};

const normalizeBeatType = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  return BEAT_TYPE_ALIASES[value.trim()] ?? fallback;
};

const fallbackDensityLevel = (() => {
  const sceneCount = normalizedInput.input_metadata?.scene_count ?? segments.length;
  if (sceneCount >= 8) {
    return 'high';
  }
  if (sceneCount >= 5) {
    return 'medium';
  }
  return 'low';
})();

const densityAnalysis = {
  level: parsed.density_analysis?.level ?? fallbackDensityLevel,
  rationale: parsed.density_analysis?.rationale
    ?? `${segments.length}개 안팎의 장면과 ${episodeContext.central_conflict ? '명확한 중심 갈등' : '단일 에피소드 중심 사건'}을 바탕으로 한 ${fallbackDensityLevel} 밀도 에피소드`,
};

const creativeStrategy = {
  primary: normalizeStrategy(parsed.creative_strategy?.primary, 'emotional_drama'),
  secondary: normalizeStrategy(parsed.creative_strategy?.secondary, 'suspense_mystery'),
  style_notes: parsed.creative_strategy?.style_notes
    ?? `${episodeContext.central_conflict || episodeContext.dramatic_question || '관계 변화'}를 중심으로 감정선과 긴장을 병행`,
};

const fallbackBeatSheet = sceneFunctions.map((sceneFunction, index) => {
  const segment = segments[index] ?? {};
  const beatTypes = ['setup', 'catalyst', 'confrontation', 'midpoint', 'climax', 'resolution'];
  const beatType = beatTypes[Math.min(index, beatTypes.length - 1)];
  const durationRatio = Number((1 / Math.max(sceneFunctions.length || 1, 1)).toFixed(2));
  const tension = Number(clamp(0.3 + index * 0.12, 0.2, 0.95).toFixed(2));

  return {
    beat_id: index + 1,
    type: beatType,
    description: sceneFunction.why_it_matters || segment.summary || '',
    source_scene_ids: uniqueStrings([segment.scene_id ?? sceneFunction.scene_id ?? '']),
    emotion: Array.isArray(segment.emotion_tone) && segment.emotion_tone.length > 0
      ? segment.emotion_tone[0]
      : 'neutral',
    tension,
    duration_ratio: durationRatio,
  };
});

const normalizedBeatSheet = Array.isArray(parsed.beat_sheet) && parsed.beat_sheet.length > 0
  ? parsed.beat_sheet.map((beat, index, array) => ({
      beat_id: index + 1,
      type: normalizeBeatType(
        beat?.type,
        fallbackBeatSheet[index]?.type ?? 'confrontation',
      ),
      description: typeof beat?.description === 'string' ? beat.description : '',
      source_scene_ids: uniqueStrings(
        Array.isArray(beat?.source_scene_ids) && beat.source_scene_ids.length > 0
          ? beat.source_scene_ids
          : (fallbackBeatSheet[index]?.source_scene_ids ?? []),
      ),
      emotion: typeof beat?.emotion === 'string' ? beat.emotion : 'neutral',
      tension: Number(clamp(Number(beat?.tension ?? 0.5), 0, 1).toFixed(2)),
      duration_ratio: Number(clamp(Number(beat?.duration_ratio ?? (1 / Math.max(array.length, 1))), 0.05, 0.5).toFixed(2)),
    }))
  : fallbackBeatSheet;

const emotionalArc = {
  opening_emotion: parsed.emotional_arc?.opening_emotion
    ?? normalizedBeatSheet[0]?.emotion
    ?? 'neutral',
  peak_emotion: parsed.emotional_arc?.peak_emotion
    ?? normalizedBeatSheet.reduce((best, beat) => (beat.tension > best.tension ? beat : best), normalizedBeatSheet[0] ?? { emotion: 'neutral', tension: 0 }).emotion,
  closing_emotion: parsed.emotional_arc?.closing_emotion
    ?? normalizedBeatSheet[normalizedBeatSheet.length - 1]?.emotion
    ?? 'neutral',
  arc_shape: parsed.emotional_arc?.arc_shape ?? 'rising_with_twist',
  intensity_curve: Array.isArray(parsed.emotional_arc?.intensity_curve) && parsed.emotional_arc.intensity_curve.length > 0
    ? parsed.emotional_arc.intensity_curve.map((value) => Number(clamp(Number(value), 0, 1).toFixed(2)))
    : normalizedBeatSheet.map((beat) => beat.tension),
};

return [{
  json: {
    ...item,
    normalizedInput,
    episodeContext,
    planningContext,
    storyDevelopmentStatus: normalizedBeatSheet.length > 0 ? 'ready' : 'partial',
    storyDevelopmentInputVersion: 'v1',
    storyDevelopment: {
      density_analysis: densityAnalysis,
      creative_strategy: creativeStrategy,
      beat_sheet: normalizedBeatSheet,
      emotional_arc: emotionalArc,
    },
  },
}];
