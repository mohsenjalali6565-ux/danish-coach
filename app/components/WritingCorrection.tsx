"use client";

import { useState } from "react";
import Link from "next/link";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { WritingCorrection as WCResult, Flashcard } from "@/app/types/lesson";

type Mode = "correct" | "translate";

const SECTION = "mb-7";
const SECTION_TITLE =
  "mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400";

export default function WritingCorrection() {
  const [mode, setMode] = useState<Mode>("correct");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WCResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleModeSwitch(newMode: Mode) {
    if (newMode === mode) return;
    setMode(newMode);
    setResult(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/correct-writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), mode }),
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

  const placeholder =
    mode === "correct"
      ? "Skriv din danske tekst her…"
      : "اینجا به فارسی یا انگلیسی بنویسید…";

  const buttonLabel =
    mode === "correct" ? "Correct My Writing" : "Translate to Danish";

  const loadingLabel =
    mode === "correct" ? "Correcting…" : "Translating…";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-4 py-3 shadow-sm">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
        >
          ← Learning Path
        </Link>
        <span className="ml-auto text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Writing Assistant Pro
        </span>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Writing Assistant Pro</h1>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            {mode === "correct"
              ? "Write Danish text and get instant correction and explanation in Persian."
              : "Write your thoughts in Persian or English and get a Danish translation with explanation."}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => handleModeSwitch("correct")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              mode === "correct"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-400 dark:hover:ring-zinc-600"
            }`}
          >
            Correct my Danish
          </button>
          <button
            onClick={() => handleModeSwitch("translate")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              mode === "translate"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-400 dark:hover:ring-zinc-600"
            }`}
          >
            Translate my thoughts to Danish
          </button>
        </div>

        {/* Input */}
        <div className={SECTION}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={6}
            dir={mode === "translate" ? "auto" : "ltr"}
            className="w-full rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none leading-7"
          />
          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 transition-opacity ${
              loading || !text.trim() ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900 rounded-full inline-block" />
                {loadingLabel}
              </>
            ) : (
              buttonLabel
            )}
          </button>
        </div>

        {/* Result */}
        {result && <CorrectionResult result={result} mode={mode} />}
      </div>
    </div>
  );
}

function CorrectionResult({ result, mode }: { result: WCResult; mode: Mode }) {
  return (
    <div>
      {/* Corrected / translated version */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}>
          {mode === "translate" ? "Danish Translation" : "Corrected Version"}
        </p>
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 px-5 py-4">
          <p className="text-base leading-8 text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
            {result.correctedVersion}
          </p>
        </div>
      </div>

      {/* Natural version */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}>Natural Version</p>
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800 px-5 py-4">
          <p className="text-base leading-8 text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
            {result.naturalVersion}
          </p>
        </div>
      </div>

      {/* Persian explanation */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}>توضیح</p>
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-100 dark:ring-amber-900/60 px-5 py-4">
          <p
            className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap"
            dir="rtl"
            lang="fa"
          >
            {result.explanationPersian}
          </p>
        </div>
      </div>

      {/* Suggested flashcards */}
      {result.suggestedFlashcards?.length > 0 && (
        <div className={SECTION}>
          <p className={SECTION_TITLE}>
            Suggested Flashcards ({result.suggestedFlashcards.length})
          </p>
          <WritingFlashcards cards={result.suggestedFlashcards} />
        </div>
      )}
    </div>
  );
}

function WritingFlashcards({ cards }: { cards: Flashcard[] }) {
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
          sourceLessonDay: null,
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
            className="w-full text-left rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 px-4 py-3 hover:ring-zinc-300 dark:hover:ring-zinc-600 transition-all"
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
