"use client";

import * as React from "react";
import { defaultAssetKey } from "@/lib/assets";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * File picker for /admin/assets. The native input is visually hidden because
 * Firefox renders it as unstyled text on this theme; a real button opens the
 * dialog, the zone accepts a dropped file, and the Key field below is
 * prefilled from the file name while it is empty.
 */
export function AssetFileInput({ keyInputId }: { keyInputId: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);

  function accept(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      setPicked(null);
      return;
    }
    setPicked(`${file.name} (${formatBytes(file.size)})`);
    const keyInput = document.getElementById(keyInputId) as HTMLInputElement | null;
    if (keyInput && !keyInput.value) keyInput.value = defaultAssetKey(file.name);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const input = inputRef.current;
        if (!input || e.dataTransfer.files.length === 0) return;
        input.files = e.dataTransfer.files;
        accept(input.files);
      }}
      className={
        "flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition " +
        (over ? "border-accent/60 bg-accent/5" : "border-line bg-panel/40")
      }
    >
      <input
        ref={inputRef}
        name="file"
        type="file"
        required
        className="sr-only"
        onChange={(e) => accept(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-neutral-700 bg-line px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-700 transition"
      >
        Choose file
      </button>
      <span className={"text-sm " + (picked ? "text-body" : "text-neutral-500")}>
        {picked ?? "or drop a file here"}
      </span>
    </div>
  );
}
