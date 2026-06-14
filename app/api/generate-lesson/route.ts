import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { curriculum } from "@/app/data/curriculum";

export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LESSON_GENERATION_MODEL = process.env.LESSON_GENERATION_MODEL || "gpt-5.4";

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

function getMinReadingWords(day: number): number {
  if (day <= 30) return 200;
  if (day <= 60) return 400;
  if (day <= 75) return 600;
  return 800;
}

// ── Word-only flashcard filter ────────────────────────────────────────────────

// Common Danish function words that are not useful as standalone vocabulary flashcards.
const FLASHCARD_FUNCTION_WORDS = new Set<string>([
  "og", "men", "så", "jeg", "du", "vi", "er", "har", "om", "i", "på",
  "den", "det", "de", "en", "et", "at", "til", "af", "fra", "med",
]);

// Returns [validCards, firstRejectionReason | null].
// Only single-word vocabulary cards (type "word" or "vocabulary") are accepted.
// Lesson is rejected if fewer than 12 valid word cards remain after filtering.
function filterWordOnlyFlashcards(flashcards: unknown[]): [unknown[], string | null] {
  const valid: unknown[] = [];
  let firstRejection: string | null = null;

  for (let i = 0; i < flashcards.length; i++) {
    const card     = flashcards[i] as Record<string, unknown>;
    const front    = typeof card.front === "string" ? card.front.trim() : "";
    const back     = typeof card.back  === "string" ? card.back.trim()  : "";
    const cardType = typeof card.type  === "string" ? card.type.trim().toLowerCase() : "";

    let reason: string | null = null;

    if (!front) {
      reason = "front is empty";
    } else if (!back) {
      reason = "back is empty";
    } else if (cardType !== "word" && cardType !== "vocabulary") {
      reason = `type "${cardType}" is not allowed — only type "word" is accepted for suggested flashcards`;
    } else if (front.includes(" ")) {
      reason = "front contains spaces — must be a single word, not a phrase or sentence";
    } else if (/[.,?!;:→/]|\.{2,}/.test(front)) {
      reason = "front contains punctuation suggesting a phrase or sentence";
    } else if (front.includes("-")) {
      reason = "front contains a hyphen — use compound words written as one word (e.g. morgenmad)";
    } else {
      const frontLower = front.toLowerCase();
      if (FLASHCARD_FUNCTION_WORDS.has(frontLower)) {
        reason = `"${front}" is a common function word — not useful as a standalone vocabulary card`;
      } else if (/nutid|v2|word order|present tense|correct the mistake|ret fejlen/i.test(frontLower)) {
        reason = `"${front}" looks like a grammar title or correction exercise`;
      }
    }

    if (reason !== null) {
      if (!firstRejection) {
        firstRejection = `[${i}] (type "${cardType}"): ${reason} — front: "${front.slice(0, 80)}"`;
      }
    } else {
      // Normalize "vocabulary" → "word" so the final lesson only contains type "word".
      valid.push(cardType === "vocabulary" ? { ...card, type: "word" } : card);
    }
  }

  return [valid, firstRejection];
}

// ── Grammar-aware question keyword check ─────────────────────────────────────

// Words that appear in genuine grammar task questions, not ordinary comprehension.
// At least one of these must appear in the question text for any question whose
// grammarFocus is set to a grammar plan title (not "none").
const GRAMMAR_TASK_KEYWORDS = [
  "nutid", "datid", "ordstilling", "v2", "verber", "verbet", "verbum",
  "inversion", "tempus", "omskriv", "identificer", "grammatisk",
  "ret fejlen", "ret sætningen", "subjekt", "sætningsskema",
];

function hasGrammarTaskKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return GRAMMAR_TASK_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Post-generation validation ────────────────────────────────────────────────

