"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { CurriculumDay } from "@/app/data/curriculum";
import type { Lesson, GrammarPoint, VocabularyItem, ReadingQuestion, Flashcard } from "@/app/types/lesson";

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
        {lesson && <LessonContent lesson={lesson} />}
      </div>
    </div>
  );
}

function LessonContent({ lesson }: { lesson: Lesson }) {
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
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{line.danish}</p>
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
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{ks.danish}</p>
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
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{lesson.reading.title}</h3>
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

      {/* Flashcards */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Suggested Flashcards ({lesson.suggestedFlashcards.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {lesson.suggestedFlashcards.map((fc, i) => (
            <FlashcardItem key={i} fc={fc} />
          ))}
        </div>
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
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline mb-1">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.danish}</span>
        <span className="text-xs text-zinc-400">{item.english}</span>
        <span className="text-xs text-zinc-500" dir="rtl" lang="fa">{item.persian}</span>
      </div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">{item.example}</p>
    </div>
  );
}

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

function FlashcardItem({ fc }: { fc: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className="w-full text-left rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 px-4 py-3 hover:ring-zinc-300 dark:hover:ring-zinc-600 transition-all"
    >
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">{fc.type} · tap to flip</p>
      {flipped ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{fc.back}</p>
      ) : (
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{fc.front}</p>
      )}
    </button>
  );
}
