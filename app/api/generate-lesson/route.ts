import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { curriculum } from "@/app/data/curriculum";

export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Progressive difficulty helpers ──────────────────────────────────────────

function getQuestionCount(day: number): number {
  if (day <= 10) return 8;
  if (day <= 20) return 9;
  if (day <= 30) return 10;
  if (day <= 40) return 12;
  if (day <= 50) return 13;
  if (day <= 60) return 14;
  if (day <= 70) return 16;
  if (day <= 80) return 18;
  return 20;
}

function getAllowedTypes(day: number): string {
  if (day <= 30) {
    return "short_answer, multiple_choice, vocabulary_in_context, matching_heading, cloze, inference";
  }
  if (day <= 60) {
    return "short_answer, multiple_choice, vocabulary_in_context, matching_heading, matching_person_opinion, cloze, gapped_text, inference, writer_purpose, main_argument";
  }
  if (day <= 80) {
    return "short_answer, multiple_choice, vocabulary_in_context, matching_heading, matching_person_opinion, cloze, gapped_text, inference, writer_purpose, main_argument, counterargument";
  }
  return "multiple_choice, vocabulary_in_context, matching_heading, matching_person_opinion, cloze, gapped_text, inference, writer_purpose, main_argument, counterargument, open_analytical_answer";
}

function getRequiredTypeMix(day: number): string {
  if (day >= 81) {
    return "REQUIRED MIX: MUST include multiple_choice, at least one of matching_heading/matching_person_opinion, cloze, gapped_text, inference, vocabulary_in_context, writer_purpose, at least one of main_argument/counterargument, and open_analytical_answer. All nine diversity requirements must be met.";
  }
  if (day >= 61) {
    return "REQUIRED MIX: MUST include multiple_choice, vocabulary_in_context, at least one of matching_heading/matching_person_opinion, cloze, gapped_text, inference, writer_purpose, and main_argument. counterargument is allowed from Day 68.";
  }
  if (day >= 31) {
    return "REQUIRED MIX: MUST include multiple_choice, vocabulary_in_context, at least one of matching_heading/matching_person_opinion, cloze, gapped_text, inference, writer_purpose, and main_argument.";
  }
  return "REQUIRED MIX: MUST include short_answer, multiple_choice, vocabulary_in_context, matching_heading, cloze, and inference. Do NOT use gapped_text, open_analytical_answer, writer_purpose, or counterargument.";
}

function getConversationGuidance(day: number): string {
  if (day <= 30) {
    return `Days 1–30 (A2+/B1): Write a practical, realistic everyday dialogue. Keep it natural and grounded in daily Danish life. Short and medium-length sentences are appropriate.`;
  }
  if (day <= 60) {
    return `Days 31–60 (B1/B1+): Write a structured dialogue including opinions, brief explanations, and more complex sentence structures. Include at least one disagreement or contrasting view. Use connectors: selvom, dog, til gengæld, fordi, desuden.`;
  }
  if (day <= 75) {
    return `Days 61–75 (B1+/B2): Write a sophisticated dialogue using hedging (måske, sandsynligvis, det lader til), passive voice, relative clauses (som, der), and nominalisations. Include clear argumentation and at least one explicit counterargument exchange. Simple filler lines such as "Det er interessant" are forbidden — every turn must carry content.`;
  }
  return `Days 76–90 — PD3 simulation zone (Day ${day}): Write a formally argued PD3-level dialogue. Every speaker must present structured arguments using advanced connectors (imidlertid, endvidere, ganske vist... men dog, på trods af, ikke desto mindre), passive constructions, nominalisations, and hedging language. Disagreement and counterargument are mandatory. Day ${day} must be measurably harder in linguistic complexity than Day 75. Simple exchanges like "Vi har lært meget" or "Det er godt" are FORBIDDEN — every single turn must carry argumentative or analytical content.`;
}