function validateGeneratedLesson(
  lesson: Record<string, unknown>,
  gp0Title: string,
  gp1Title: string,
  minReadingWords: number
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

    const examplesArr = gpt.examples as unknown[] | undefined;
    if (!Array.isArray(examplesArr) || examplesArr.length < 4) {
      return `grammarPoints[${i}].examples must have at least 4 items (got ${Array.isArray(examplesArr) ? examplesArr.length : 0})`;
    }

    const upgrade = gpt.pdUpgradeExample as Record<string, unknown> | undefined;
    if (!upgrade || !upgrade.simple || !upgrade.upgraded) {
      return `grammarPoints[${i}].pdUpgradeExample is missing or incomplete`;
    }
  }

  // Conversation grammar alignment — only enforced when both grammar items are present-focused.
  const isPresentFocused =
    [gp0Title, gp1Title].some((t) => /nutid|present tense/i.test(t)) &&
    ![gp0Title, gp1Title].some((t) => /datid|past tense|perfect|førnutid/i.test(t));

  if (isPresentFocused) {
    const convArr = Array.isArray(lesson.conversation)
      ? (lesson.conversation as Record<string, unknown>[])
      : [];
    const convDanish = convArr
      .map((t) => (typeof t.danish === "string" ? t.danish.toLowerCase() : ""))
      .join(" ");

    if (!convDanish.trim()) {
      return "conversation is missing or empty";
    }

    // Count strong past/perfect markers — allow at most 2.
    const PAST_MARKERS = [
      "har været", "startede", "lavede", "arbejdede", "gik",
      "var", "havde", "tog", "spiste", "drak", "læste", "gjorde", "kom", "begyndte",
    ];
    let pastCount = 0;
    for (const marker of PAST_MARKERS) {
      let pos = 0;
      while ((pos = convDanish.indexOf(marker, pos)) !== -1) {
        pastCount++;
        pos += marker.length;
      }
    }
    if (pastCount > 2) {
      return `conversation overuses past/perfect tense for a present-focused lesson (found ${pastCount} past/perfect markers; maximum 2 allowed)`;
    }

    // Require at least 5 present-tense routine verb occurrences.
    const PRESENT_VERBS = [
      "arbejder", "drikker", "læser", "laver", "går", "står", "spiser",
      "tager", "ser", "slapper", "plejer", "sover", "vågner", "starter",
      "kommer", "bruger", "cykler", "løber", "er", "har",
    ];
    let presentCount = 0;
    for (const verb of PRESENT_VERBS) {
      let pos = 0;
      while ((pos = convDanish.indexOf(verb, pos)) !== -1) {
        presentCount++;
        pos += verb.length;
      }
    }
    if (presentCount < 5) {
      return `conversation lacks enough present-tense routine examples (found ${presentCount}; need at least 5)`;
    }

    // Require at least 2 V2/fronted-time patterns: [time phrase] + [verb ending in r].
    const v2Re = /(om morgenen|om aftenen|om natten|om middagen|om formiddagen|om eftermiddagen|i weekenden|i morges|i aftes|derefter|først)\s+[a-zA-ZæøåÆØÅ]{2,}r/g;
    const v2Matches = convDanish.match(v2Re) ?? [];
    if (v2Matches.length < 2) {
      return `conversation lacks V2/fronted-time examples (found ${v2Matches.length}; need at least 2)`;
    }
  }

  const reading = lesson.reading as Record<string, unknown> | undefined;
  if (!reading) return "reading is missing";

  const readingText = reading.text;
  if (typeof readingText !== "string" || readingText.trim() === "") {
    return "reading.text is missing or empty";
  }
  const wordCount = readingText.trim().split(/\s+/).length;
  if (wordCount < minReadingWords) {
    return `reading.text must have at least ${minReadingWords} words (got ${wordCount})`;
  }

  const readingQuestions = reading.questions;
  const qCount = Array.isArray(readingQuestions) ? readingQuestions.length : 0;
  if (qCount !== 8) {
    return `reading.questions must have exactly 8 items (got ${qCount})`;
  }

  const questions = Array.isArray(readingQuestions) ? (readingQuestions as unknown[]) : [];

  // Per-item quality checks: reject empty, too-short, placeholder, or answer-less questions.
  for (let i = 0; i < questions.length; i++) {
    const item = questions[i] as Record<string, unknown>;
    const qText = typeof item.question === "string" ? item.question.trim() : "";
    if (!qText) {
      return `reading.questions[${i}].question is empty`;
    }
    if (qText.length < 8) {
      return `reading.questions[${i}].question is too short (${qText.length} chars): "${qText}"`;
    }
    if (/^(question\s*\d*|spørgsmål\s*\d*|\.{2,}|-+|n\/a)$/i.test(qText)) {
      return `reading.questions[${i}].question is placeholder text: "${qText}"`;
    }
    const ans = typeof item.answer === "string" ? item.answer.trim() : "";
    if (ans.length < 2) {
      return `reading.questions[${i}].answer is missing or too short`;
    }

    // All question types: any quoted Danish term must appear verbatim in reading.text.
    // Exception: grammar correction questions may intentionally quote incorrect/altered forms.
    const isGrammarCorrection = hasGrammarTaskKeyword(qText);

    if (!isGrammarCorrection) {
      const readingNorm = (readingText as string).toLowerCase();
      const quoted = [
        ...[...qText.matchAll(/'([^']+)'/g)].map((m) => m[1]),
        ...[...qText.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
        ...[...qText.matchAll(/[»›]([^«‹]+)[«‹]/g)].map((m) => m[1]),
      ];
      for (const term of quoted) {
        if (term.length > 1 && !readingNorm.includes(term.toLowerCase())) {
          return `reading.questions[${i}] references quoted term not found in reading.text: "${term}"`;
        }
      }
    }
  }
  const hasGP0Focus = questions.some(q => {
    const item = q as Record<string, unknown>;
    const focus = item.grammarFocus;
    return typeof focus === "string" && focus === gp0Title;
  });
  const hasGP1Focus = questions.some(q => {
    const item = q as Record<string, unknown>;
    const focus = item.grammarFocus;
    return typeof focus === "string" && focus === gp1Title;
  });
  if (!hasGP0Focus) {
    return `reading.questions must include at least one question with grammarFocus exactly matching "${gp0Title}"`;
  }
  if (!hasGP1Focus) {
    return `reading.questions must include at least one question with grammarFocus exactly matching "${gp1Title}"`;
  }

  // Grammar-aware text check: grammarFocus metadata alone is not enough.
  // The question text itself must contain a real grammar task keyword.
  const gp0GrammarQuestion = questions.find((q) => {
    const item = q as Record<string, unknown>;
    if (typeof item.grammarFocus !== "string" || item.grammarFocus !== gp0Title) return false;
    const text = typeof item.question === "string" ? item.question : "";
    return hasGrammarTaskKeyword(text);
  });
  if (!gp0GrammarQuestion) {
    return `reading.questions has a grammarFocus for "${gp0Title}" but no real grammar task — question text must contain a grammar task word (nutid, verber, ordstilling, omskriv, ret fejlen, identificer, V2, inversion, etc.)`;
  }

  const gp1GrammarQuestion = questions.find((q) => {
    const item = q as Record<string, unknown>;
    if (typeof item.grammarFocus !== "string" || item.grammarFocus !== gp1Title) return false;
    const text = typeof item.question === "string" ? item.question : "";
    return hasGrammarTaskKeyword(text);
  });
  if (!gp1GrammarQuestion) {
    return `reading.questions has a grammarFocus for "${gp1Title}" but no real grammar task — question text must contain a grammar task word (nutid, verber, ordstilling, omskriv, ret fejlen, identificer, V2, inversion, etc.)`;
  }

  // Word-only flashcard guard — only single-word vocabulary cards are accepted.
  // Rejects if fewer than 12 valid word cards remain after filtering.
  const flashcards = lesson.suggestedFlashcards;
  if (!Array.isArray(flashcards) || flashcards.length < 5) {
    return `suggestedFlashcards must have at least 5 items before filtering (got ${Array.isArray(flashcards) ? flashcards.length : 0})`;
  }
  const [validFlashcards, firstFlashcardRejection] = filterWordOnlyFlashcards(flashcards as unknown[]);
  if (validFlashcards.length < 12) {
    return `suggestedFlashcards: too few valid word-only cards after filtering (${validFlashcards.length} valid; need 12). First rejection: ${firstFlashcardRejection ?? "none"}`;
  }
  // Cap at 18; all remaining cards are already normalized to type "word".
  lesson.suggestedFlashcards = validFlashcards.slice(0, 18);

  const serialized = JSON.stringify(lesson).toLowerCase();
  const forbidden = ["[incomplete]", "[continue here]", "[continue]", "[additional text]", "[additional "];
  for (const phrase of forbidden) {
    if (serialized.includes(phrase)) {
      return `Forbidden placeholder text found: "${phrase}"`;
    }
  }

  return null;
}

