"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { Flashcard } from "@/app/types/lesson";
import SpeakButton from "@/app/components/SpeakButton";

interface Props {
  dayNumber: number;
  cards: Flashcard[];
}

const SECTION_TITLE =
  "mb-3 text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500";

export default function FlashcardsSection({ dayNumber, cards }: Props) {
  const [alreadyAdded, setAlreadyAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const q = query(
          collection(db, "flashcards"),
          where("sourceLessonDay", "==", dayNumber)
        );
        const snap = await getDocs(q);
        if (!snap.empty) setAlreadyAdded(true);
      } catch {
        // ignore — treat as not added
      }
    }
    check();
  }, [dayNumber]);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      // Re-fetch existing fronts to deduplicate
      const q = query(
        collection(db, "flashcards"),
        where("sourceLessonDay", "==", dayNumber)
      );
      const existing = await getDocs(q);
      const existingFronts = new Set(existing.docs.map((d) => d.data().front as string));

      const toAdd = cards.filter((c) => !existingFronts.has(c.front));

      if (toAdd.length > 0) {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        toAdd.forEach((card) => {
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
      }

      setAlreadyAdded(true);
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save flashcards");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Preview list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
        {cards.map((fc, i) => (
          <FlipCard key={i} fc={fc} />
        ))}
      </div>

      {/* Add button row */}
      <div className="flex flex-wrap items-center gap-3">
        {alreadyAdded ? (
          <>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              {justSaved
                ? `✓ ${cards.length} flashcards saved to your deck`
                : "✓ Flashcards from this lesson already in your deck"}
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
            onClick={handleAdd}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 transition-opacity ${
              saving ? "opacity-60 cursor-not-allowed" : "hover:opacity-80"
            }`}
          >
            {saving ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full dark:border-zinc-900/40 dark:border-t-zinc-900" />
                Saving…
              </>
            ) : (
              `Add ${cards.length} Flashcards to My Deck`
            )}
          </button>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

function FlipCard({ fc }: { fc: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className="w-full text-left rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 px-4 py-3 hover:ring-zinc-300 dark:hover:ring-zinc-600 transition-all"
    >
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">
        {fc.type} · tap to flip
      </p>
      {flipped ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{fc.back}</p>
      ) : (
        <div className="flex items-start gap-1.5">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 flex-1">{fc.front}</p>
          <SpeakButton text={fc.front} title="Listen" />
        </div>
      )}
    </button>
  );
}
