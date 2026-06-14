import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  let text: string;
  let mode: "correct" | "translate";
  try {
    const body = await request.json();
    text = (body.text ?? "").trim();
    mode = body.mode === "translate" ? "translate" : "correct";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const sharedSchema = `Return this exact JSON structure:
{
  "correctedVersion": "...",
  "naturalVersion": "...",
  "explanationPersian": "...",
  "suggestedFlashcards": [
    { "front": "...", "back": "...", "type": "sentence|vocabulary|grammar|phrase" }
  ]
}`;

  let systemPrompt: string;
  let userPrompt: string;

  if (mode === "correct") {
    systemPrompt = `You are an expert Danish language teacher helping a student learn Danish from A2+/B1 toward B2.

You must return a single valid JSON object with no markdown, no code fences, no extra text — only the JSON.

LANGUAGE RULES:
- explanationPersian: MUST be written entirely in English. Be specific about each error and the rule behind it. If the text is already correct, give positive feedback.
- correctedVersion: fix grammar, spelling, and word-order errors while keeping the student's exact meaning.
- naturalVersion: how a native Danish speaker would naturally express the same idea — you may rephrase more freely.
- suggestedFlashcards: 5 to 10 cards. Front is Danish (word, phrase, or corrected pattern). Back is English. Focus on corrections made and useful phrases from the natural version.`;

    userPrompt = `The student wrote this Danish text:
"""
${text}
"""

${sharedSchema}`;
  } else {
    systemPrompt = `You are an expert Danish language teacher and translator helping a student learn Danish from A2+/B1 toward B2. The student has written their thoughts in English and wants them translated into Danish.

You must return a single valid JSON object with no markdown, no code fences, no extra text — only the JSON.

LANGUAGE RULES:
- correctedVersion: a correct, accurate Danish translation of the student's input. Preserve the meaning faithfully. Use B1/B2-level Danish appropriate for the student's level.
- naturalVersion: a more idiomatic, natural Danish version — how a native speaker would express the same idea. May use more sophisticated vocabulary, sentence structure, or connectors.
- explanationPersian: MUST be written entirely in English. Write 2–3 paragraphs covering:
  1. Key translation choices and why (e.g. word selection, register, structure)
  2. Important grammar points demonstrated in the translation (e.g. word order, verb forms, noun gender)
  3. What makes the natural version more idiomatic — specific phrases, connectors, or patterns the student should learn
- suggestedFlashcards: 5 to 10 cards. Front is Danish (a useful word, phrase, connector, or sentence pattern from the translation). Back is English. Prioritize full phrases and sentence patterns over isolated words.`;

    userPrompt = `The student wrote this text in English:
"""
${text}
"""

Translate it into Danish and provide the full explanation.

${sharedSchema}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 3000,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty response from OpenAI" }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