// ── Known-typo normalizer ────────────────────────────────────────────────────

// Applied once after JSON parse, before validation.
// Only fixes exact, known bad strings; never touches validated content rules.
const TYPO_FIXES: [RegExp, string][] = [
  [/\bIncorrent\b/g, "Incorrect"],
  [/\bincorrent\b/g, "incorrect"],
];

function fixKnownTypos(lesson: Record<string, unknown>): Record<string, unknown> {
  let s = JSON.stringify(lesson);
  for (const [pattern, replacement] of TYPO_FIXES) {
    s = s.replace(pattern, replacement);
  }
  return JSON.parse(s) as Record<string, unknown>;
}

// ── Reading text repair ───────────────────────────────────────────────────────

// Called only when validateGeneratedLesson returns a reading-too-short error.
// Sends a small focused prompt to expand only reading.text; touches nothing else.
async function repairReadingTextIfTooShort(
  lesson: Record<string, unknown>,
  topic: string,
  level: string,
  phase: number,
  gp0Title: string,
  gp1Title: string,
  minReadingWords: number
): Promise<string | null> {
  const reading = lesson.reading as Record<string, unknown> | undefined;
  if (!reading) return null;

  const currentText = typeof reading.text === "string" ? reading.text : "";
  const currentTitle = typeof reading.title === "string" ? reading.title : topic;
  const currentWordCount = currentText.trim().split(/\s+/).length;

  console.log(`[reading-repair] triggered — current: ${currentWordCount} words, need: ${minReadingWords}`);

  const targetMin = minReadingWords + 20;
  const targetMax = minReadingWords + 60;

  const repairPrompt = `You are a Danish language teacher. The reading text below is too short and must be expanded.

Current reading title: ${currentTitle}
Lesson topic: ${topic}
Level: ${level}
Phase: ${phase} of 3
Grammar items to embed naturally: "${gp0Title}" and "${gp1Title}"

Current text (${currentWordCount} words — too short, need at least ${minReadingWords}):
${currentText}

Task: Expand the text to ${targetMin}–${targetMax} words.
Rules:
- Preserve the same topic, meaning, and Danish language level
- Add natural extra details — do not repeat existing sentences
- Naturally embed examples of both grammar items: "${gp0Title}" and "${gp1Title}"
- Write only Danish inside the text field
- Do NOT create questions
- Do NOT change the title
- Do NOT use placeholders ([continue here], [additional text], etc.)
- Do NOT add English words to the Danish text
- Output ONLY this JSON: { "text": "<full expanded Danish text — minimum ${minReadingWords} words>" }`;

  try {
    const completion = await openai.chat.completions.create({
      model: LESSON_GENERATION_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: repairPrompt }],
      max_completion_tokens: 2000,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const repairedText = typeof parsed.text === "string" ? parsed.text.trim() : null;
    if (!repairedText) return null;

    const newWordCount = repairedText.split(/\s+/).length;
    console.log(`[reading-repair] repaired: ${newWordCount} words`);

    if (newWordCount < minReadingWords) {
      console.log(`[reading-repair] still too short (${newWordCount} words) — rejecting`);
      return null;
    }
    return repairedText;
  } catch {
    return null;
  }
}

// ── Reading questions repair ──────────────────────────────────────────────────

// Called only when validateGeneratedLesson returns a reading.questions error.
// Generates exactly 8 fresh questions; touches nothing else in the lesson.
async function repairReadingQuestionsIfInvalid(
  lesson: Record<string, unknown>,
  topic: string,
  level: string,
  phase: number,
  gp0Title: string,
  gp1Title: string
): Promise<unknown[] | null> {
  const reading = lesson.reading as Record<string, unknown> | undefined;
  if (!reading) return null;

  const readingText = typeof reading.text === "string" ? reading.text : "";
  const readingTitle = typeof reading.title === "string" ? reading.title : topic;

  console.log(`[questions-repair] triggered — regenerating reading.questions`);

  const repairPrompt = `You are a Danish language teacher. Generate exactly 8 reading questions for the text below.

Reading title: ${readingTitle}
Reading text:
${readingText}

Lesson topic: ${topic}
Level: ${level}
Phase: ${phase} of 3
Grammar item 1: "${gp0Title}"
Grammar item 2: "${gp1Title}"

Required 8 questions in this order:
1. Comprehension — main content of the text (grammarFocus: "none")
2. Comprehension — specific detail from the text (grammarFocus: "none")
3. Vocabulary — ask about the meaning or use of a word or phrase from the text (grammarFocus: "none")
4. Sequencing — ask about the order of events or structure (grammarFocus: "none")
5. Grammar-aware — MUST test "${gp0Title}" — question text MUST contain at least one of: nutid, verber, verbet, ordstilling, V2, omskriv, ret, identificer, inversion, grammatisk (grammarFocus: "${gp0Title}")
   Good example: "Find tre verber i nutid i teksten." or "Hvilke verber i teksten står i nutid?"
6. Grammar-aware — MUST test "${gp1Title}" — question text MUST contain at least one of: nutid, verber, verbet, ordstilling, V2, omskriv, ret, identificer, inversion, grammatisk (grammarFocus: "${gp1Title}")
   Good example: "Omskriv sætningen med korrekt V2-ordstilling: Om morgenen jeg drikker kaffe." or "Forklar hvorfor verbet kommer før subjektet i sætningen: Om morgenen drikker jeg kaffe."
7. Inference — what can we conclude or infer from the text? (grammarFocus: "none")
8. Reflection — what is the main message or lesson of the text? (grammarFocus: "none")

Hard rules:
- Every "question" field must be at least 8 characters and non-empty
- Every "answer" field must be non-empty and a complete sentence
- "grammarFocus" must be exactly "${gp0Title}", "${gp1Title}", or "none"
- Questions 5 and 6 MUST have grammar task words in their question text — not ordinary comprehension
- For question 3 (vocabulary): if you quote a word or phrase, it MUST appear verbatim in the reading text above — do NOT inflect or alter the quoted form. Good: 'falde til ro' if the text has "falde til ro". Bad: 'faldt' if the text only has "falde".
- ANY quoted word or phrase in ANY question must appear verbatim in the reading text above — this applies to all 8 questions, not just vocabulary questions
- Use natural, clear Danish phrasing. Prefer "Hvilke verber i nutid kan du finde i teksten?" over awkward constructs like "Hvilket verb identificerer handlinger i teksten..."
- Do NOT output empty questions or placeholder text
- Output ONLY this JSON: { "questions": [ { "question": "...", "type": "short_answer", "answer": "...", "grammarFocus": "..." }, ... ] }`;

  try {
    const completion = await openai.chat.completions.create({
      model: LESSON_GENERATION_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: repairPrompt }],
      max_completion_tokens: 2000,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(parsed.questions) || parsed.questions.length !== 8) return null;

    console.log(`[questions-repair] repaired: ${parsed.questions.length} questions`);
    return parsed.questions as unknown[];
  } catch {
    return null;
  }
}

