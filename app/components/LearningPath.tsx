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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Danish Learning Path
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            A2+/B1 → B2 · 90-day program toward PD3
          </p>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{loading ? "Loading…" : `${completedCount} of 90 days completed`}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Phases */}
        {[1, 2, 3].map((phase) => (
          <section key={phase} className="mb-10">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {PHASE_LABELS[phase]}
            </h2>

            <div className="space-y-2">
              {curriculum
                .filter((day) => day.phase === phase)
                .map((day) => {
                  const done = completedDays.has(day.dayNumber);
                  return (
                    <div
                      key={day.dayNumber}
                      className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-800"
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
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          {day.level}
                        </p>
                      </div>

                      {/* Status + Open */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span
                          className={`hidden sm:inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            done
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {done ? "Completed" : "Not Started"}
                        </span>

                        {/* Completion dot on mobile */}
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
        ))}
      </div>
    </div>
  );
}