function getReadingGuidance(day: number, textType: string): string {
  if (day <= 30) {
    return `Days 1–30: Write a short, practical text — a diary entry, notice, ad, short email, or everyday message. Simple sentences. Present or simple past tense.`;
  }
  if (day <= 60) {
    return `Days 31–60: Write an adult, article-like text — a newspaper feature, blog post, or informational piece — with a clear structure (introduction, body, conclusion).`;
  }
  if (day <= 75) {
    return `Days 61–75: Write a PD3-level text matching: ${textType}. Use advanced connectors, passive voice, and nominalisations. Complex argument structure is required. Never output placeholders.`;
  }
  return `Days 76–90 — PD3 simulation (Day ${day}): Write a full PD3 reading practice text. Genre: ${textType}. This must feel like a real PD3 exam reading task — analytical or journalistic register, nuanced multi-paragraph argument, advanced vocabulary, complex subordinate clause structures. Day ${day} must be measurably harder to read than Day 75. FORBIDDEN under any circumstances: [continue here], [additional X words], any bracketed placeholder text. Write the complete, uninterrupted text.`;
}

function getVocabularyBias(day: number): string {
  if (day > 60) {
    return `VOCABULARY BIAS (Day ${day}, after Day 60): Strongly prioritize connectors, collocations, formal expressions, argument phrases, and nominalisations. At least 10 of the 15+ vocabulary items MUST be phrases, collocations, formal multi-word expressions, or argument structures. Isolated single words are low priority.`;
  }
  if (day > 30) {
    return `VOCABULARY BIAS (Day ${day}, Phase 2): Include a rich mix of opinion phrases, collocations, and connectors. At least 8 of the 15+ items must be phrases or multi-word expressions.`;
  }
  return `VOCABULARY BIAS (Day ${day}, Phase 1): Focus on useful practical words and everyday phrases. At least 6 of the 15+ items must be phrases or multi-word expressions.`;
}

function getWritingProgression(day: number): string {
  if (day <= 30) {
    return `WRITING TYPE (Days 1–30): email, message, simple opinion text. Register: informal, personal. Keep the task accessible.`;
  }
  if (day <= 60) {
    return `WRITING TYPE (Days 31–60): complaint letter, opinion paragraph, comparison text, advantages-disadvantages essay. Register: semi-formal. Require a two-part or three-part writing structure.`;
  }
  return `WRITING TYPE (Days 61–90): debatindlæg, formal argumentation, PD3-style response, formal letter, or analytical essay. Register: formal or semi-formal. Require genre-appropriate opening (e.g. "Formålet med denne tekst er..."), developed arguments, counterargument acknowledgment, and formal closing.`;
}

// ── Post-generation validation ────────────────────────────────────────────────