// ── Suggested flashcards repair ──────────────────────────────────────────────

// Called only when validateGeneratedLesson returns a suggestedFlashcards error.
// Generates 12–18 fresh single-word vocabulary cards; touches nothing else.
async function repairSuggestedFlashcardsAsWordsOnly(
  lesson: Record<string, unknown>,
  topic: string,
  level: string
): Promise<unknown[] | null> {
  console.log(`[flashcards-repair] triggered — regenerating word-only flashcards`);

  // Extract vocabulary words from the lesson as context for the repair.
  const vocab = Array.isArray(lesson.vocabulary)
    ? (lesson.vocabulary as Record<string, unknown>[])
        .map((v) => (typeof v.danish === "string" ? v.danish : ""))
        .filter(Boolean)
        .join(", ")
    : "";

  const repairPrompt = `You are a Danish language teacher. Generate 12–18 single-word vocabulary flashcards from this lesson.

Lesson topic: ${topic}
Level: ${level}
Lesson vocabulary words (for context): ${vocab || "see lesson content"}

Rules — every card MUST follow ALL of these:
- "front" must be exactly ONE Danish word — no spaces, no hyphens, no phrases
- "type" must be "word" for every card
- "back" must include English meaning + optionally one short correct Danish example sentence
- Danish compound words written as one word are allowed: morgenmad, sengetid, hverdag, mulighed, etc.
- Do NOT generate: sentences, phrases, collocations, connectors (og, men, så), grammar titles, correction exercises
- Do NOT generate common function words: og, men, så, jeg, du, vi, er, har, om, i, på, den, det, de, en, et
- Prefer genuinely new or difficult vocabulary words from the lesson topic
- Prefer base/lemma forms

Output ONLY this JSON:
{ "suggestedFlashcards": [
  { "front": "<one Danish word>", "back": "<English meaning + optional short example>", "type": "word" }
] }`;

  try {
    const completion = await openai.chat.completions.create({
      model: LESSON_GENERATION_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: repairPrompt }],
      max_completion_tokens: 1500,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(parsed.suggestedFlashcards) || parsed.suggestedFlashcards.length < 12) return null;

    console.log(`[flashcards-repair] repaired: ${parsed.suggestedFlashcards.length} word cards`);
    return parsed.suggestedFlashcards as unknown[];
  } catch {
    return null;
  }
}

// ── Conversation repair ───────────────────────────────────────────────────────

