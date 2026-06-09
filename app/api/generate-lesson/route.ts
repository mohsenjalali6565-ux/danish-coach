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
- Flashcard fronts are Danish; backs are English (or the reverse for grammar cards where front is the grammar label).`;

  const userPrompt = `Generate a complete Danish lesson with this data:

Day: ${day.dayNumber}
Topic: ${day.topic}
Level: ${day.level}
Phase: ${day.phase} of 3
Communication Goal: ${day.communicationGoal}
Grammar Focus: ${day.grammarFocus.join(" / ")}
Writing Task: ${day.writingTask}

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
      { "question": "...", "type": "comprehension|inference|vocabulary|opinion", "answer": "..." }
    ]
  },
  "writingTask": "${day.writingTask}",
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
If any count is below the minimum, add more items before returning.`;

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
