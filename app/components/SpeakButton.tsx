"use client";

interface Props {
  text: string;
  className?: string;
  title?: string;
}

export default function SpeakButton({ text, className = "", title = "Listen" }: Props) {
  function speak(e: React.MouseEvent) {
    e.stopPropagation();
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "da-DK";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  return (
    <button
      onClick={speak}
      aria-label={title}
      title={title}
      type="button"
      className={`inline-flex items-center justify-center rounded-full w-8 h-8 bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60 transition-colors flex-shrink-0 ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10.5 3.75a.75.75 0 0 0-1.264-.546L5.203 7H2.667a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 1.5 10c0 .894.165 1.75.467 2.52.111.29.39.48.7.48h2.536l4.033 3.796A.75.75 0 0 0 10.5 16.25V3.75ZM13.78 7.22a.75.75 0 1 0-1.06 1.06A2.5 2.5 0 0 1 13.5 10a2.5 2.5 0 0 1-.78 1.78.75.75 0 1 0 1.06 1.06A4 4 0 0 0 15 10a4 4 0 0 0-1.22-2.78Z" />
        <path d="M16.03 5.47a.75.75 0 0 0-1.06 1.06A5.5 5.5 0 0 1 16.5 10a5.5 5.5 0 0 1-1.53 3.47.75.75 0 0 0 1.06 1.06A7 7 0 0 0 18 10a7 7 0 0 0-1.97-4.53Z" />
      </svg>
    </button>
  );
}
