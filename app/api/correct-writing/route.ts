import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  let text: string;
  try {
    const body = await request.json();
    text = (body.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const systemPrompt = `You are an expert Danish language teacher. Your student is a Persian speaker learning Danish from A2+/B1 toward B2.

You must return a single valid JSON object with no markdown, no code fences, no extra text — only the JSON.

LANGUAGE RULES:
- explanationPersian: MUST be written entirely in Persian (فارسی). Be specific about each error and the rule behind it. If the text is already correct, give positive feedback.
- correctedVersion: fix grammar, spelling, and word-order errors while keeping the student's exact meaning.
- naturalVersion: how a native Danish speaker would naturally express the same idea — you may rephrase more freely.
- suggestedFlashcards: 5 to 10 cards. Front is Danish (word, phrase, or corrected pattern). Back is English. Focus on corrections made and useful phrases from the natural version.`;

  const userPrompt = `The student wrote this Danish text:
"""
${text}
"""

Return this exact JSON structure:
{
  "correctedVersion": "<the corrected text — fix all errors, keep the student's meaning>",
  "naturalVersion": "<how a native speaker would naturally say the same thing>",
  "explanationPersian": "<2-3 paragraphs in Persian explaining every error found, the rule behind each correction, and why the natural version is more idiomatic. If no errors, confirm it and give encouragement.>",
  "suggestedFlashcards": [
    { "front": "...", "back": "...", "type": "sentence|vocabulary|grammar|phrase" }
  ]
}`;

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
