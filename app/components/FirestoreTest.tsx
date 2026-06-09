"use client";

import { useState } from "react";
import { db } from "@/app/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function FirestoreTest() {
  const [status, setStatus] = useState<string | null>(null);

  async function runTest() {
    setStatus("Writing...");
    try {
      const ref = doc(db, "test", "ping");
      await setDoc(ref, { message: "hello", timestamp: Date.now() });

      setStatus("Reading...");
      const snap = await getDoc(ref);
      const data = snap.data();

      setStatus(`Success: ${JSON.stringify(data)}`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={runTest}
        className="flex h-12 w-48 items-center justify-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Test Firestore
      </button>
      {status && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
      )}
    </div>
  );
}
