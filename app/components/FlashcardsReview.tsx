"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { SavedFlashcard } from "@/app/types/lesson";

type Filter = "new" | "hard" | "good" | "all";

const FILTERS: Filter[] = ["new", "hard", "good", "all"];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  hard: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export default function FlashcardsReview() {
  const [allCards, setAllCards] = useState<SavedFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("new");

  // The current review queue — fixed when filter changes
  const [queue, setQueue] = useState<SavedFlashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    setLoading(true);
    try {
      const q = query(collection(db, "flashcards"), orderBy("sourceLessonDay"));
      const snap = await getDocs(q);
      const cards = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SavedFlashcard[];
      setAllCards(cards);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  // Rebuild queue when filter or allCards change
  useEffect(() => {
    const filtered =
      filter === "all" ? [...allCards] : allCards.filter((c) => c.status === filter);
    setQueue(filtered);
    setCurrentIndex(0);
    setShowAnswer(false);
  }, [filter, allCards]);

  const counts = {
    new: allCards.filter((c) => c.status === "new").length,
    hard: allCards.filter((c) => c.status === "hard").length,
    good: allCards.filter((c) => c.status === "good").length,
    all: allCards.length,
  };

  const currentCard = queue[currentIndex] ?? null;
  const done = !currentCard && queue.length > 0;

  async function handleHard() {
    if (!currentCard) return;
    try {
      await updateDoc(doc(db, "flashcards", currentCard.id), { status: "hard" });
      setAllCards((prev) =>
        prev.map((c) => (c.id === currentCard.id ? { ...c, status: "hard" } : c))
      );
      // Remove from queue, index stays → next card slides up
      setQueue((prev) => prev.filter((_, i) => i !== currentIndex));
      setShowAnswer(false);
    } catch {
      // ignore
    }
  }

  async function handleGood() {
    if (!currentCard) return;
    try {
      await updateDoc(doc(db, "flashcards", currentCard.id), { status: "good" });
      setAllCards((prev) =>
        prev.map((c) => (c.id === currentCard.id ? { ...c, status: "good" } : c))
      );
      setQueue((prev) => prev.filter((_, i) => i !== currentIndex));
      setShowAnswer(false);
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    if (!currentCard) return;
    try {
      await deleteDoc(doc(db, "flashcards", currentCard.id));
      setAllCards((prev) => prev.filter((c) => c.id !== currentCard.id));
      setQueue((prev) => prev.filter((_, i) => i !== currentIndex));
      setShowAnswer(false);
    } catch {
      // ignore
    }
  }

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
          Flashcards
        </span>
      </div>

      <div className="mx-auto max-w-xl px-4 py-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="animate-spin w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full inline-block" />
            Loading flashcards…
          </div>
        ) : allCards.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-8 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    filter === f
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {f} · {counts[f]}
                </button>
              ))}
            </div>

            {queue.length === 0 ? (
              <p className="text-center py-16 text-zinc-400 text-sm">
                No {filter === "all" ? "" : filter + " "}cards.
              </p>
            ) : done ? (
              <SessionDone onRestart={() => setCurrentIndex(0)} />
            ) : (
              <ReviewCard
                card={currentCard!}
                index={currentIndex}
                total={queue.length}
                showAnswer={showAnswer}
                onShow={() => setShowAnswer(true)}
                onHard={handleHard}
                onGood={handleGood}
                onDelete={handleDelete}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  card,
  index,
  total,
  showAnswer,
  onShow,
  onHard,
  onGood,
  onDelete,
}: {
  card: SavedFlashcard;
  index: number;
  total: number;
  showAnswer: boolean;
  onShow: () => void;
  onHard: () => void;
  onGood: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      {/* Progress */}
      <div className="flex justify-between text-xs text-zinc-400 mb-3">
        <span>Card {index + 1} of {total}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            STATUS_COLORS[card.status] ?? STATUS_COLORS.new
          }`}
        >
          {card.status}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 overflow-hidden mb-5">
        {/* Front */}
        <div className="px-6 py-8 text-center border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-400 mb-2 uppercase tracking-wide">Danish</p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 leading-snug">
            {card.front}
          </p>
        </div>

        {/* Back */}
        {showAnswer ? (
          <div className="px-6 py-6 text-center">
            <p className="text-xs text-zinc-400 mb-2 uppercase tracking-wide">Answer</p>
            <p className="text-base text-zinc-600 dark:text-zinc-300">{card.back}</p>
            <p className="text-xs text-zinc-400 mt-2">Day {card.sourceLessonDay}</p>
          </div>
        ) : (
          <div className="px-6 py-6 text-center">
            <button
              onClick={onShow}
              className="rounded-full px-6 py-2.5 text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Show Answer
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {showAnswer && (
        <div className="flex gap-3">
          <button
            onClick={onHard}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Hard
          </button>
          <button
            onClick={onGood}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
          >
            Good
          </button>
          <button
            onClick={onDelete}
            className="rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-2">No flashcards yet.</p>
      <p className="text-zinc-400 dark:text-zinc-500 text-xs mb-6">
        Open a lesson and click "Add Flashcards to My Deck".
      </p>
      <Link
        href="/"
        className="rounded-full px-5 py-2.5 text-sm font-semibold bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:opacity-80 transition-opacity"
      >
        Go to Learning Path
      </Link>
    </div>
  );
}

function SessionDone({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="text-center py-16">
      <p className="text-2xl mb-2">✓</p>
      <p className="text-zinc-900 dark:text-zinc-50 font-semibold mb-1">Session complete</p>
      <p className="text-zinc-400 text-sm mb-6">You've reviewed all cards in this filter.</p>
      <button
        onClick={onRestart}
        className="rounded-full px-5 py-2.5 text-sm font-semibold bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:opacity-80 transition-opacity"
      >
        Review Again
      </button>
    </div>
  );
}