function validateGeneratedLesson(
  lesson: Record<string, unknown>,
  gp0Title: string,
  gp1Title: string
): string | null {
  if (!Array.isArray(lesson.grammarPoints)) {
    return "grammarPoints is missing or not an array";
  }
  if (lesson.grammarPoints.length !== 2) {
    return `grammarPoints must have exactly 2 items (got ${lesson.grammarPoints.length})`;
  }

  const requiredStringFields = [
    "title", "explanationPersian", "pattern", "formation", "use",
    "commonMistake", "whyBetterForPD3", "appliedExample",
    "grammarAwarePracticeIdea", "integrationNotes", "focus", "level",
  ];
  const requiredArrayFields = ["mustTeach", "examples"];

  for (let i = 0; i < 2; i++) {
    const gpt = lesson.grammarPoints[i] as Record<string, unknown>;
    const expectedTitle = i === 0 ? gp0Title : gp1Title;
    const actualTitle = typeof gpt.title === "string" ? gpt.title.trim() : "";

    if (actualTitle !== expectedTitle) {
      return `grammarPoints[${i}].title "${actualTitle}" does not match required title "${expectedTitle}"`;
    }

    for (const field of requiredStringFields) {
      const val = gpt[field];
      if (!val || typeof val !== "string" || val.trim() === "") {
        return `grammarPoints[${i}].${field} is missing or empty`;
      }
    }
    for (const field of requiredArrayFields) {
      const val = gpt[field];
      if (!Array.isArray(val) || val.length === 0) {
        return `grammarPoints[${i}].${field} is missing or empty`;
      }
    }

    const upgrade = gpt.pdUpgradeExample as Record<string, unknown> | undefined;
    if (!upgrade || !upgrade.simple || !upgrade.upgraded) {
      return `grammarPoints[${i}].pdUpgradeExample is missing or incomplete`;
    }
  }

  const reading = lesson.reading as { questions?: unknown[] } | undefined;
  const qCount = Array.isArray(reading?.questions) ? reading!.questions.length : 0;
  if (qCount < 8) {
    return `reading.questions must have at least 8 items (got ${qCount})`;
  }

  const serialized = JSON.stringify(lesson).toLowerCase();
  const forbidden = ["[incomplete]", "[continue here]", "[continue]", "[additional text]", "[additional "];
  for (const phrase of forbidden) {
    if (serialized.includes(phrase)) {
      return `Forbidden placeholder text found: "${phrase}"`;
    }
  }

  return null;
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  let dayNumber: number;
  try {
    const body = await request.json();
    dayNumber = parseInt(body.dayNumber);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const day = curriculum.find((d) => d.dayNumber === dayNumber);
  if (!day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  const grammarPlan = day.grammarPlan;
  if (!grammarPlan || grammarPlan.length !== 2) {
    return NextResponse.json(
      { error: `Day ${dayNumber} grammarPlan must have exactly 2 items.` },
      { status: 500 }
    );
  }

  const grammarPlanBlock = `━━━ GRAMMAR PLAN — DAY ${dayNumber} (V3.1) ━━━

These are the ONLY two grammar items for this lesson. Do not invent, substitute, add, remove, merge, or rename grammar topics.

Grammar Item 1:
  Title: ${grammarPlan[0].title}
  Focus: ${grammarPlan[0].focus}
  Level: ${grammarPlan[0].level}
  Must Teach: ${grammarPlan[0].mustTeach.join(" | ")}
  Examples: ${grammarPlan[0].examples.join(" | ")}
  Common Mistakes: ${grammarPlan[0].commonMistakes.join(" | ")}
  Integration Notes: ${grammarPlan[0].integrationNotes}

Grammar Item 2:
  Title: ${grammarPlan[1].title}
  Focus: ${grammarPlan[1].focus}
  Level: ${grammarPlan[1].level}
  Must Teach: ${grammarPlan[1].mustTeach.join(" | ")}
  Examples: ${grammarPlan[1].examples.join(" | ")}
  Common Mistakes: ${grammarPlan[1].commonMistakes.join(" | ")}
  Integration Notes: ${grammarPlan[1].integrationNotes}`;

  // Progressive difficulty values
  const convLines =
    dayNumber <= 30 ? "15 to 20" :
    dayNumber <= 60 ? "25 to 30" :
    dayNumber <= 75 ? "30 to 40" :
    "35 to 45";

  const readingWords =
    dayNumber <= 30 ? "200 to 300" :
    dayNumber <= 60 ? "400 to 600" :
    dayNumber <= 75 ? "600 to 800" :
    "800 to 1000";

  const questionCount = getQuestionCount(dayNumber);
  const allowedTypes = getAllowedTypes(dayNumber);
  const requiredTypeMix = getRequiredTypeMix(dayNumber);

  // Build optional PD3 metadata blocks
  const vocabularyThemeBlock = day.vocabularyTheme ? `Vocabulary Theme: ${day.vocabularyTheme}` : "";
  const pd3SkillBlock = day.pd3Skill ? `Primary PD3 Skill: ${day.pd3Skill}` : "";
  const readingFocusBlock = day.readingFocus ? `Reading Focus: ${day.readingFocus}` : "";
  const writingFocusBlock = day.writingFocus ? `Writing Focus: ${day.writingFocus}` : "";
  const textTypeBlock = day.textType ? `Text Type: ${day.textType}` : "";
  const questionTypesBlock = day.questionTypes && day.questionTypes.length > 0
    ? `Suggested Question Types from Curriculum: ${day.questionTypes.join(", ")}`
    : "";
  const connectorsBlock = day.targetConnectors && day.targetConnectors.length > 0
    ? `Target Connectors: ${day.targetConnectors.join(", ")}`
    : "";
  const sentencePatternsBlock = day.sentencePatterns && day.sentencePatterns.length > 0
    ? `Sentence Patterns: ${day.sentencePatterns.join(" | ")}`
    : "";
  const writingFormatBlock = day.writingFormat ? `Writing Format: ${day.writingFormat}` : "";

  const systemPrompt = `You are an expert Danish language teacher creating comprehensive, high-quality lessons for Persian-speaking students. The student is learning Danish from A2+/B1 toward B2 and the PD3 exam.

You must return a single valid JSON object with no markdown, no code fences, no extra text — only the JSON.

LANGUAGE RULES:
- "explanationPersian" fields: MUST be written entirely in Persian (فارسی). Write at least 4–5 sentences of clear, pedagogically detailed grammatical explanation in Persian.
- "persian" fields: MUST be natural, idiomatic Persian — not word-for-word translations.
- "danish" fields: natural, authentic Danish at the specified level.
- "english" fields: accurate English translations.

CONTENT VOLUME — HARD REQUIREMENTS. Never go below these numbers. Count before finalizing:
- conversation: MINIMUM ${convLines} speaker turns. Count them. If fewer, add more.
- keySentences: MINIMUM 15 items. Target 18. Count them. If fewer than 15, add more before returning.
- grammarPoints: EXACTLY 2 items — no more, no fewer
- grammarPoints[].examples: MINIMUM 4 examples each
- vocabulary: MINIMUM 15 items. Target 20–25. At least 6 must be phrases, collocations, connectors, or fixed expressions — not single words. Count them. If fewer than 15, add more before returning.
- reading.text: MINIMUM ${readingWords} words. Count the words. If fewer, expand the text. NEVER truncate with placeholders.
- reading.questions: MINIMUM 8 items. Target 10. Count them. If fewer than 8, add more.
- suggestedFlashcards: MINIMUM 20 items. Target 25–35. Count them. If fewer than 20, add more.
- readingExamPractice.questions: EXACTLY ${questionCount} questions. This is a hard requirement for Day ${dayNumber}. Count them. Add or remove questions to reach exactly ${questionCount}.
- examStrategy (PD3 Tip of the Day): 60–90 words in Persian. Must have exactly 3 labeled sections. Maximum 100 words.

QUALITY:
- Conversation must feel realistic, not like a scripted drill. The topic should arise naturally.
- Grammar explanations in Persian must be thorough and pedagogically clear with correct Danish terminology.
- Vocabulary examples must be complete, natural sentences using the word in context.
- Reading text must be engaging and appropriate to the topic and level.
- Flashcard fronts are Danish; backs are English (or the reverse for grammar cards where front is the grammar label).
- FORBIDDEN: [continue here], [additional X words], [incomplete], [continue], [additional text], any bracketed placeholder text, and empty sections. Ellipses (...) are allowed in normal Danish sentences such as "Det kan diskuteres, om..." or "På den ene side..." — only forbidden when used as filler to avoid completing a section. Always complete every section fully.

PD3 COMPLIANCE — MANDATORY. You must follow every PD3 metadata field listed in the user prompt. These are not suggestions. Ignoring any of them is an error.`;

  const userPrompt = `Generate a complete Danish lesson with this data:

Day: ${day.dayNumber}
Topic: ${day.topic}
Level: ${day.level}
Phase: ${day.phase} of 3
Communication Goal: ${day.communicationGoal}
Writing Task: ${day.writingTask}
${vocabularyThemeBlock}
${pd3SkillBlock}
${readingFocusBlock}
${writingFocusBlock}
${textTypeBlock}
${questionTypesBlock}
${connectorsBlock}
${sentencePatternsBlock}
${writingFormatBlock}

${grammarPlanBlock}

━━━ PROGRESSIVE DIFFICULTY — DAY ${dayNumber} OF 90 ━━━

${getVocabularyBias(dayNumber)}

${getWritingProgression(dayNumber)}

━━━ PD3 GENERATION RULES ━━━

CONVERSATION — ${getConversationGuidance(dayNumber)}
- The conversation must demonstrate the target connectors (${day.targetConnectors?.join(", ") ?? "as appropriate"}) naturally within the dialogue.
- At least 3 turns must contain or reference the sentence patterns: ${day.sentencePatterns?.join(" | ") ?? "as appropriate"}.
- The communication goal must be fully achieved by the end of the conversation.
- At least 3 conversation exchanges must naturally demonstrate grammarPlan item 1 (${grammarPlan[0].title}).
- At least 3 conversation exchanges must naturally demonstrate grammarPlan item 2 (${grammarPlan[1].title}).

KEY SENTENCES — Must include:
- At least 5 sentences directly built from the sentence patterns: ${day.sentencePatterns?.join(" | ") ?? "as appropriate"}.
- At least 3 sentences that naturally use the target connectors: ${day.targetConnectors?.join(", ") ?? "as appropriate"}.
- Sentences must be reusable for real Danish communication AND for PD3 writing tasks.
- Variety: include statements, questions, and complex sentences.

GRAMMAR DEEP DIVE — Must:
- Use ONLY the two grammarPlan items provided in the GRAMMAR PLAN block above.
- Do NOT invent, substitute, add, remove, merge, or rename any grammar topic.
- grammarPoints must contain EXACTLY 2 items — no more, no less.
- grammarPoints[0].title MUST exactly match: "${grammarPlan[0].title}"
- grammarPoints[1].title MUST exactly match: "${grammarPlan[1].title}"
- Teach each item deeply. Use the mustTeach list as your minimum coverage requirement.
- The explanation must be in Persian (4–5 sentences, pedagogically detailed).
- Each grammar point MUST include ALL of the following fields:
  1. "title": the EXACT title from grammarPlan — do not alter, shorten, or rephrase
  2. "focus": the focus area from grammarPlan
  3. "level": the CEFR level from grammarPlan
  4. "mustTeach": array — cover every item listed in the grammarPlan mustTeach list
  5. "explanationPersian": Persian explanation — 4–5 sentences, covering formation, use, and what distinguishes this from similar forms
  6. "pattern": the grammatical pattern formula
  7. "formation": how the form is built step by step (e.g. verb stem + ending, auxiliary + past participle)
  8. "use": when and why this grammar form is used — contexts, registers, distinctions from similar structures
  9. "examples": at least 4 natural, complete Danish example sentences
  10. "commonMistake": a typical error made by Persian speakers, with the incorrect form, the correct form, and a brief explanation
  11. "pdUpgradeExample": { "simple": <basic B1 sentence>, "upgraded": <PD3-quality version using this grammar more sophisticatedly> }
  12. "whyBetterForPD3": one Danish sentence explaining why the upgraded version is better for PD3
  13. "appliedExample": one sentence applying this grammar to today's writing task topic
  14. "grammarAwarePracticeIdea": a short reading question or exercise idea that tests this grammar in context — something a learner can practise immediately
  15. "integrationNotes": how this grammar connects to today's lesson topic, writing task, and reading
- Grammar must connect to today's reading question types and writing format.

LESSON INTEGRATION — 50–70% of the lesson must reinforce the two grammarPlan items:
- CONVERSATION: Include at least 3 exchanges demonstrating ${grammarPlan[0].title} and at least 3 demonstrating ${grammarPlan[1].title}.
- READING TEXT: Embed several authentic examples of both grammarPlan items naturally in the reading text.
- READING QUESTIONS (reading.questions): At least one question must explicitly test ${grammarPlan[0].title}. At least one question must explicitly test ${grammarPlan[1].title}.
- WRITING TASK: The writing task instruction must explicitly require the learner to use both grammarPlan items.
- FLASHCARDS: Include at least 5 flashcards built from sentences demonstrating ${grammarPlan[0].title}. Include at least 5 built from sentences demonstrating ${grammarPlan[1].title}.

VOCABULARY — Must:
- Cover the vocabulary theme: ${day.vocabularyTheme ?? day.topic}.
- Include NOT only single words but also useful phrases, collocations, and multi-word expressions.
- At least 6 items must be phrases, collocations, connectors, or fixed expressions — not single words.
- Every vocabulary item must have a full, natural Danish sentence as its "example" field — not a fragment.
- Set the "category" field for each item: "word" for single words, "phrase" for multi-word expressions, "collocation" for common word combinations, "connector" for discourse connectors and linking words.
- Prioritize words and phrases the student will actually need for PD3 reading and writing tasks.

READING — ${getReadingGuidance(dayNumber, day.textType ?? "appropriate text type")}
- The text type must be: ${day.textType ?? "appropriate to the phase"}.
- The text must match the reading focus: ${day.readingFocus ?? "general comprehension"}.
- The reading text MUST be at minimum ${readingWords.split(" ")[0]} words. Count the words and expand if needed. Never use placeholders.
- Do NOT output true/false questions anywhere in reading.questions. Allowed simple types: short_answer, multiple_choice, matching, cloze, inference.

WRITING TASK — Must include a clear, structured writing instruction:
- What to write: ${day.writingTask}
- Text type: ${day.textType ?? "appropriate to the phase"}
- Situation/context: based on the day's topic and communication goal
- Writing focus: ${day.writingFocus ?? "general writing practice"}
- Text format and structure: ${day.writingFormat ?? "as appropriate to the phase"}
- Required word count: ${day.phase === 1 ? "80–120 words" : day.phase === 2 ? "120–180 words" : "180–250 words"}
- Register/style: ${day.phase === 1 ? "informal, personal" : day.phase === 2 ? "semi-formal, clear" : "formal or semi-formal, structured argument"}
- Required connectors: ${day.targetConnectors?.join(", ") ?? "as appropriate"}
- Required sentence patterns: ${day.sentencePatterns?.join(" | ") ?? "as appropriate"}
- Must explicitly require the learner to use: ${grammarPlan[0].title} AND ${grammarPlan[1].title}
- The "writingTask" field in the JSON output must contain this full structured instruction — not just the task title.

SUGGESTED FLASHCARDS — Must produce 20–35 items total:
- Prioritize full sentences and phrases over isolated words.
- Include at least 5 flashcards built directly from the sentence patterns.
- Include at least 3 flashcards covering target connectors with example sentences.
- Include at least 5 vocabulary flashcards from the vocabulary theme, prioritizing phrases and collocations.
- Include at least 3 grammar flashcards (front: grammar label; back: explanation + example).
- Include at least 5 flashcards with sentences demonstrating ${grammarPlan[0].title}.
- Include at least 5 flashcards with sentences demonstrating ${grammarPlan[1].title}.
- Include at least 3 flashcards with PD3 exam expressions or writing formulas useful for the exam.
- Remaining flashcards: key sentences from the lesson that are useful for PD3 writing.

PD3 TIP OF THE DAY — Must produce a dedicated examStrategy field:
- Write entirely in Persian (فارسی).
- Target 60–90 words. Maximum 100 words.
- Must have EXACTLY THREE labeled sections in this order:
  نکته عملی: [one practical tip specific to today's question type or writing task — be specific to Day ${dayNumber}]
  مثال کوتاه: [one short Danish example sentence directly illustrating the tip]
  تکنیک آزمون: [one PD3 exam technique relevant to today's text type: ${day.textType ?? "reading/writing task"}]
- No verbose general explanations. No repeating advice from other days. Be concise and specific.

READING EXAM PRACTICE — Must produce exactly ${questionCount} questions (hard requirement for Day ${dayNumber}):
- All questions must be based on the reading text in "reading.text".
- ALLOWED QUESTION TYPES for Day ${dayNumber}: ${allowedTypes}
- ${requiredTypeMix}
- true_false is FORBIDDEN. Never output a question with type "true_false" or "true/false".
- Every question must have: type, instruction, correctAnswer (never empty), and explanationPersian (in Persian, minimum 2 sentences explaining why the answer is correct).
- Per-type required fields — follow exactly:
  - short_answer: { type, instruction, question, correctAnswer, explanationPersian }
  - multiple_choice: { type, instruction, question, options (array of exactly 4 strings, each prefixed "A. "/"B. "/"C. "/"D. "), correctAnswer (single letter, e.g. "B"), explanationPersian }
  - vocabulary_in_context: { type, instruction, question (quote the word/phrase from the text and its surrounding sentence), options (array of exactly 4 meanings, prefixed "A."–"D."), correctAnswer (single letter), explanationPersian }
  - matching_heading: { type, instruction, items (array of 4–6 objects: { id, left: heading/label, right: paragraph summary or text excerpt }), correctAnswer (e.g. "1-C, 2-A, 3-B"), explanationPersian } — do NOT include a "question" field
  - matching_person_opinion: { type, instruction, items (array of 4–6 objects: { id, left: person/group name, right: opinion or statement }), correctAnswer (e.g. "1-C, 2-A, 3-B"), explanationPersian } — do NOT include a "question" field
  - cloze: { type, instruction, textWithBlanks (sentence or short paragraph with ___ for each blank), options (array of the correct words), correctAnswer (words in order, comma-separated), explanationPersian } — do NOT include "gappedParagraph"
  - gapped_text: { type, instruction, gappedParagraph (a paragraph with [___] where the missing sentence belongs), missingSentenceOptions (array of exactly 4 strings, each prefixed "A. "/"B. "/"C. "/"D. "), correctAnswer (single letter, e.g. "A"), explanationPersian } — do NOT include "textWithBlanks"
  - inference: { type, instruction, question, correctAnswer (inferred meaning plus reference to text evidence), explanationPersian }
  - writer_purpose: { type, instruction, question (ask what the writer's main purpose or intention is, or how they position themselves), correctAnswer (explains the writer's purpose with text evidence), explanationPersian }
  - main_argument: { type, instruction, question (ask to identify the central claim or main argument of the text), correctAnswer (states the main argument with text reference), explanationPersian }
  - counterargument: { type, instruction, question (ask to identify the main counterargument or opposing view acknowledged in the text), correctAnswer (identifies it with text reference), explanationPersian }
  - open_analytical_answer: { type, instruction, question (ask for 2–4 sentences in Danish connecting text content to a broader analytical question), correctAnswer (a model 2–4 sentence Danish answer), explanationPersian }
- The title must be in Danish (e.g. "PD3 Læseforståelse — Eksamensøvelse").

Return this exact JSON structure (fill every field with real content):
{
  "day": ${day.dayNumber},
  "title": "<a short, catchy Danish title for this lesson, different from the topic name>",
  "level": "${day.level}",
  "topic": "${day.topic}",
  "conversation": [
    { "speaker": "A", "danish": "...", "english": "...", "persian": "..." },
    { "speaker": "B", "danish": "...", "english": "...", "persian": "..." }
  ],
  "keySentences": [
    { "danish": "...", "english": "...", "persian": "..." }
  ],
  "grammarPoints": [
    {
      "title": "<MUST exactly match: ${grammarPlan[0].title}>",
      "focus": "${grammarPlan[0].focus}",
      "level": "${grammarPlan[0].level}",
      "mustTeach": ["<point from mustTeach list>", "..."],
      "explanationPersian": "<4–5 sentences in Persian — pedagogically detailed, covering formation, use, and what distinguishes this grammar>",
      "pattern": "<grammatical pattern formula>",
      "formation": "<step-by-step formation: how the form is built>",
      "use": "<when and why this form is used — contexts and registers>",
      "examples": ["<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>"],
      "commonMistake": "<typical Persian-speaker error with incorrect form, correct form, and explanation>",
      "pdUpgradeExample": { "simple": "<basic B1 sentence>", "upgraded": "<PD3-quality version>" },
      "whyBetterForPD3": "<one Danish sentence explaining why the upgraded version is better>",
      "appliedExample": "<one sentence applying this grammar to today's writing task topic>",
      "grammarAwarePracticeIdea": "<a short reading question or exercise idea that tests this grammar>",
      "integrationNotes": "<how this grammar connects to today's topic, writing, and reading>"
    },
    {
      "title": "<MUST exactly match: ${grammarPlan[1].title}>",
      "focus": "${grammarPlan[1].focus}",
      "level": "${grammarPlan[1].level}",
      "mustTeach": ["<point from mustTeach list>", "..."],
      "explanationPersian": "<4–5 sentences in Persian — pedagogically detailed, covering formation, use, and what distinguishes this grammar>",
      "pattern": "<grammatical pattern formula>",
      "formation": "<step-by-step formation: how the form is built>",
      "use": "<when and why this form is used — contexts and registers>",
      "examples": ["<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>"],
      "commonMistake": "<typical Persian-speaker error with incorrect form, correct form, and explanation>",
      "pdUpgradeExample": { "simple": "<basic B1 sentence>", "upgraded": "<PD3-quality version>" },
      "whyBetterForPD3": "<one Danish sentence explaining why the upgraded version is better>",
      "appliedExample": "<one sentence applying this grammar to today's writing task topic>",
      "grammarAwarePracticeIdea": "<a short reading question or exercise idea that tests this grammar>",
      "integrationNotes": "<how this grammar connects to today's topic, writing, and reading>"
    }
  ],
  "vocabulary": [
    { "danish": "...", "english": "...", "persian": "...", "example": "<full Danish sentence using this word>", "category": "word|phrase|collocation|connector" }
  ],
  "reading": {
    "title": "...",
    "text": "<${readingWords} words of authentic Danish text on the topic>",
    "questions": [
      { "question": "...", "type": "short_answer|multiple_choice|matching|cloze|inference", "answer": "..." }
    ]
  },
  "writingTask": "<full structured writing instruction requiring use of ${grammarPlan[0].title} and ${grammarPlan[1].title}>",
  "examStrategy": "<PD3 Tip of the Day in Persian — 60–90 words — exactly 3 labeled sections: نکته عملی / مثال کوتاه / تکنیک آزمون>",
  "readingExamPractice": {
    "title": "<Danish title, e.g. 'PD3 Læseforståelse — Eksamensøvelse'>",
    "questions": [
      {
        "type": "short_answer|multiple_choice|vocabulary_in_context|matching_heading|matching_person_opinion|cloze|gapped_text|inference|writer_purpose|main_argument|counterargument|open_analytical_answer",
        "instruction": "<task instruction for the student>",
        "question": "<question or statement text — omit for matching types>",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "items": [{ "id": "1", "left": "...", "right": "..." }],
        "textWithBlanks": "<sentence or paragraph with ___ markers — cloze only>",
        "gappedParagraph": "<paragraph with [___] marker — gapped_text only>",
        "missingSentenceOptions": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "correctAnswer": "<the correct answer>",
        "explanationPersian": "<explanation in Persian: why this answer is correct, minimum 2 sentences>"
      }
    ]
  },
  "suggestedFlashcards": [
    { "front": "...", "back": "...", "type": "vocabulary|sentence|grammar|phrase" }
  ]
}

━━━ SELF-CHECK before returning — verify ALL of the following. Fix any failures before returning: ━━━
- readingExamPractice has EXACTLY ${questionCount} questions (Day ${dayNumber} requirement)
- No question anywhere has type "true_false" or "true/false" — this is absolutely forbidden
- Question type diversity meets the Day ${dayNumber} requirements: ${requiredTypeMix}
- All question types used are from the allowed list: ${allowedTypes}
- reading.text is at least ${readingWords.split(" ")[0]} words, fully written, no placeholders
- grammarPoints has EXACTLY 2 items
- grammarPoints[0].title exactly matches: "${grammarPlan[0].title}"
- grammarPoints[1].title exactly matches: "${grammarPlan[1].title}"
- Every grammarPoint has ALL required fields: title, focus, level, mustTeach, explanationPersian, pattern, formation, use, examples, commonMistake, pdUpgradeExample, whyBetterForPD3, appliedExample, grammarAwarePracticeIdea, integrationNotes
- examStrategy has exactly 3 Persian sections: نکته عملی, مثال کوتاه, تکنیک آزمون — and is 60–90 words
- conversation has at least ${convLines.split(" ")[0]} turns
- keySentences has at least 15 items
- vocabulary has at least 15 items, with at least 6 phrases/collocations/connectors
- reading.questions has at least 8 items
- suggestedFlashcards has at least 20 items
- writingTask field contains the full structured instruction including both grammarPlan item titles
- matching_heading and matching_person_opinion questions have an "items" array, NOT a "question" string
- cloze questions have "textWithBlanks" (not "gappedParagraph")
- gapped_text questions have "gappedParagraph" and "missingSentenceOptions" (exactly 4 options)
- multiple_choice and vocabulary_in_context questions have an "options" array with exactly 4 items
- at least 5 keySentences use the sentence patterns
- at least 3 suggestedFlashcards cover target connectors
If any check fails, fix it before returning.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 16000,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty response from OpenAI" }, { status: 500 });
    }

    const lesson = JSON.parse(raw) as Record<string, unknown>;

    const validationError = validateGeneratedLesson(
      lesson,
      grammarPlan[0].title,
      grammarPlan[1].title
    );
    if (validationError) {
      return NextResponse.json(
        { error: `Generated lesson failed validation: ${validationError}` },
        { status: 500 }
      );
    }

    return NextResponse.json(lesson);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
