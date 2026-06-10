"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { curriculum } from "@/app/data/curriculum";

const PHASE_LABELS: Record<number, string> = {
  1: "Phase 1 — Everyday Communication · A2+/B1",
  2: "Phase 2 — Society & Opinions · B1/B1+",
  3: "Phase 3 — Advanced & PD3 Prep · B1+/B2",
};

const PHASE_COLORS: Record<number, string> = {
  1: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  2: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  3: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const PHASE_RING: Record<number, string> = {
  1: "bg-blue-600",
  2: "bg-violet-600",
  3: "bg-emerald-600",
};

const PHASE_BORDER: Record<number, string> = {
  1: "border-l-blue-400",
  2: "border-l-violet-400",
  3: "border-l-emerald-400",
};

const PHASE_PROGRESS: Record<number, string> = {
  1: "bg-blue-500",
  2: "bg-violet-500",
  3: "bg-emerald-500",
};

export default function LearningPath() {
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, "completedDays"));
        const ids = new Set(snap.docs.map((d) => parseInt(d.id)).filter(Boolean));
        setCompletedDays(ids);
      } catch {
        // collection may not exist yet — treat as empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const completedCount = curriculum.filter((d) => completedDays.has(d.dayNumber)).length;
  const progressPct = Math.round((completedCount / 90) * 100);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Danish Daily Coach
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                A2+/B1 → B2 · 90-day program toward PD3
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Link
                href="/writing"
                className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-400 dark:hover:ring-zinc-600 transition-colors"
              >
                Writing
              </Link>
              <Link
                href="/flashcards"
                className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-400 dark:hover:ring-zinc-600 transition-colors"
              >
                Flashcards
              </Link>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-5 rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-100 dark:ring-zinc-800 px-5 py-4">
            <div className="flex justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              <span>{loading ? "Loading…" : `${completedCount} of 90 days completed`}</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{progressPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Phases */}
        {[1, 2, 3].map((phase) => {
          const phaseDays = curriculum.filter((d) => d.phase === phase);
          const phaseCompleted = phaseDays.filter((d) => completedDays.has(d.dayNumber)).length;
          const phasePct = Math.round((phaseCompleted / phaseDays.length) * 100);
          return (
            <section key={phase} className="mb-10">
              <div className={`flex items-center justify-between mb-4 pl-3 border-l-2 ${PHASE_BORDER[phase]}`}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {PHASE_LABELS[phase]}
                </h2>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
                  {phaseCompleted}/{phaseDays.length}
                </span>
              </div>

              {/* Phase mini-progress */}
              <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                <div
                  className={`h-1 rounded-full transition-all duration-500 ${PHASE_PROGRESS[phase]}`}
                  style={{ width: `${phasePct}%` }}
                />
              </div>

              <div className="space-y-2">
                {phaseDays.map((day) => {
                  const done = completedDays.has(day.dayNumber);
                  return (
                    <div
                      key={day.dayNumber}
                      className={`flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3 ring-1 transition-shadow hover:shadow-sm ${
                        done
                          ? "ring-zinc-200 dark:ring-zinc-700"
                          : "ring-zinc-100 dark:ring-zinc-800"
                      }`}
                    >
                      {/* Day badge */}
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${PHASE_RING[phase]}`}
                      >
                        {day.dayNumber}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {day.topic}
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {day.level}
                        </p>
                      </div>

                      {/* Status + Open */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {done ? (
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800">
                            ✓ Done
                          </span>
                        ) : (
                          <span className="hidden sm:inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-50 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 ring-1 ring-zinc-200 dark:ring-zinc-700">
                            Not started
                          </span>
                        )}
                        {done && (
                          <span className="sm:hidden h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                        <Link
                          href={`/day/${day.dayNumber}`}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity ${PHASE_COLORS[phase]} hover:opacity-80`}
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
