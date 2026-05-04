const GENERIC_QUESTIONS = [
  'Explain this passage in simpler terms',
  'What is the significance of this passage?',
  'What themes does this passage relate to?',
  'Summarize what is happening here',
];

const PATTERN_QUESTIONS: Array<{
  regex: RegExp;
  build: (match: RegExpMatchArray) => string;
}> = [
  {
    regex:
      /\b(is|was|seemed|felt|looked|appeared)\s+(angry|furious|enraged|upset|sad|depressed|happy|joyful|excited|afraid|scared|frightened|nervous|anxious|confused|surprised|shocked|jealous|envious|guilty|ashamed|embarrassed|proud|lonely|desperate|worried|frustrated|irritated|annoyed|bitter|resentful)\b/i,
    build: (m) => `Why is the character feeling ${m[2]!.toLowerCase()} here?`,
  },
  {
    regex: /\b(he|she|they|it|we)\s+(referred|refers|mentioned|mentions|alluded|alludes)\s+to\b/i,
    build: () => 'What event are they referring to?',
  },
  {
    regex: /\b(because|since|due to|as a result|therefore|consequently|reason)\b/i,
    build: () => 'What caused this to happen?',
  },
  {
    regex: /\b(said|replied|whispered|shouted|exclaimed|murmured|asked|demanded)\b["\s]/i,
    build: () => 'What motivates this character here?',
  },
  {
    regex: /\b(metaphor|simile|symbolism|imagery|foreshadowing|irony|allegory)\b/i,
    build: (m) => `Explain the use of ${m[1]!.toLowerCase()} in this passage`,
  },
];

export function generateSuggestedQuestions(text: string): string[] {
  const questions: string[] = [];

  for (const { regex, build } of PATTERN_QUESTIONS) {
    const match = text.match(regex);
    if (match) {
      questions.push(build(match));
    }
    if (questions.length >= 2) break;
  }

  // Fill remaining slots with generic questions
  for (const q of GENERIC_QUESTIONS) {
    if (questions.length >= 4) break;
    if (!questions.includes(q)) {
      questions.push(q);
    }
  }

  return questions;
}
