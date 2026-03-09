const item = $input.first().json;
const payloadNode = $node['Build Episode Context Payload']?.json ?? {};
const normalizedNode = $node['Assemble Normalized Input']?.json ?? {};
const normalizedInput =
  item.normalizedInput
  ?? payloadNode.normalizedInput
  ?? normalizedNode.normalizedInput
  ?? {};
const analysisInput =
  item.episodeContextAnalysisInput
  ?? payloadNode.episodeContextAnalysisInput
  ?? normalizedInput;
const parsed = item.output && typeof item.output === 'object' ? item.output : item;
const story = analysisInput.story_text_structured ?? {};
const segments = Array.isArray(story.segments) ? story.segments : [];
const relationships = Array.isArray(normalizedInput.entity_candidates?.relationships)
  ? normalizedInput.entity_candidates.relationships
  : [];
const llmWatchouts = Array.isArray(parsed.continuity_watchouts) ? parsed.continuity_watchouts : [];

const uniqueStrings = (values) => [...new Set(
  values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean),
)];

const countRecurringEntities = (selector) => {
  const counts = new Map();

  segments.forEach((segment) => {
    const values = uniqueStrings(selector(segment));
    values.forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return [...counts.values()].filter((count) => count > 1).length;
};

const totalContinuityRisks = segments.reduce(
  (sum, segment) => sum + (Array.isArray(segment.continuity_risks) ? segment.continuity_risks.length : 0),
  0,
);

const relationshipSignalCount = segments.reduce(
  (sum, segment) => sum + (Array.isArray(segment.relationship_signals) ? segment.relationship_signals.length : 0),
  0,
);

const recurringCharacterCount = countRecurringEntities(
  (segment) => Array.isArray(segment.entities?.characters) ? segment.entities.characters : [],
);

const recurringLocationCount = countRecurringEntities(
  (segment) => Array.isArray(segment.entities?.locations) ? segment.entities.locations : [],
);

const recurringPropCount = countRecurringEntities(
  (segment) => Array.isArray(segment.entities?.props) ? segment.entities.props : [],
);

const sourceSceneIds = segments.map((segment) => segment.scene_id).filter((value) => typeof value === 'string' && value);

const relationshipPenalty = relationships.length > 0 && relationshipSignalCount === 0 ? 8 : 0;
const riskPenalty = Math.min(totalContinuityRisks * 6, 30);
const structureBonus = Math.min(Math.max(segments.length - 1, 0) * 2, 10);
const recurrenceBonus = Math.min(
  recurringCharacterCount + Math.min(recurringLocationCount, 2) + Math.min(recurringPropCount, 2),
  12,
);

const rawScore = 70 + structureBonus + recurrenceBonus - riskPenalty - relationshipPenalty;
const continuityScore = Math.max(0, Math.min(100, rawScore));

let continuityConfidence = 'medium';
if (segments.length >= 4 && totalContinuityRisks <= 2) {
  continuityConfidence = 'high';
} else if (segments.length <= 2 || totalContinuityRisks >= 4) {
  continuityConfidence = 'low';
}

const heuristicWatchouts = [];

if (totalContinuityRisks > 0) {
  heuristicWatchouts.push(`장면별 continuity_risks가 총 ${totalContinuityRisks}건 감지되어 후속 검토가 필요합니다.`);
}

if (relationships.length > 0 && relationshipSignalCount === 0) {
  heuristicWatchouts.push('관계 후보는 존재하지만 scene 단위 relationship_signals 근거가 약합니다.');
}

if (segments.length <= 1) {
  heuristicWatchouts.push('장면 수가 적어 episode-level continuity 판단 근거가 제한적입니다.');
}

if ((normalizedInput.input_metadata?.attachment_count ?? 0) > 0) {
  heuristicWatchouts.push('첨부 분석이 포함되어 있으면 continuity score 해석 범위를 별도 검토해야 합니다.');
}

const continuityWatchouts = uniqueStrings([
  ...llmWatchouts,
  ...heuristicWatchouts,
]);

const normalizedSceneFunctions = Array.isArray(parsed.scene_functions)
  ? parsed.scene_functions.map((sceneFunction, index) => {
      const requestedSceneId = typeof sceneFunction?.scene_id === 'string' ? sceneFunction.scene_id.trim() : '';
      const fallbackSceneId = sourceSceneIds[index] ?? '';
      const sceneId = sourceSceneIds.includes(requestedSceneId) ? requestedSceneId : fallbackSceneId;

      return {
        scene_id: sceneId,
        function: typeof sceneFunction?.function === 'string' ? sceneFunction.function : '',
        why_it_matters: typeof sceneFunction?.why_it_matters === 'string' ? sceneFunction.why_it_matters : '',
      };
    })
  : [];

if (Array.isArray(parsed.scene_functions) && normalizedSceneFunctions.some((sceneFunction, index) => {
  const requestedSceneId = typeof parsed.scene_functions[index]?.scene_id === 'string'
    ? parsed.scene_functions[index].scene_id.trim()
    : '';
  return requestedSceneId && requestedSceneId !== sceneFunction.scene_id;
})) {
  continuityWatchouts.push('scene_functions의 일부 scene_id가 입력 contract와 달라 입력 scene_id 기준으로 보정되었습니다.');
}

const episodeContext = {
  episode_summary: parsed.episode_summary ?? story.summary ?? '',
  central_conflict: parsed.central_conflict ?? normalizedInput.production_hints?.core_conflict ?? '',
  dramatic_question: parsed.dramatic_question ?? '',
  continuity_score: continuityScore,
  continuity_confidence: continuityConfidence,
  continuity_basis: {
    scope: 'current_episode_only',
    scoring_mode: item.scoringMode ?? 'heuristic_plus_llm',
    signals: {
      scene_count: segments.length,
      continuity_risk_count: totalContinuityRisks,
      relationship_signal_count: relationshipSignalCount,
      recurring_character_count: recurringCharacterCount,
      recurring_location_count: recurringLocationCount,
      recurring_prop_count: recurringPropCount,
    },
    limitations: [
      'prior_episode_context_unavailable',
      'series_bible_lookup_not_connected',
    ],
  },
  continuity_watchouts: continuityWatchouts,
  scene_functions: normalizedSceneFunctions,
  relationship_progressions: Array.isArray(parsed.relationship_progressions) ? parsed.relationship_progressions : [],
};

const status = segments.length > 0 ? 'ready' : 'partial';

return [{
  json: {
    ...item,
    episodeContextStatus: status,
    episodeContextInputVersion: 'v1',
    episodeContext,
  },
}];
