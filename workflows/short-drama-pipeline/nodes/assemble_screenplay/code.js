const item = $input.first().json;
const payloadNode = $node['Build Screenplay Payload']?.json ?? {};
const storyNode = $node['Assemble Story Development']?.json ?? {};
const parsed = item.output && typeof item.output === 'object' ? item.output : item;
const normalizedInput =
  item.normalizedInput
  ?? payloadNode.normalized_input
  ?? payloadNode.screenplayInput?.normalized_input
  ?? storyNode.normalizedInput
  ?? {};
const episodeContext =
  item.episodeContext
  ?? payloadNode.episode_context
  ?? payloadNode.screenplayInput?.episode_context
  ?? storyNode.episodeContext
  ?? {};
const planningContext =
  item.planningContext
  ?? payloadNode.planning_context
  ?? payloadNode.screenplayInput?.planning_context
  ?? storyNode.planningContext
  ?? {};
const storyDevelopment =
  item.storyDevelopment
  ?? payloadNode.story_development
  ?? payloadNode.screenplayInput?.story_development
  ?? storyNode.storyDevelopment
  ?? {};

const segments = Array.isArray(normalizedInput.story_text_structured?.segments)
  ? normalizedInput.story_text_structured.segments
  : [];
const beatSheet = Array.isArray(storyDevelopment.beat_sheet)
  ? storyDevelopment.beat_sheet
  : [];
const characters = Array.isArray(planningContext.character_context)
  ? planningContext.character_context
  : [];
const locations = Array.isArray(planningContext.location_context)
  ? planningContext.location_context
  : [];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const uniqueStrings = (values) => [...new Set(
  values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean),
)];
const CHARACTER_PREFIXES = [
  '반려견',
  '대형견',
  '남자친구',
  '스타작가',
  '탑배우',
  '여배우',
  '배우',
  '의문의',
  '낯선',
];
const slugify = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');
const toSceneId = (index) => `sc_${String(index + 1).padStart(3, '0')}`;
const normalizeComparableText = (value) => {
  let text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (!text) {
    return '';
  }

  CHARACTER_PREFIXES.forEach((prefix) => {
    if (text.startsWith(prefix) && text.length > prefix.length) {
      text = text.slice(prefix.length);
    }
  });

  return text;
};
const matchesComparableText = (left, right) => {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft);
};

const segmentById = new Map(
  segments
    .filter((segment) => typeof segment?.scene_id === 'string' && segment.scene_id)
    .map((segment) => [segment.scene_id, segment]),
);
const characterIds = new Set(characters.map((character) => character.id).filter(Boolean));
const locationIds = new Set(locations.map((location) => location.id).filter(Boolean));
const relatedSceneIdsByLocationId = new Map(
  locations.map((location) => [
    location.id,
    Array.isArray(location.related_scene_ids) ? location.related_scene_ids : [],
  ]),
);
const parsedTotalDurationTargetSec = Number(parsed.total_duration_target_sec);
const fallbackTotalDurationTargetSec = isFiniteNumber(parsedTotalDurationTargetSec) && parsedTotalDurationTargetSec > 0
  ? Math.round(parsedTotalDurationTargetSec)
  : Math.round(clamp(Math.max(beatSheet.length, 1) * 40, 90, 420));

const normalizeTimeOfDay = (...values) => {
  const text = values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .find(Boolean) ?? '';

  if (!text) {
    return 'unspecified';
  }

  if (text.includes('late_night') || text.includes('늦은 밤') || text.includes('심야')) {
    return 'late_night';
  }
  if (text.includes('morning') || text.includes('아침') || text.includes('새벽')) {
    return 'morning';
  }
  if (text.includes('evening') || text.includes('저녁') || text.includes('노을')) {
    return 'evening';
  }
  if (text.includes('night') || text.includes('밤')) {
    return 'night';
  }
  if (text.includes('day') || text.includes('낮') || text.includes('오후') || text.includes('정오')) {
    return 'day';
  }

  return 'unspecified';
};

const buildHeading = (segment, location) => {
  const locationName = segment?.scene_heading || location?.name || '미상 공간';
  const timeOfDay = normalizeTimeOfDay(segment?.scene_heading);
  const timeLabelMap = {
    morning: '아침',
    day: '낮',
    evening: '저녁',
    night: '밤',
    late_night: '늦은 밤',
    unspecified: '불명',
  };

  return `INT. ${locationName} - ${timeLabelMap[timeOfDay] ?? '불명'}`;
};

const findBeatById = (beatId) => beatSheet.find((beat) => Number(beat?.beat_id) === Number(beatId));

const resolveCharacterId = (value, fallbackId = '') => {
  if (typeof value === 'string' && characterIds.has(value.trim())) {
    return value.trim();
  }

  const match = characters.find((character) => matchesComparableText(value, character.name));
  return match?.id ?? fallbackId;
};

