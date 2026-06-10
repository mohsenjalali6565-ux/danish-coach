import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { curriculum } from "@/app/data/curriculum";

export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const convLines =
    day.phase === 1 ? "8 to 12" : day.phase === 2 ? "12 to 18" : "15 to 25";
  const readingWords =
    day.phase === 1 ? "120 to 150" : day.phase === 2 ? "250 to 300" : "400 to 500";

  // Build optional PD3 metadata blocks to inject into the prompt
  const vocabularyThemeBlock = day.vocabularyTheme
    ? `Vocabulary Theme: ${day.vocabularyTheme}`
    : "";

  const pd3SkillBlock = day.pd3Skill
    ? `Primary PD3 Skill: ${day.pd3Skill}`
    : "";

  const readingFocusBlock = day.readingFocus
    ? `Reading Focus: ${day.readingFocus}`
    : "";

  const writingFocusBlock = day.writingFocus
    ? `Writing Focus: ${day.writingFocus}`
    : "";

  const textTypeBlock = day.textType
    ? `Text Type: ${day.textType}`
    : "";

  const questionTypesBlock =
    day.questionTypes && day.questionTypes.length > 0
      ? `Required Question Types: ${day.questionTypes.join(", ")}`
      : "";

  const connectorsBlock =
    day.targetConnectors && day.targetConnectors.length > 0
      ? `Target Connectors: ${day.targetConnectors.join(", ")}`
      : "";

  const sentencePatternsBlock =
    day.sentencePatterns && day.sentencePatterns.length > 0
      ? `Sentence Patterns: ${day.sentencePatterns.join(" | ")}`
      : "";

  const writingFormatBlock = day.writingFormat
    ? `Writing Format: ${day.writingFormat}`
    : "";

  const phaseConversationGuidance =
    day.phase === 1
      ? "Phase 1: Write a practical, realistic everyday dialogue. Keep it natural and grounded in daily Danish life."
      : day.phase === 2
      ? "Phase 2: Write a structured B1/B1+ level dialogue that includes opinions, brief explanations, and more complex sentence structures."
      : "Phase 3: Write a PD3-style discussion with clear opinions, arguments, counter-arguments, nuance, and formal/semi-formal register. Each speaker should argue a point, not just exchange information.";

  const phaseReadingGuidance =
    day.phase === 1
      ? "Phase 1: Write a short, practical text — a diary entry, notice, ad, short email, or everyday message."
      : day.phase === 2
      ? "Phase 2: Write an adult, article-like text — a newspaper feature, blog post, or informational piece — with a clear structure (introduction, body, conclusion)."
      : "Phase 3: Write a PD3-style text matching the specified text type. This may be a formal debate article, opinion piece, complaint letter, advisory text, formal letter, or analytical essay. It must have a formal or semi-formal register, use complex connectors, and present a developed argument or position.";

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
- grammarPoints: MINIMUM 2, MAXIMUM 3 items
- grammarPoints[].examples: MINIMUM 4 examples each
- vocabulary: MINIMUM 15 items. Target 20. Count them. If fewer than 15, add more before returning.
- reading.text: MINIMUM ${readingWords} words. Count the words. If fewer, expand the text.
- reading.questions: MINIMUM 8 items. Target 10. Count them. If fewer than 8, add more.
- suggestedFlashcards: MINIMUM 20 items. Target 25. Count them. If fewer than 20, add more.

QUALITY:
- Conversation must feel realistic, not like a scripted drill. The topic should arise naturally.
- Grammar explanations in Persian must be thorough and pedagogically clear with correct Danish terminology.
- Vocabulary examples must be complete, natural sentences using the word in context.
- Reading text must be engaging and appropriate to the topic and level.
- Flashcard fronts are Danish; backs are English (or the reverse for grammar cards where front is the grammar label).

PD3 COMPLIANCE — MANDATORY. You must follow every PD3 metadata field listed in the user prompt. These are not suggestions. Ignoring any of them is an error.`;

  const userPrompt = `Generate a complete Danish lesson with this data:

Day: ${day.dayNumber}
Topic: ${day.topic}
Level: ${day.level}
Phase: ${day.phase} of 3
Communication Goal: ${day.communicationGoal}
Grammar Focus: ${day.grammarFocus.join(" / ")}
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

━━━ PD3 GENERATION RULES ━━━

CONVERSATION — ${phaseConversationGuidance}
- The conversation must demonstrate the target connectors (${day.targetConnectors?.join(", ") ?? "as appropriate"}) naturally within the dialogue.
- At least 3 turns must contain or reference the sentence patterns: ${day.sentencePatterns?.join(" | ") ?? "as appropriate"}.
- The communication goal must be fully achieved by the end of the conversation.

