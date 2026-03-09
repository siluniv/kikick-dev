const item = $input.first().json;
const submittedStory = String(item.submittedStory ?? item.story ?? '').replace(/\r\n/g, '\n').trim();

if (!submittedStory) {
  throw new Error('submittedStory is empty. Enter story text in the form before running Input Normalize.');
}

const cleanedStory = submittedStory
  .replace(/\t/g, ' ')
  .replace(/[ \u00A0]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const sceneHeadingCount = (cleanedStory.match(/^#\s*\d+[^\n]*/gm) ?? []).length;
const storyLineCount = cleanedStory.split('\n').filter((line) => line.trim().length > 0).length;

return [{
  json: {
    ...item,
    submittedStory: cleanedStory,
    sceneHeadingCount,
    storyLineCount,
    detectedLanguage: 'ko',
    inputStage: 'input_received',
  },
}];
