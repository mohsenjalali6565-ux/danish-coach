"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { CurriculumDay } from "@/app/data/curriculum";
import type { Lesson, GrammarPoint, VocabularyItem, ReadingQuestion, WritingCorrection, Flashcard } from "@/app/types/lesson";
import FlashcardsSection from "@/app/components/FlashcardsSection";
import SpeakButton from "@/app/components/SpeakButton";

const PHASE_COLOR = {
  1: "bg-blue-600",
  2: "bg-violet-600",
  3: "bg-emerald-600",
} as const;

const SECTION = "mb-8";
const SECTION_TITLE =
  "mb-3 text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500";

export default function DayLesson({ day }: { day: CurriculumDay }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [checking, setChecking] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkFirestore() {
      try {
        const snap = await getDoc(doc(db, "lessons", String(day.dayNumber)));
        if (snap.exists()) {
          setLesson(snap.data() as Lesson);
        }
      } catch {
        // treat as not found
      } finally {
        setChecking(false);
      }
    }
    checkFirestore();
  }, [day.dayNumber]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber: day.dayNumber }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const generated: Lesson = await res.json();

      // Never overwrite — double-check before saving
      const existing = await getDoc(doc(db, "lessons", String(day.dayNumber)));
      if (!existing.exists()) {
        await setDoc(doc(db, "lessons", String(day.dayNumber)), generated);
      }

      setLesson(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  const phaseColor = PHASE_COLOR[day.phase as keyof typeof PHASE_COLOR];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-4 py-3 shadow-sm">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
        >
          ← Learning Path
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${phaseColor}`}
          >
            Day {day.dayNumber}
          </span>
          <span className="hidden sm:block text-xs text-zinc-400">{day.level}</span>
          <Link
            href="/flashcards"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
          >
            Flashcards
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Lesson meta */}
        <div className="mb-8">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">{day.level} · Phase {day.phase}</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{day.topic}</h1>
          {lesson && (
            <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400 italic">{lesson.title}</p>
          )}
        </div>

        {/* Loading */}
        {checking && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
            Checking for saved lesson…
          </div>
        )}

        {/* Generate button */}
        {!checking && !lesson && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              No lesson found for Day {day.dayNumber}.
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5">
              {day.communicationGoal}
            </p>
            {error && (
              <p className="text-xs text-red-500 mb-4">{error}</p>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity ${phaseColor} ${generating ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {generating ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                  Generating… (this may take 30–60 seconds)
                </>
              ) : (
                "Generate Lesson"
              )}
            </button>
          </div>
        )}

        {/* Lesson content */}
        {lesson && <LessonContent lesson={lesson} phase={day.phase} />}
      </div>
    </div>
  );
}

function LessonContent({ lesson, phase }: { lesson: Lesson; phase: number }) {
  return (
    <div>
      {/* Conversation */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Conversation</h2>
        <div className="space-y-3">
          {lesson.conversation.map((line, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 px-4 py-3"
            >
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  {line.speaker}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex-1">{line.danish}</p>
                    <SpeakButton text={line.danish} title="Listen to Danish" />
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{line.english}</p>
                  <p
                    className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5"
                    dir="rtl"
                    lang="fa"
                  >
                    {line.persian}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grammar */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Grammar Points</h2>
        <div className="space-y-4">
          {lesson.grammarPoints.map((gp, i) => (
            <GrammarCard key={i} gp={gp} />
          ))}
        </div>
      </section>

      {/* Key Sentences */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Key Sentences ({lesson.keySentences.length})</h2>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {lesson.keySentences.map((ks, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-start gap-1.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 flex-1">{ks.danish}</p>
                <SpeakButton text={ks.danish} title="Listen to Danish" />
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{ks.english}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5" dir="rtl" lang="fa">
                {ks.persian}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Vocabulary */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Vocabulary ({lesson.vocabulary.length} words)</h2>
        <div className="space-y-2">
          {lesson.vocabulary.map((v, i) => (
            <VocabCard key={i} item={v} />
          ))}
        </div>
      </section>

      {/* Reading */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Reading</h2>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 flex-1">{lesson.reading.title}</h3>
              <SpeakButton text={lesson.reading.text} title="Listen to reading text" />
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm leading-7 text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
              {lesson.reading.text}
            </p>
          </div>
          <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
            <p className={SECTION_TITLE}>Questions ({lesson.reading.questions.length})</p>
            <div className="space-y-4">
              {lesson.reading.questions.map((q, i) => (
                <ReadingQuestionCard key={i} q={q} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Writing Task */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Writing Task</h2>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 px-5 py-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{lesson.writingTask}</p>
        </div>
      </section>

      {/* Writing Practice */}
      <LessonWritingPractice lesson={lesson} phase={phase} />

      {/* Flashcards */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>
          Suggested Flashcards ({lesson.suggestedFlashcards.length})
        </h2>
        <FlashcardsSection
          dayNumber={lesson.day}
          cards={lesson.suggestedFlashcards}
        />
      </section>
    </div>
  );
}

function GrammarCard({ gp }: { gp: GrammarPoint }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 overflow-hidden">
      <div className="bg-zinc-50 dark:bg-zinc-800/60 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{gp.title}</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {/* Persian explanation */}
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1 uppercase tracking-wide">توضیح</p>
          <p
            className="text-sm leading-7 text-zinc-700 dark:text-zinc-300"
            dir="rtl"
            lang="fa"
          >
            {gp.explanationPersian}
          </p>
        </div>

        {/* Pattern */}
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1 uppercase tracking-wide">Pattern</p>
          <code className="block text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-zinc-800 dark:text-zinc-200 font-mono">
            {gp.pattern}
          </code>
        </div>

        {/* Examples */}
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1 uppercase tracking-wide">Examples</p>
          <ul className="space-y-1">
            {gp.examples.map((ex, i) => (
              <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300 flex gap-2">
                <span className="text-zinc-400">·</span>
                {ex}
              </li>
            ))}
          </ul>
        </div>

        {/* Common mistake */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Common Mistake</p>
          <p className="text-xs text-amber-700 dark:text-amber-300">{gp.commonMistake}</p>
        </div>
      </div>
    </div>
  );
}

function VocabCard({ item }: { item: VocabularyItem }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 px-4 py-3">
      <div className="flex items-start gap-1.5 mb-1">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline flex-1">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.danish}</span>
          <span className="text-xs text-zinc-400">{item.english}</span>
          <span className="text-xs text-zinc-500" dir="rtl" lang="fa">{item.persian}</span>
        </div>
        <SpeakButton text={item.danish} title="Listen to word" />
      </div>
      <div className="flex items-start gap-1.5">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic flex-1">{item.example}</p>
        <SpeakButton text={item.example} title="Listen to example" />
      </div>
    </div>
  );
}

// ── Local topic templates by phase ────────────────────────────────────────────

const PHASE1_TEMPLATES = [
  (topic: string) => `Write a short informal message to a friend about ${topic}. Use 5–8 sentences.`,
  (topic: string) => `Write a brief paragraph describing your personal experience with ${topic}. Use simple past and present tense.`,
  (topic: string) => `Write a short text (6–8 sentences) giving advice to someone new to ${topic}.`,
  (topic: string) => `Write a practical note or reminder related to ${topic}. Keep it short and direct.`,
];

const PHASE2_TEMPLATES = [
  (topic: string) => `Write a paragraph comparing two different approaches to ${topic}. Use connectors like "mens", "derimod", "på den ene side".`,
  (topic: string) => `Write an opinion paragraph about ${topic}. State your view clearly and give two reasons. (80–120 words)`,
  (topic: string) => `Write an advantages and disadvantages paragraph about ${topic}. Use "fordelen er", "ulempen er", "til gengæld".`,
  (topic: string) => `Write a short article paragraph on ${topic} suitable for a school magazine. Include a clear topic sentence and supporting details. (80–120 words)`,
];

const PHASE3_TEMPLATES = [
  (topic: string) => `Write a formal email to a Danish organisation about an issue related to ${topic}. Use formal register, clear structure, and appropriate connectors. (150–200 words)`,
  (topic: string) => `Write a debate text arguing for or against a position on ${topic}. Use PD3-style argumentation: thesis, arguments, counter-argument, conclusion. (150–200 words)`,
  (topic: string) => `Write a problem-solution text about a challenge related to ${topic}. Identify the problem, analyse causes, and propose solutions. (150–200 words)`,
  (topic: string) => `Write an analytical opinion text on ${topic}. Present two contrasting perspectives and give your reasoned conclusion. (150–200 words)`,
];

function getAlternativeTopics(topic: string, phase: number): string[] {
  const templates =
    phase === 1
      ? PHASE1_TEMPLATES
      : phase === 2
      ? PHASE2_TEMPLATES
      : PHASE3_TEMPLATES;
  return templates.map((fn) => fn(topic));
}

// ── Inline writing practice section ───────────────────────────────────────────

function LessonWritingPractice({ lesson, phase }: { lesson: Lesson; phase: number }) {
  const alternatives = getAlternativeTopics(lesson.topic, phase);
  const [altIndex, setAltIndex] = useState(0);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WritingCorrection | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleUseLesson() {
    setActiveTopic(lesson.writingTask);
    setResult(null);
    setError(null);
  }

  function handleGenerate() {
    setActiveTopic(alternatives[altIndex % alternatives.length]);
    setAltIndex((i) => (i + 1) % alternatives.length);
    setResult(null);
    setError(null);
  }

  async function handleCorrect() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/correct-writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), mode: "correct" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={SECTION}>
      <h2 className={SECTION_TITLE}>Writing Practice</h2>
      <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 overflow-hidden">

        {/* Topic area */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
            Writing Topic
          </p>
          {activeTopic ? (
            <p className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">{activeTopic}</p>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
              Choose a topic below to get started.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={handleUseLesson}
              className="rounded-full px-4 py-1.5 text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:opacity-80 transition-opacity"
            >
              Use This Topic
            </button>
            <button
              onClick={handleGenerate}
              className="rounded-full px-4 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-zinc-700 hover:ring-zinc-400 dark:hover:ring-zinc-500 transition-all"
            >
              Generate New Topic
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
            Your Answer
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv dit svar på dansk her…"
            rows={6}
            className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none leading-7"
          />
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <button
            onClick={handleCorrect}
            disabled={loading || !text.trim()}
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 transition-opacity ${
              loading || !text.trim() ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900 rounded-full inline-block" />
                Correcting…
              </>
            ) : (
              "Correct My Writing"
            )}
          </button>
        </div>

        {/* Result */}
        {result && <PracticeResult result={result} dayNumber={lesson.day} />}
      </div>
    </section>
  );
}

function PracticeResult({ result, dayNumber }: { result: WritingCorrection; dayNumber: number }) {
  const INNER = "px-5 py-4 border-b border-zinc-100 dark:border-zinc-800";
  const LABEL = "text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2";
  return (
    <div>
      <div className={INNER}>
        <p className={LABEL}>Corrected Version</p>
        <p className="text-sm leading-7 text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-3">
          {result.correctedVersion}
        </p>
      </div>
      <div className={INNER}>
        <p className={LABEL}>Natural Version</p>
        <p className="text-sm leading-7 text-blue-900 dark:text-blue-100 whitespace-pre-wrap bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3">
          {result.naturalVersion}
        </p>
      </div>
      <div className={INNER}>
        <p className={LABEL}>توضیح</p>
        <p
          className="text-sm leading-8 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap"
          dir="rtl"
          lang="fa"
        >
          {result.explanationPersian}
        </p>
      </div>
      {result.suggestedFlashcards?.length > 0 && (
        <div className="px-5 py-4">
          <p className={LABEL}>
            Suggested Flashcards ({result.suggestedFlashcards.length})
          </p>
          <PracticeFlashcards cards={result.suggestedFlashcards} dayNumber={dayNumber} />
        </div>
      )}
    </div>
  );
}

function PracticeFlashcards({ cards, dayNumber }: { cards: Flashcard[]; dayNumber: number }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      cards.forEach((card) => {
        const ref = doc(collection(db, "flashcards"));
        batch.set(ref, {
          front: card.front,
          back: card.back,
          status: "new",
          sourceLessonDay: dayNumber,
          createdAt: now,
        });
      });
      await batch.commit();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {cards.map((fc, i) => (
          <button
            key={i}
            onClick={() => setFlipped((prev) => ({ ...prev, [i]: !prev[i] }))}
            className="w-full text-left rounded-2xl bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-100 dark:ring-zinc-700 px-4 py-3 hover:ring-zinc-300 dark:hover:ring-zinc-600 transition-all"
          >
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">
              {fc.type} · tap to flip
            </p>
            {flipped[i] ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{fc.back}</p>
            ) : (
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{fc.front}</p>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {saved ? (
          <>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ {cards.length} flashcards saved to your deck
            </span>
            <Link
              href="/flashcards"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 underline underline-offset-2 transition-colors"
            >
              Review now →
            </Link>
          </>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 transition-opacity ${
              saving ? "opacity-60 cursor-not-allowed" : "hover:opacity-80"
            }`}
          >
            {saving ? (
              <>
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900 rounded-full inline-block" />
                Saving…
              </>
            ) : (
              `Add ${cards.length} Suggested Flashcards`
            )}
          </button>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

// ── Reading question card ──────────────────────────────────────────────────────

function ReadingQuestionCard({ q, index }: { q: ReadingQuestion; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 first:border-0 first:pt-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex gap-2 items-start"
      >
        <span className="flex-shrink-0 text-xs font-bold text-zinc-400 mt-0.5 w-5">
          {index + 1}.
        </span>
        <p className="text-sm text-zinc-800 dark:text-zinc-200 flex-1">{q.question}</p>
        <span className="flex-shrink-0 text-xs text-zinc-400 mt-0.5">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 ml-7">
          <span className="inline-block text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 mb-1">{q.type}</span>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{q.answer}</p>
        </div>
      )}
    </div>
  );
}