KEY SENTENCES — Must include:
- At least 5 sentences directly built from the sentence patterns: ${day.sentencePatterns?.join(" | ") ?? "as appropriate"}.
- At least 3 sentences that naturally use the target connectors: ${day.targetConnectors?.join(", ") ?? "as appropriate"}.
- Sentences must be reusable for real Danish communication AND for PD3 writing tasks.
- Variety: include statements, questions, and complex sentences.

GRAMMAR — Must:
- Explain the grammar focus (${day.grammarFocus.join(" / ")}) fully in Persian.
- Connect at least one grammar point to the sentence patterns or writing format for this day.
- Each grammar point must include a "commonMistake" field showing a typical Persian-speaker error and the correct form.

VOCABULARY — Must:
- Cover the vocabulary theme: ${day.vocabularyTheme ?? day.topic}.
- Include NOT only single words but also useful phrases, collocations, and multi-word expressions.
- Every vocabulary item must have a full, natural Danish sentence as its "example" field — not a fragment.
- Prioritize words and phrases the student will actually need for PD3 reading and writing tasks.

READING — ${phaseReadingGuidance}
- The text type must be: ${day.textType ?? "appropriate to the phase"}.
- The text must match the reading focus: ${day.readingFocus ?? "general comprehension"}.
- Reading questions must STRICTLY match the required question types: ${day.questionTypes?.join(", ") ?? "comprehension, inference, vocabulary"}.
  - "multiple choice": provide exactly 4 options labeled A, B, C, D and include the correct answer key.
  - "true/false": state the claim clearly; give a true/false answer with a brief justification in the "answer" field.
  - "short answer": require a full sentence answer based on the text.
  - "extended writing": ask the student to write 3–5 sentences in Danish (e.g., their opinion, a summary, a comparison).
  - "self-evaluation": ask the student to reflect on their own reading strategy or comprehension (answer field: suggested response).
  - Do NOT mix up question types. Generate each question according to its stated type.

WRITING TASK — Must include a clear, structured writing instruction:
- What to write: ${day.writingTask}
- Writing focus: ${day.writingFocus ?? "general writing practice"}
- Text format: ${day.writingFormat ?? "as appropriate to the phase"}
- Minimum length: ${day.phase === 1 ? "6–8 sentences" : day.phase === 2 ? "1–2 paragraphs (80–120 words)" : "2–3 paragraphs (150–200 words)"}
- Register/style: ${day.phase === 1 ? "informal, personal" : day.phase === 2 ? "semi-formal, clear" : "formal or semi-formal, structured argument"}
- Connectors to use: ${day.targetConnectors?.join(", ") ?? "as appropriate"}
- Sentence patterns to demonstrate: ${day.sentencePatterns?.join(" | ") ?? "as appropriate"}
- The "writingTask" field in the JSON output must contain this full structured instruction — not just the task title.

SUGGESTED FLASHCARDS — Must:
- Prioritize full sentences and phrases over isolated words.
- Include at least 5 flashcards built directly from the sentence patterns.
- Include at least 3 flashcards covering target connectors with example sentences.
- Include at least 5 vocabulary flashcards from the vocabulary theme.
- Include at least 3 grammar flashcards (front: grammar label; back: explanation + example).
- Remaining flashcards: key sentences from the lesson that are useful for PD3 writing.

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
      "title": "...",
      "explanationPersian": "<4-5 sentences in Persian explaining the grammar rule clearly>",
      "pattern": "...",
      "examples": ["...", "...", "...", "...", "..."],
      "commonMistake": "..."
    }
  ],
  "vocabulary": [
    { "danish": "...", "english": "...", "persian": "...", "example": "<full Danish sentence using this word>" }
  ],
  "reading": {
    "title": "...",
    "text": "<${readingWords} words of authentic Danish text on the topic>",
    "questions": [
      { "question": "...", "type": "comprehension|inference|vocabulary|opinion|multiple choice|true/false|short answer|extended writing|self-evaluation", "answer": "..." }
    ]
  },
  "writingTask": "<full structured writing instruction as described above>",
  "suggestedFlashcards": [
    { "front": "...", "back": "...", "type": "vocabulary|sentence|grammar|phrase" }
  ]
}

FINAL CHECK before returning — verify these counts in your output:
- conversation has at least ${convLines.split(" ")[0]} turns
- keySentences has at least 15 items
- vocabulary has at least 15 items
- reading.questions has at least 8 items
- suggestedFlashcards has at least 20 items
- reading questions match the required types: ${day.questionTypes?.join(", ") ?? "as specified"}
- writingTask field contains the full structured instruction
- at least 5 keySentences use the sentence patterns
- at least 3 suggestedFlashcards cover target connectors
If any count or requirement is not met, fix it before returning.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 12000,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty response from OpenAI" }, { status: 500 });
    }

    const lesson = JSON.parse(raw);
    return NextResponse.json(lesson);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
