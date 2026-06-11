"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

interface Popup {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

export default function TextSelectionFlashcard({ dayNumber }: { dayNumber?: number }) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  // Ref so the selectionchange handler always reads the live value without stale closure
  const editingRef = useRef(false);

  const dismiss = useCallback(() => {
    editingRef.current = false;
    window.getSelection()?.removeAllRanges();
    setPopup(null);
    setEditing(false);
    setFront("");
    setBack("");
    setSaved(false);
    setError(null);
  }, []);

  useEffect(() => {
    function onSelectionChange() {
      if (editingRef.current) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";

      if (!text) {
        setPopup(null);
        return;
      }

      // Don't activate when selecting inside the pill itself
      if (pillRef.current && sel?.anchorNode && pillRef.current.contains(sel.anchorNode)) {
        return;
      }

      try {
        const range = sel!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) return;

        const below = rect.top < 80;
        setPopup({
          text,
          // Clamp so the 288px editor card never overflows horizontally
          x: Math.max(144, Math.min(rect.left + rect.width / 2, window.innerWidth - 144)),
          y: below ? rect.bottom + 8 : rect.top - 8,
          below,
        });
      } catch {
        // ignore – getBoundingClientRect can throw on detached ranges
      }
    }

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []); // intentionally empty – editingRef.current is always current

  function handleAdd() {
    if (!popup) return;
    editingRef.current = true;
    setFront(popup.text);
    setBack("");
    setEditing(true);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!front.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, "flashcards"));
      batch.set(ref, {
        front: front.trim(),
        back: back.trim(),
        status: "new",
        sourceLessonDay: dayNumber ?? null,
        createdAt: new Date().toISOString(),
      });
      await batch.commit();
      setSaved(true);
      setTimeout(dismiss, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!popup && !editing) return null;

  return (
    <>
      {/* ── Floating pill ── shown while text is selected, before editing */}
      {!editing && popup && (
        <div
          ref={pillRef}
          className="fixed z-50 select-none pointer-events-auto"
          style={{
            left: popup.x,
            top: popup.y,
            transform: popup.below
              ? "translateX(-50%)"
              : "translateX(-50%) translateY(-100%)",
          }}
        >
          <div className="flex items-center gap-1 bg-zinc-900 dark:bg-zinc-50 rounded-full pl-3 pr-1.5 py-1.5 shadow-lg">
            <span className="text-xs text-white/60 dark:text-zinc-500 truncate max-w-[110px] leading-none">
              {popup.text}
            </span>
            <button
              // Prevent mousedown from clearing the selection before click fires
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAdd}
              className="text-xs font-semibold text-white dark:text-zinc-900 bg-white/15 dark:bg-black/10 hover:bg-white/25 dark:hover:bg-black/20 rounded-full px-2.5 py-1 ml-1 transition-colors"
            >
              + Flashcard
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={dismiss}
              className="text-white/40 dark:text-zinc-400 hover:text-white dark:hover:text-zinc-900 transition-colors w-6 h-6 flex items-center justify-center text-lg leading-none ml-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Editor ── bottom sheet on mobile, centred card on desktop */}
      {editing && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div className="pointer-events-auto w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                New Flashcard
              </p>
              <button
                onClick={dismiss}
                className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-zinc-400 dark:text-zinc-500 mb-1 block">Front</label>
                <input
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 dark:text-zinc-500 mb-1 block">Back</label>
                <input
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder="Translation / meaning…"
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />
              </div>
            </div>

            {saved ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium text-center py-1">
                ✓ Saved to flashcards!
              </p>
            ) : (
              <>
                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !front.trim()}
                    className={`flex-1 rounded-full py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 transition-opacity ${
                      saving || !front.trim() ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                    }`}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={dismiss}
                    className="flex-1 rounded-full py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-zinc-700 hover:ring-zinc-400 dark:hover:ring-zinc-500 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
