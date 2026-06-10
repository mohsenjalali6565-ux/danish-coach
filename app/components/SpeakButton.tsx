"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  text: string;
  className?: string;
  title?: string;
}

const DANISH_NAME_HINTS = ["danish", "dansk", "ida", "sara", "helle", "mads"];

function pickDanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // Priority 1: exact da-DK
  const exact = voices.find((v) => v.lang.toLowerCase() === "da-dk");
  if (exact) return exact;
  // Priority 2: any da-* locale
  const da = voices.find((v) => v.lang.toLowerCase().startsWith("da"));
  if (da) return da;
  // Priority 3: name contains a known Danish hint
  const byName = voices.find((v) =>
    DANISH_NAME_HINTS.some((hint) => v.name.toLowerCase().includes(hint))
  );
  return byName ?? null;
}

export default function SpeakButton({ text, className = "", title = "Listen" }: Props) {
  const [showWarning, setShowWarning] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const warningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    function loadVoices() {
      voicesRef.current = window.speechSynthesis.getVoices();
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      if (warningTimeout.current) clearTimeout(warningTimeout.current);
    };
  }, []);

  function speak(e: React.MouseEvent) {
    e.stopPropagation();
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "da-DK";
    u.rate = 0.9;

    // Attempt to load voices synchronously one more time (some browsers lazy-load)
    const voices = voicesRef.current.length
      ? voicesRef.current
      : window.speechSynthesis.getVoices();

    const danishVoice = pickDanishVoice(voices);

    if (danishVoice) {
      u.voice = danishVoice;
      setShowWarning(false);
    } else {
      // No Danish voice — still speak with fallback, show guidance briefly
      setShowWarning(true);
      if (warningTimeout.current) clearTimeout(warningTimeout.current);
      warningTimeout.current = setTimeout(() => setShowWarning(false), 8000);
    }

    window.speechSynthesis.speak(u);
  }

  return (
    <span className={`relative inline-flex flex-col items-start ${className}`}>
      <button
        onClick={speak}
        aria-label={title}
        title={title}
        type="button"
        className="inline-flex items-center justify-center rounded-full w-8 h-8 bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60 transition-colors flex-shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10.5 3.75a.75.75 0 0 0-1.264-.546L5.203 7H2.667a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 1.5 10c0 .894.165 1.75.467 2.52.111.29.39.48.7.48h2.536l4.033 3.796A.75.75 0 0 0 10.5 16.25V3.75ZM13.78 7.22a.75.75 0 1 0-1.06 1.06A2.5 2.5 0 0 1 13.5 10a2.5 2.5 0 0 1-.78 1.78.75.75 0 1 0 1.06 1.06A4 4 0 0 0 15 10a4 4 0 0 0-1.22-2.78Z" />
          <path d="M16.03 5.47a.75.75 0 0 0-1.06 1.06A5.5 5.5 0 0 1 16.5 10a5.5 5.5 0 0 1-1.53 3.47.75.75 0 0 0 1.06 1.06A7 7 0 0 0 18 10a7 7 0 0 0-1.97-4.53Z" />
        </svg>
      </button>

      {showWarning && (
        <span className="absolute top-9 left-0 z-50 w-64 rounded-xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700 shadow-lg px-3 py-2.5 text-xs text-zinc-600 dark:text-zinc-400 leading-5">
          <span className="font-semibold text-amber-600 dark:text-amber-400 block mb-1">
            Danish voice not found
          </span>
          To hear correct Danish pronunciation, install a Danish TTS voice:
          <span className="block mt-1 text-zinc-500 dark:text-zinc-500">
            <strong>Windows:</strong> Settings → Time &amp; language → Speech → Add voices → Danish
          </span>
          <span className="block mt-0.5 text-zinc-500 dark:text-zinc-500">
            <strong>macOS:</strong> System Settings → Accessibility → Spoken Content → System Voice → Danish
          </span>
        </span>
      )}
    </span>
  );
}