// Called only when validateGeneratedLesson returns a conversation alignment error.
// Regenerates only the conversation array; preserves { speaker, danish, english, persian } shape.
async function repairConversationIfMisaligned(
  topic: string,
  level: string,
  phase: number,
  gp0Title: string,
  gp1Title: string
): Promise<unknown[] | null> {
  const minTurns = phase <= 1 ? 15 : phase <= 2 ? 25 : 30;
  const convLinesStr = phase <= 1 ? "15 to 20" : phase <= 2 ? "25 to 30" : "30 to 40";

  console.log(`[conversation-repair] triggered — regenerating conversation (min ${minTurns} turns)`);

  const repairPrompt = `You are a Danish language teacher. Generate a natural A2+/B1 Danish conversation about daily routines.

Lesson topic: ${topic}
Level: ${level}
Phase: ${phase} of 3
Grammar item 1: "${gp0Title}"
Grammar item 2: "${gp1Title}"

Required:
- Exactly ${convLinesStr} speaker turns alternating between Speaker A and Speaker B
- Focus on PRESENT TENSE daily routines — what people DO regularly, not what they did in the past
- Include at least 8–10 present-tense verbs such as: arbejder, drikker, læser, laver, går, står op, spiser, tager, ser, slapper af, plejer, vågner, starter, sover
- Include at least 3 V2/fronted-time expressions where the verb comes before the subject:
  • Om morgenen drikker jeg kaffe.
  • Om aftenen læser jeg en bog.
  • Først arbejder jeg, og så går jeg en tur.
  • I weekenden besøger jeg min familie.
  • Derefter spiser jeg morgenmad.
- Use PRESENT TENSE (nutid) as the dominant tense — NOT past tense (datid) or perfect
- Avoid these past-tense forms — at most 1 total: har været, startede, lavede, arbejdede, gik, var, havde, tog, spiste, drak, læste, gjorde, kom, begyndte
- Keep it natural and realistic — two people talking about their daily lives
- Include English (english) translation for every turn. Set the persian field to "".

Output ONLY this JSON:
{
  "conversation": [
    { "speaker": "A", "danish": "...", "english": "...", "persian": "" },
    { "speaker": "B", "danish": "...", "english": "...", "persian": "" }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: LESSON_GENERATION_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: repairPrompt }],
      max_completion_tokens: 3000,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(parsed.conversation) || parsed.conversation.length < minTurns) return null;

    console.log(`[conversation-repair] repaired: ${parsed.conversation.length} turns`);
    return parsed.conversation as unknown[];
  } catch {
    return null;
  }
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

  const minReadingWords = getMinReadingWords(dayNumber);

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

  const systemPrompt = `You are an expert Danish language teacher creating comprehensive, high-quality lessons for English-speaking students. The student is learning Danish from A2+/B1 toward B2 and the PD3 exam.

You must return a single valid JSON object with no markdown, no code fences, no extra text — only the JSON.

LANGUAGE RULES:
- "explanationPersian" fields: MUST be written entirely in English. Write at least 4–5 sentences of clear, pedagogically detailed grammatical explanation.
- "persian" fields: set to empty string "".
- "danish" fields: natural, authentic Danish at the specified level.
- "english" fields: accurate English translations.

CONTENT VOLUME — HARD REQUIREMENTS. Never go below these numbers. Count before finalizing:
- conversation: MINIMUM ${convLines} speaker turns. Count them. If fewer, add more.
- keySentences: MINIMUM 15 items. Target 18. Count them. If fewer than 15, add more before returning.
- grammarPoints: EXACTLY 2 items — no more, no fewer
- grammarPoints[].examples: MINIMUM 4 examples each
- vocabulary: MINIMUM 15 items. Target 20–25. At least 6 must be phrases, collocations, connectors, or fixed expressions — not single words. Count them. If fewer than 15, add more before returning.
- reading.text: MINIMUM ${minReadingWords} words. Target ${minReadingWords + 20}–${minReadingWords + 60} words to safely pass validation. ${minReadingWords - 1} words or fewer is INVALID — the lesson will be rejected. Count the words before returning. If under ${minReadingWords}, expand the text — do not summarize or write a short paragraph. NEVER truncate with placeholders.
- reading.questions: MINIMUM 8 items. Target 10. Count them. If fewer than 8, add more.
- suggestedFlashcards: 12–18 word-only vocabulary cards (type "word", single Danish words only). Count them. If fewer than 12, add more.
- readingExamPractice.questions: EXACTLY ${questionCount} questions. This is a hard requirement for Day ${dayNumber}. Count them. Add or remove questions to reach exactly ${questionCount}.
- examStrategy (PD3 Tip of the Day): 60–90 words in English. Must have exactly 3 labeled sections. Maximum 100 words.

QUALITY:
- Conversation must feel realistic, not like a scripted drill. The topic should arise naturally.
- Grammar explanations must be thorough and pedagogically clear with correct Danish terminology.
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
- The explanation must be in English (4–5 sentences, pedagogically detailed).
- Each grammar point MUST include ALL of the following fields:
  1. "title": the EXACT title from grammarPlan — do not alter, shorten, or rephrase
  2. "focus": the focus area from grammarPlan
  3. "level": the CEFR level from grammarPlan
  4. "mustTeach": array — cover every item listed in the grammarPlan mustTeach list
  5. "explanationPersian": English explanation — 4–5 sentences, covering formation, use, and what distinguishes this from similar forms
  6. "pattern": the grammatical pattern formula
  7. "formation": how the form is built step by step (e.g. verb stem + ending, auxiliary + past participle)
  8. "use": when and why this grammar form is used — contexts, registers, distinctions from similar structures
  9. "examples": at least 4 natural, complete Danish example sentences
  10. "commonMistake": a typical learner error, with the incorrect form, the correct form, and a brief explanation
  11. "pdUpgradeExample": { "simple": <basic B1 sentence>, "upgraded": <PD3-quality version using this grammar more sophisticatedly> }
  12. "whyBetterForPD3": one Danish sentence explaining why the upgraded version is better for PD3
  13. "appliedExample": one sentence applying this grammar to today's writing task topic
  14. "grammarAwarePracticeIdea": a short reading question or exercise idea that tests this grammar in context — something a learner can practise immediately
  15. "integrationNotes": how this grammar connects to today's lesson topic, writing task, and reading
- Grammar must connect to today's reading question types and writing format.

LESSON INTEGRATION — 50–70% of the lesson must reinforce the two grammarPlan items:
- CONVERSATION: Include at least 3 exchanges demonstrating ${grammarPlan[0].title} and at least 3 demonstrating ${grammarPlan[1].title}.
- READING TEXT: Embed several authentic examples of both grammarPlan items naturally in the reading text.
- READING QUESTIONS (reading.questions): At least one question must explicitly test ${grammarPlan[0].title} AND carry "grammarFocus": "${grammarPlan[0].title}". At least one question must explicitly test ${grammarPlan[1].title} AND carry "grammarFocus": "${grammarPlan[1].title}".
  CRITICAL — Grammar-aware questions (those with grammarFocus ≠ "none") MUST contain a real grammar task in the question text itself. The question text must include at least one of these grammar task words: nutid, datid, verber, verbet, ordstilling, V2, inversion, omskriv, identificer, grammatisk, ret fejlen, ret sætningen, subjekt, tempus.
  GOOD grammar-aware question examples (these PASS):
    - "Find tre verber i nutid i teksten." [grammarFocus: "${grammarPlan[0].title}"]
    - "Hvilke verber i teksten står i nutid?" [grammarFocus: "${grammarPlan[0].title}"]
    - "Ret sætningen til korrekt V2-ordstilling: Om morgenen jeg drikker kaffe." [grammarFocus: "${grammarPlan[1].title}"]
    - "Omskriv sætningen med korrekt ordstilling: Om aftenen jeg læser en bog." [grammarFocus: "${grammarPlan[1].title}"]
    - "Forklar hvorfor verbet kommer før subjektet i: Om morgenen drikker jeg kaffe. Hvad hedder denne grammatiske regel?" [grammarFocus: "${grammarPlan[1].title}"]
    - "Vælg den sætning, der har korrekt V2-ordstilling." [grammarFocus: "${grammarPlan[1].title}"]
    - "Identificer de sætninger i teksten, der har inversion (V2)." [grammarFocus: "${grammarPlan[1].title}"]
  BAD grammar-aware question examples (these FAIL — ordinary comprehension with grammar metadata):
    - "Hvilken tid står personen op?" [grammarFocus: "${grammarPlan[0].title}"] ← FORBIDDEN: no grammar task word
    - "Hvad gør personen først om morgenen?" [grammarFocus: "${grammarPlan[1].title}"] ← FORBIDDEN: no grammar task word
    - "Hvilken aktivitet følger efter arbejdet?" [grammarFocus: "${grammarPlan[1].title}"] ← FORBIDDEN: no grammar task word
  Every reading question MUST include a "grammarFocus" field set to exactly one of:
    - "${grammarPlan[0].title}" — if the question explicitly tests this grammar pattern
    - "${grammarPlan[1].title}" — if the question explicitly tests this grammar pattern
    - "none" — if it is a pure comprehension or vocabulary question
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
- READING TEXT LENGTH — HARD REQUIREMENT: reading.text must be at least ${minReadingWords} words. Target ${minReadingWords + 20}–${minReadingWords + 60} words to safely pass validation. ${minReadingWords - 1} words or fewer is INVALID — the lesson will be rejected and regenerated. Count approximately before returning. If under ${minReadingWords} words, expand the text. Do not summarize. Do not write a short paragraph. Never use placeholders.
- Do NOT output true/false questions anywhere in reading.questions. Allowed simple types: short_answer, multiple_choice, matching, cloze, inference.
- The reading text must naturally model both grammarPlan items multiple times.
- Do not choose a reading genre or tense that conflicts with the grammarPlan items. If a grammarPlan item covers present tense, the reading text must include many present-tense verbs and habitual or daily routine sentences. If a grammarPlan item covers V2 word order, the reading text must include several fronted time expressions with correct V2 inversion.
- Do not make the reading text predominantly past tense if present tense is a grammarPlan item for this day.

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

SUGGESTED FLASHCARDS — Must produce 12–18 word-only vocabulary cards:
- Every card front MUST be a single Danish word — no spaces, no phrases, no sentences.
- type MUST be "word" for every card — no other type is accepted.
- Danish compound words written as one word are allowed: morgenmad, familiebesøg, arbejdsdag, sengetid, hverdag, mulighed, afslapning, frokost, aftale, opgave, pause.
- Do NOT generate: full sentences, phrases, collocations, connectors, grammar titles, grammar correction cards, sentence patterns.
- Do NOT generate common function words: og, men, så, jeg, du, vi, er, har, om, i, på, den, det, de, en, et, at, til, af, fra, med.
- Prefer genuinely useful, new, or difficult words from the lesson vocabulary, reading text, and conversation.
- Prefer lemmas/base forms where relevant (e.g. "fleksibel" not "fleksibelt").
- The back must include: English meaning + optionally one short correct Danish example sentence.

GOOD examples (ALLOWED):
- { "front": "fleksibel", "back": "flexible — Han har en fleksibel arbejdsdag.", "type": "word" }
- { "front": "sædvanlig", "back": "usual, ordinary", "type": "word" }
- { "front": "sengetid", "back": "bedtime", "type": "word" }
- { "front": "mulighed", "back": "opportunity, possibility", "type": "word" }
- { "front": "afslapning", "back": "relaxation", "type": "word" }
- { "front": "frokost", "back": "lunch", "type": "word" }
- { "front": "morgenmad", "back": "breakfast", "type": "word" }

BAD examples (FORBIDDEN — will be rejected):
- { "front": "For at holde mig frisk, jeg løber hver morgen.", ... } — SENTENCE, FORBIDDEN
- { "front": "Først arbejder jeg, og så går jeg en tur.", ... } — SENTENCE, FORBIDDEN
- { "front": "gå en tur", ... } — PHRASE, FORBIDDEN
- { "front": "slappe af", ... } — PHRASE, FORBIDDEN
- { "front": "Nutid — present tense", ... } — GRAMMAR TITLE, FORBIDDEN
- { "front": "og", ... } — FUNCTION WORD, FORBIDDEN

PD3 TIP OF THE DAY — Must produce a dedicated examStrategy field:
- Write entirely in English.
- Target 60–90 words. Maximum 100 words.
- Must have EXACTLY THREE labeled sections in this order:
  Practical Tip: [one practical tip specific to today's question type or writing task — be specific to Day ${dayNumber}]
  Short Example: [one short Danish example sentence directly illustrating the tip]
  Exam Technique: [one PD3 exam technique relevant to today's text type: ${day.textType ?? "reading/writing task"}]
- No verbose general explanations. No repeating advice from other days. Be concise and specific.

READING EXAM PRACTICE — Must produce exactly ${questionCount} questions (hard requirement for Day ${dayNumber}):
- All questions must be based on the reading text in "reading.text".
- ALLOWED QUESTION TYPES for Day ${dayNumber}: ${allowedTypes}
- ${requiredTypeMix}
- true_false is FORBIDDEN. Never output a question with type "true_false" or "true/false".
- Every question must have: type, instruction, correctAnswer (never empty), and explanationPersian (in English, minimum 2 sentences explaining why the answer is correct).
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
    { "speaker": "A", "danish": "...", "english": "...", "persian": "" },
    { "speaker": "B", "danish": "...", "english": "...", "persian": "" }
  ],
  "keySentences": [
    { "danish": "...", "english": "...", "persian": "" }
  ],
  "grammarPoints": [
    {
      "title": "<MUST exactly match: ${grammarPlan[0].title}>",
      "focus": "${grammarPlan[0].focus}",
      "level": "${grammarPlan[0].level}",
      "mustTeach": ["<point from mustTeach list>", "..."],
      "explanationPersian": "<4–5 sentences in English — pedagogically detailed, covering formation, use, and what distinguishes this grammar>",
      "pattern": "<grammatical pattern formula>",
      "formation": "<step-by-step formation: how the form is built>",
      "use": "<when and why this form is used — contexts and registers>",
      "examples": ["<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>"],
      "commonMistake": "<typical learner error with incorrect form, correct form, and explanation>",
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
      "explanationPersian": "<4–5 sentences in English — pedagogically detailed, covering formation, use, and what distinguishes this grammar>",
      "pattern": "<grammatical pattern formula>",
      "formation": "<step-by-step formation: how the form is built>",
      "use": "<when and why this form is used — contexts and registers>",
      "examples": ["<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>", "<natural Danish sentence>"],
      "commonMistake": "<typical learner error with incorrect form, correct form, and explanation>",
      "pdUpgradeExample": { "simple": "<basic B1 sentence>", "upgraded": "<PD3-quality version>" },
      "whyBetterForPD3": "<one Danish sentence explaining why the upgraded version is better>",
      "appliedExample": "<one sentence applying this grammar to today's writing task topic>",
      "grammarAwarePracticeIdea": "<a short reading question or exercise idea that tests this grammar>",
      "integrationNotes": "<how this grammar connects to today's topic, writing, and reading>"
    }
  ],
  "vocabulary": [
    { "danish": "...", "english": "...", "persian": "", "example": "<full Danish sentence using this word>", "category": "word|phrase|collocation|connector" }
  ],
  "reading": {
    "title": "...",
    "text": "<${minReadingWords + 20}–${minReadingWords + 60} words of authentic Danish text — MINIMUM ${minReadingWords} words, expand if shorter>",
    "questions": [
      { "question": "...", "type": "short_answer|multiple_choice|matching|cloze|inference", "answer": "...", "grammarFocus": "<exact grammarPlan title | 'none'>" }
    ]
  },
  "writingTask": "<full structured writing instruction requiring use of ${grammarPlan[0].title} and ${grammarPlan[1].title}>",
  "examStrategy": "<PD3 Tip of the Day in English — 60–90 words — exactly 3 labeled sections: Practical Tip / Short Example / Exam Technique>",
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
        "explanationPersian": "<explanation in English: why this answer is correct, minimum 2 sentences>"
      }
    ]
  },
  "suggestedFlashcards": [
    { "front": "<single Danish word>", "back": "<English meaning + optionally one short Danish example>", "type": "word" }
  ]
}