const resolveCharacterIds = (values, fallbackIds = []) => {
  const resolved = uniqueStrings(
    (Array.isArray(values) ? values : [])
      .map((value, index) => resolveCharacterId(value, fallbackIds[index] ?? fallbackIds[0] ?? ''))
      .filter(Boolean),
  );

  return resolved.length > 0 ? resolved : fallbackIds.filter(Boolean);
};

const resolveLocationId = (candidateValues, sourceSceneIds, segment, fallbackId = '') => {
  const directId = (Array.isArray(candidateValues) ? candidateValues : [])
    .find((value) => typeof value === 'string' && locationIds.has(value.trim()));

  if (directId) {
    return directId.trim();
  }

  const textualMatch = locations.find((location) => (
    (Array.isArray(candidateValues) ? candidateValues : []).some((value) => matchesComparableText(value, location.name))
    || (Array.isArray(segment?.entities?.locations) ? segment.entities.locations : []).some((value) => matchesComparableText(value, location.name))
    || matchesComparableText(segment?.scene_heading, location.name)
  ));

  if (textualMatch) {
    return textualMatch.id;
  }

  const byScene = locations.find((location) => {
    const related = relatedSceneIdsByLocationId.get(location.id) ?? [];
    return sourceSceneIds.some((sceneId) => related.includes(sceneId));
  });

  if (byScene) {
    return byScene.id;
  }

  return fallbackId || locations[0]?.id || 'loc_01';
};

const resolveCharacters = (segment) => {
  const names = Array.isArray(segment?.entities?.characters) ? segment.entities.characters : [];
  const ids = resolveCharacterIds(names);
  return ids.length > 0 ? ids : characters.slice(0, 1).map((character) => character.id).filter(Boolean);
};

const buildActions = (segment, characterIds, emotion) => {
  const sourceActions = Array.isArray(segment?.key_actions) ? segment.key_actions : [];
  const fallbackActions = sourceActions.length > 0 ? sourceActions : ['상황을 관찰한다'];

  return fallbackActions.slice(0, Math.max(1, Math.min(3, characterIds.length || 1))).map((detail, index) => ({
    character: characterIds[index] ?? characterIds[0] ?? (characters[0]?.id || 'char_01'),
    action: slugify(detail) || 'observe',
    emotion: emotion || 'neutral',
    detail,
  }));
};

const buildDialogue = (segment, characterIds, emotion) => {
  const summary = String(segment?.summary ?? '').trim();
  if (!summary || characterIds.length === 0) {
    return [];
  }

  return [{
    speaker: characterIds[0],
    text: `${summary.slice(0, 70)}${summary.length > 70 ? '...' : ''}`,
    tone: emotion || 'neutral',
    subtext: '현재 장면의 핵심 감정을 드러내는 요약 대사',
  }];
};

const buildSourceSceneIds = (beat, index) => {
  if (Array.isArray(beat?.source_scene_ids) && beat.source_scene_ids.length > 0) {
    return uniqueStrings(beat.source_scene_ids);
  }

  return [segments[index]?.scene_id].filter(Boolean);
};

const buildSourceBeatIds = (scene, index) => {
  const explicitBeatIds = Array.isArray(scene?.source_beats) && scene.source_beats.length > 0
    ? scene.source_beats.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [index + 1];

  return explicitBeatIds.length > 0 ? explicitBeatIds : [index + 1];
};

const fallbackScenes = beatSheet.map((beat, index, array) => {
  const sourceSceneIds = buildSourceSceneIds(beat, index);
  const segment = segmentById.get(sourceSceneIds[0]) ?? segments[index] ?? {};
  const locationId = resolveLocationId(
    [
      segment.scene_heading,
      ...(Array.isArray(segment?.entities?.locations) ? segment.entities.locations : []),
    ],
    sourceSceneIds,
    segment,
  );
  const location = locations.find((entry) => entry.id === locationId) ?? { id: locationId, name: segment?.scene_heading || '미상 공간' };
  const charactersPresent = resolveCharacters(segment);
  const emotion = beat.emotion || (Array.isArray(segment.emotion_tone) ? segment.emotion_tone[0] : '') || 'neutral';
  const durationTargetSec = Math.round(clamp(
    Number(beat.duration_ratio ?? (1 / Math.max(array.length, 1))) * fallbackTotalDurationTargetSec,
    5,
    180,
  ));

  return {
    scene_id: toSceneId(index),
    source_beats: [beat.beat_id ?? (index + 1)],
    source_scene_ids: sourceSceneIds,
    heading: buildHeading(segment, location),
    location_id: locationId,
    time_of_day: normalizeTimeOfDay(segment.scene_heading),
    characters_present: charactersPresent,
    description: beat.description || segment.summary || episodeContext.episode_summary || '',
    actions: buildActions(segment, charactersPresent, emotion),
    dialogue: buildDialogue(segment, charactersPresent, emotion),
    mood: {
      visual: slugify(normalizedInput.production_hints?.dominant_mood || emotion) || 'dramatic',
      audio: beat.tension >= 0.7 ? 'tense_silence' : 'ambient_room_tone',
    },
    duration_target_sec: durationTargetSec,
  };
});

