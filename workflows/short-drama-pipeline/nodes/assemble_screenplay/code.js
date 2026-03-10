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
const uniqueStrings = (values) => [...new Set(
  values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean),
)];
const slugify = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');
const toSceneId = (index) => `sc_${String(index + 1).padStart(3, '0')}`;

const segmentById = new Map(
  segments
    .filter((segment) => typeof segment?.scene_id === 'string' && segment.scene_id)
    .map((segment) => [segment.scene_id, segment]),
);
const characterIdByName = new Map(
  characters
    .filter((character) => typeof character?.name === 'string' && typeof character?.id === 'string')
    .map((character) => [character.name, character.id]),
);

const relatedSceneIdsByLocationId = new Map(
  locations.map((location) => [
    location.id,
    Array.isArray(location.related_scene_ids) ? location.related_scene_ids : [],
  ]),
);

const inferTimeOfDay = (value) => {
  const text = String(value ?? '');

  if (text.includes('아침')) {
    return 'morning';
  }
  if (text.includes('밤')) {
    return 'night';
  }
  if (text.includes('저녁')) {
    return 'evening';
  }
  if (text.includes('낮')) {
    return 'day';
  }

  return 'unspecified';
};

const buildHeading = (segment, location) => {
  const locationName = segment?.scene_heading || location?.name || '미상 공간';
  const timeOfDay = inferTimeOfDay(segment?.scene_heading || '');
  const timeLabelMap = {
    morning: '아침',
    day: '낮',
    evening: '저녁',
    night: '밤',
    unspecified: '불명',
  };

  return `INT. ${locationName} - ${timeLabelMap[timeOfDay] ?? '불명'}`;
};

const resolveLocation = (sourceSceneIds, segment) => {
  const preferredLocationName = Array.isArray(segment?.entities?.locations) && segment.entities.locations.length > 0
    ? segment.entities.locations[0]
    : '';
  const exactByName = locations.find((location) => location.name === preferredLocationName);

  if (exactByName) {
    return exactByName;
  }

  const byScene = locations.find((location) => {
    const related = relatedSceneIdsByLocationId.get(location.id) ?? [];
    return sourceSceneIds.some((sceneId) => related.includes(sceneId));
  });

  if (byScene) {
    return byScene;
  }

  return locations[0] ?? { id: 'loc_01', name: segment?.scene_heading || '미상 공간' };
};

const resolveCharacters = (segment) => {
  const names = Array.isArray(segment?.entities?.characters) ? segment.entities.characters : [];
  const ids = uniqueStrings(names.map((name) => characterIdByName.get(name)).filter(Boolean));
  return ids.length > 0 ? ids : characters.slice(0, 1).map((character) => character.id);
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

const fallbackScenes = beatSheet.map((beat, index, array) => {
  const sourceSceneIds = Array.isArray(beat.source_scene_ids) && beat.source_scene_ids.length > 0
    ? beat.source_scene_ids
    : [segments[index]?.scene_id].filter(Boolean);
  const segment = segmentById.get(sourceSceneIds[0]) ?? segments[index] ?? {};
  const location = resolveLocation(sourceSceneIds, segment);
  const charactersPresent = resolveCharacters(segment);
  const emotion = beat.emotion || (Array.isArray(segment.emotion_tone) ? segment.emotion_tone[0] : '') || 'neutral';
  const durationTargetSec = Math.round(clamp(Number(beat.duration_ratio ?? (1 / Math.max(array.length, 1))) * 90, 6, 30));

  return {
    scene_id: toSceneId(index),
    source_beats: [beat.beat_id ?? (index + 1)],
    heading: buildHeading(segment, location),
    location_id: location.id,
    time_of_day: inferTimeOfDay(segment.scene_heading || ''),
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
        heading: 'INT. 미상 공간 - 불명',
        location_id: locations[0]?.id || 'loc_01',
        time_of_day: 'unspecified',
        characters_present: characters.slice(0, 1).map((character) => character.id),
        description: '',
        actions: [],
        dialogue: [],
        mood: { visual: 'dramatic', audio: 'ambient_room_tone' },
        duration_target_sec: 12,
      };

      const normalizedCharacters = uniqueStrings(
        Array.isArray(scene?.characters_present) ? scene.characters_present : fallbackScene.characters_present,
      );

      return {
        scene_id: toSceneId(index),
        source_beats: Array.isArray(scene?.source_beats) && scene.source_beats.length > 0
          ? scene.source_beats.map((value) => Number(value)).filter((value) => Number.isFinite(value))
          : fallbackScene.source_beats,
        heading: typeof scene?.heading === 'string' && scene.heading.trim() ? scene.heading : fallbackScene.heading,
        location_id: typeof scene?.location_id === 'string' && scene.location_id.trim()
          ? scene.location_id
          : fallbackScene.location_id,
        time_of_day: typeof scene?.time_of_day === 'string' && scene.time_of_day.trim()
          ? scene.time_of_day
          : fallbackScene.time_of_day,
        characters_present: normalizedCharacters.length > 0 ? normalizedCharacters : fallbackScene.characters_present,
        description: typeof scene?.description === 'string' ? scene.description : fallbackScene.description,
        actions: Array.isArray(scene?.actions) && scene.actions.length > 0
          ? scene.actions.map((action, actionIndex) => ({
              character: typeof action?.character === 'string' && action.character.trim()
                ? action.character
                : (normalizedCharacters[actionIndex] ?? normalizedCharacters[0] ?? fallbackScene.characters_present[0] ?? 'char_01'),
              action: slugify(action?.action) || 'observe',
              emotion: typeof action?.emotion === 'string' && action.emotion.trim()
                ? action.emotion
                : 'neutral',
              detail: typeof action?.detail === 'string' ? action.detail : '',
            }))
          : fallbackScene.actions,
        dialogue: Array.isArray(scene?.dialogue)
          ? scene.dialogue.map((line) => ({
              speaker: typeof line?.speaker === 'string' && line.speaker.trim()
                ? line.speaker
                : (normalizedCharacters[0] ?? fallbackScene.characters_present[0] ?? 'char_01'),
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
        duration_target_sec: Math.round(clamp(Number(scene?.duration_target_sec ?? fallbackScene.duration_target_sec), 5, 40)),
      };
    })
  : fallbackScenes;

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