━━━ SELF-CHECK before returning — verify ALL of the following. Fix any failures before returning: ━━━
- readingExamPractice has EXACTLY ${questionCount} questions (Day ${dayNumber} requirement)
- No question anywhere has type "true_false" or "true/false" — this is absolutely forbidden
- Question type diversity meets the Day ${dayNumber} requirements: ${requiredTypeMix}
- All question types used are from the allowed list: ${allowedTypes}
- reading.text is at least ${minReadingWords} words; target ${minReadingWords + 20}–${minReadingWords + 60} words — if under ${minReadingWords} words, expand it before returning; ${minReadingWords - 1} words or fewer is INVALID
- grammarPoints has EXACTLY 2 items
- grammarPoints[0].title exactly matches: "${grammarPlan[0].title}"
- grammarPoints[1].title exactly matches: "${grammarPlan[1].title}"
- Every grammarPoint has ALL required fields: title, focus, level, mustTeach, explanationPersian, pattern, formation, use, examples, commonMistake, pdUpgradeExample, whyBetterForPD3, appliedExample, grammarAwarePracticeIdea, integrationNotes
- examStrategy has exactly 3 English sections: Practical Tip, Short Example, Exam Technique — and is 60–90 words
- conversation has at least ${convLines.split(" ")[0]} turns
- keySentences has at least 15 items
- vocabulary has at least 15 items, with at least 6 phrases/collocations/connectors
- reading.questions has at least 8 items
- every reading.question has a "grammarFocus" field set to the exact grammarPlan title or "none"
- at least one reading.question has "grammarFocus" exactly matching "${grammarPlan[0].title}"
- at least one reading.question has "grammarFocus" exactly matching "${grammarPlan[1].title}"
- the grammar-focused question for "${grammarPlan[0].title}" has a question text containing a real grammar task word (nutid, verber, verbet, ordstilling, V2, inversion, omskriv, identificer, grammatisk, ret fejlen, ret sætningen, subjekt, tempus) — NOT just an ordinary comprehension question
- the grammar-focused question for "${grammarPlan[1].title}" has a question text containing a real grammar task word (nutid, verber, verbet, ordstilling, V2, inversion, omskriv, identificer, grammatisk, ret fejlen, ret sætningen, subjekt, tempus) — NOT just an ordinary comprehension question
- each grammarPoint.examples array has at least 4 items
- suggestedFlashcards has 12–18 word-only vocabulary cards, every card has type "word"
- writingTask field contains the full structured instruction including both grammarPlan item titles
- matching_heading and matching_person_opinion questions have an "items" array, NOT a "question" string
- cloze questions have "textWithBlanks" (not "gappedParagraph")
- gapped_text questions have "gappedParagraph" and "missingSentenceOptions" (exactly 4 options)
- multiple_choice and vocabulary_in_context questions have an "options" array with exactly 4 items
- at least 5 keySentences use the sentence patterns
- every suggestedFlashcard front is a SINGLE Danish word — no spaces, no hyphens, no punctuation
- no suggestedFlashcard front is a phrase, sentence, collocation, connector, or grammar title
- no suggestedFlashcard front is a common function word (og, men, så, jeg, du, vi, er, har, om, i, på)
- all flashcard backs are non-empty and include English meaning
If any check fails, fix it before returning.`;

  const MAX_ATTEMPTS = 2;
  let lastRaw: string | null = null;
  let lastValidationError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      if (attempt > 1 && lastRaw && lastValidationError) {
        messages.push({ role: "assistant", content: lastRaw });
        messages.push({
          role: "user",
          content: `VALIDATION FAILED (attempt ${attempt - 1}): "${lastValidationError}". Fix this exact issue and return the complete corrected JSON.`,
        });
      }

      const completion = await openai.chat.completions.create({
        model: LESSON_GENERATION_MODEL,
        response_format: { type: "json_object" },
        messages,
        max_completion_tokens: 16000,
      });

      const raw = completion.choices[0].message.content;
      if (!raw) {
        lastValidationError = "Empty response from OpenAI";
        lastRaw = null;
        if (attempt === MAX_ATTEMPTS) {
          return NextResponse.json({ error: lastValidationError }, { status: 500 });
        }
        continue;
      }

      lastRaw = raw;

      let lesson: Record<string, unknown>;
      try {
        lesson = fixKnownTypos(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        lastValidationError = "Invalid JSON from OpenAI";
        if (attempt === MAX_ATTEMPTS) {
          return NextResponse.json({ error: lastValidationError }, { status: 500 });
        }
        continue;
      }

      lastValidationError = validateGeneratedLesson(
        lesson,
        grammarPlan[0].title,
        grammarPlan[1].title,
        minReadingWords
      );

      if (lastValidationError) {
        // READING_TOO_SHORT — repair only reading.text, no full regeneration.
        if (/reading\.text must have at least \d+ words \(got \d+\)/.test(lastValidationError)) {
          const repairedText = await repairReadingTextIfTooShort(
            lesson,
            day.topic,
            day.level,
            day.phase,
            grammarPlan[0].title,
            grammarPlan[1].title,
            minReadingWords
          );
          if (repairedText) {
            (lesson.reading as Record<string, unknown>).text = repairedText;
            const repairError = validateGeneratedLesson(
              lesson,
              grammarPlan[0].title,
              grammarPlan[1].title,
              minReadingWords
            );
            // On success: clear the error and fall through to the normal success path below.
            // On failure: keep the updated error for the retry/error-return logic.
            lastValidationError = repairError;
          }
        }

        // READING_QUESTIONS_INVALID — repair only reading.questions, no full regeneration.
        if (lastValidationError && lastValidationError.includes("reading.questions")) {
          const repairedQuestions = await repairReadingQuestionsIfInvalid(
            lesson,
            day.topic,
            day.level,
            day.phase,
            grammarPlan[0].title,
            grammarPlan[1].title
          );
          if (repairedQuestions) {
            (lesson.reading as Record<string, unknown>).questions = repairedQuestions;
            const repairError = validateGeneratedLesson(
              lesson,
              grammarPlan[0].title,
              grammarPlan[1].title,
              minReadingWords
            );
            lastValidationError = repairError;
          }
        }

        // CONVERSATION_MISALIGNED — repair only conversation, no full regeneration.
        if (lastValidationError && lastValidationError.includes("conversation")) {
          const repairedConversation = await repairConversationIfMisaligned(
            day.topic,
            day.level,
            day.phase,
            grammarPlan[0].title,
            grammarPlan[1].title
          );
          if (repairedConversation) {
            lesson.conversation = repairedConversation;
            const repairError = validateGeneratedLesson(
              lesson,
              grammarPlan[0].title,
              grammarPlan[1].title,
              minReadingWords
            );
            lastValidationError = repairError;
          }
        }

        // SUGGESTED_FLASHCARDS — repair only flashcards, no full regeneration.
        if (lastValidationError && lastValidationError.includes("suggestedFlashcards")) {
          const repairedFlashcards = await repairSuggestedFlashcardsAsWordsOnly(
            lesson as Record<string, unknown>,
            day.topic,
            day.level
          );
          if (repairedFlashcards) {
            lesson.suggestedFlashcards = repairedFlashcards;
            const repairError = validateGeneratedLesson(
              lesson,
              grammarPlan[0].title,
              grammarPlan[1].title,
              minReadingWords
            );
            lastValidationError = repairError;
          }
        }

        // READING_TOO_SHORT (second pass) — final safety net after all other repairs.
        // Catches cases where the first pass failed, returned a still-short text, or
        // where a subsequent repair triggered re-validation that again flagged length.
        if (lastValidationError && /reading\.text must have at least \d+ words \(got \d+\)/.test(lastValidationError)) {
          const repairedText = await repairReadingTextIfTooShort(
            lesson,
            day.topic,
            day.level,
            day.phase,
            grammarPlan[0].title,
            grammarPlan[1].title,
            minReadingWords
          );
          if (repairedText) {
            (lesson.reading as Record<string, unknown>).text = repairedText;
            const repairError = validateGeneratedLesson(
              lesson,
              grammarPlan[0].title,
              grammarPlan[1].title,
              minReadingWords
            );
            lastValidationError = repairError;
          }
        }

        // READING_QUESTIONS (second pass) — routes any reading.questions errors that
        // surfaced from the second reading text repair re-validation above.
        if (lastValidationError && lastValidationError.includes("reading.questions")) {
          const repairedQuestions = await repairReadingQuestionsIfInvalid(
            lesson,
            day.topic,
            day.level,
            day.phase,
            grammarPlan[0].title,
            grammarPlan[1].title
          );
          if (repairedQuestions) {
            (lesson.reading as Record<string, unknown>).questions = repairedQuestions;
            const repairError = validateGeneratedLesson(
              lesson,
              grammarPlan[0].title,
              grammarPlan[1].title,
              minReadingWords
            );
            lastValidationError = repairError;
          }
        }

        if (lastValidationError) {
          if (attempt === MAX_ATTEMPTS) {
            return NextResponse.json(
              { error: `Generated lesson failed validation after ${MAX_ATTEMPTS} attempts: ${lastValidationError}` },
              { status: 500 }
            );
          }
          continue;
        }
      }

      return NextResponse.json(lesson);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      lastValidationError = message;
      if (attempt === MAX_ATTEMPTS) {
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: "Generation failed after all attempts" }, { status: 500 });
}
