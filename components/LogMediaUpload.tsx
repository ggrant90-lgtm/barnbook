"use client";

import { useState, useRef } from "react";

interface MediaFile {
  file: File;
  preview: string;
  type: "photo" | "video";
}

export function LogMediaUpload() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: MediaFile[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const isVideo = f.type.startsWith("video/");
      const isImage = f.type.startsWith("image/");
      if (!isVideo && !isImage) continue;

      // Size check
      const maxMB = isVideo ? 100 : 10;
      if (f.size > maxMB * 1024 * 1024) continue;

      newFiles.push({
        file: f,
        preview: isImage ? URL.createObjectURL(f) : "",
        type: isImage ? "photo" : "video",
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  return (
    <div className="space-y-3">
      <label className="mb-1.5 block text-sm text-barn-dark/75">
        Photos &amp; Videos (optional)
      </label>

      {/* Hidden file inputs for the server action — each file as a separate entry */}
      {files.map((f, i) => (
        <input
          key={`hidden-${i}`}
          type="hidden"
          name="media_pending"
          value="true"
        />
      ))}

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-lg border border-barn-dark/10 bg-parchment"
            >
              {f.type === "photo" ? (
                <img
                  src={f.preview}
                  alt={`Upload ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-barn-dark/50">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                  <span className="text-xs truncate max-w-full px-1">
                    {f.file.name}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-xs shadow hover:bg-red-700"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded-lg border border-dashed border-barn-dark/20 bg-white px-4 py-3 text-sm text-barn-dark/60 hover:border-brass-gold hover:text-barn-dark transition w-full justify-center"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
          />
        </svg>
        Add photos or videos
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-m4v"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-xs text-barn-dark/40">
        Photos: JPG, PNG, WebP (max 10MB) · Videos: MP4, MOV (max 100MB)
      </p>
    </div>
  );
}