const normalizedScenes = Array.isArray(parsed.scenes) && parsed.scenes.length > 0
  ? parsed.scenes.map((scene, index) => {
      const fallbackScene = fallbackScenes[index] ?? fallbackScenes[0] ?? {
        scene_id: toSceneId(index),
        source_beats: [index + 1],
        source_scene_ids: [],
        heading: 'INT. 미상 공간 - 불명',
        location_id: locations[0]?.id || 'loc_01',
        time_of_day: 'unspecified',
        characters_present: characters.slice(0, 1).map((character) => character.id).filter(Boolean),
        description: '',
        actions: [],
        dialogue: [],
        mood: { visual: 'dramatic', audio: 'ambient_room_tone' },
        duration_target_sec: 12,
      };
      const sourceBeatIds = buildSourceBeatIds(scene, index);
      const sourceSceneIds = uniqueStrings(
        sourceBeatIds.flatMap((beatId) => buildSourceSceneIds(findBeatById(beatId), index)),
      );
      const segment = segmentById.get(sourceSceneIds[0]) ?? segmentById.get(fallbackScene.source_scene_ids?.[0]) ?? segments[index] ?? {};

      const normalizedCharacters = resolveCharacterIds(
        Array.isArray(scene?.characters_present) ? scene.characters_present : [],
        fallbackScene.characters_present.length > 0 ? fallbackScene.characters_present : resolveCharacters(segment),
      );
      const resolvedLocationId = resolveLocationId(
        [
          scene?.location_id,
          scene?.heading,
          scene?.description,
          segment?.scene_heading,
          ...(Array.isArray(segment?.entities?.locations) ? segment.entities.locations : []),
        ],
        sourceSceneIds.length > 0 ? sourceSceneIds : (fallbackScene.source_scene_ids ?? []),
        segment,
        fallbackScene.location_id,
      );
      const resolvedTimeOfDay = normalizeTimeOfDay(
        scene?.time_of_day,
        scene?.heading,
        segment?.scene_heading,
        fallbackScene.time_of_day,
      );

      return {
        scene_id: toSceneId(index),
        source_beats: sourceBeatIds,
        heading: typeof scene?.heading === 'string' && scene.heading.trim() ? scene.heading : fallbackScene.heading,
        location_id: resolvedLocationId,
        time_of_day: resolvedTimeOfDay,
        characters_present: normalizedCharacters.length > 0 ? normalizedCharacters : fallbackScene.characters_present,
        description: typeof scene?.description === 'string' ? scene.description : fallbackScene.description,
        actions: Array.isArray(scene?.actions) && scene.actions.length > 0
          ? scene.actions.map((action, actionIndex) => ({
              character: resolveCharacterId(
                action?.character,
                normalizedCharacters[actionIndex] ?? normalizedCharacters[0] ?? fallbackScene.characters_present[0] ?? 'char_01',
              ),
              action: slugify(action?.action) || 'observe',
              emotion: typeof action?.emotion === 'string' && action.emotion.trim()
                ? action.emotion
                : 'neutral',
              detail: typeof action?.detail === 'string' ? action.detail : '',
            }))
          : fallbackScene.actions,
        dialogue: Array.isArray(scene?.dialogue)
          ? scene.dialogue.map((line) => ({
              speaker: resolveCharacterId(
                line?.speaker,
                normalizedCharacters[0] ?? fallbackScene.characters_present[0] ?? 'char_01',
              ),
              text: typeof line?.text === 'string' ? line.text : '',
              tone: typeof line?.tone === 'string' && line.tone.trim() ? line.tone : 'neutral',
              subtext: typeof line?.subtext === 'string' ? line.subtext : '',
            }))
          : fallbackScene.dialogue,
        mood: {
          visual: typeof scene?.mood?.visual === 'string' && scene.mood.visual.trim()
            ? scene.mood.visual
            : fallbackScene.mood.visual,
          audio: typeof scene?.mood?.audio === 'string' && scene.mood.audio.trim()
            ? scene.mood.audio
            : fallbackScene.mood.audio,
        },
        duration_target_sec: Math.round(clamp(
          Number(scene?.duration_target_sec ?? fallbackScene.duration_target_sec),
          5,
          180,
        )),
      };
    })
  : fallbackScenes.map(({ source_scene_ids, ...scene }) => scene);

const totalDurationTargetSec = normalizedScenes.reduce(
  (sum, scene) => sum + (Number(scene.duration_target_sec) || 0),
  0,
);

return [{
  json: {
    ...item,
    screenplayStatus: normalizedScenes.length > 0 ? 'ready' : 'partial',
    screenplayInputVersion: 'v1',
    screenplay: {
      scenes: normalizedScenes,
      total_scenes: normalizedScenes.length,
      total_duration_target_sec: totalDurationTargetSec,
    },
  },
}];
