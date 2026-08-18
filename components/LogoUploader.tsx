"use client";

import { useRef, useState } from "react";

const MAX_DIMENSION = 480;

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        // PNG keeps transparency (most logos need it); still small at this size.
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LogoUploader({ initialLogo }: { initialLogo: string | null }) {
  const [preview, setPreview] = useState<string | null>(initialLogo);
  const [logoData, setLogoData] = useState<string>("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    try {
      const dataUrl = await resizeToDataUrl(file);
      setPreview(dataUrl);
      setLogoData(dataUrl);
      setRemoveLogo(false);
    } catch {
      setError("Could not read that image — try a different file.");
    }
  }

  function onRemove() {
    setPreview(null);
    setLogoData("");
    setRemoveLogo(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      {logoData && <input type="hidden" name="logoData" value={logoData} />}
      {removeLogo && <input type="hidden" name="removeLogo" value="1" />}

      <div className="flex items-center gap-5">
        <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed border-rule-strong bg-paper-dim">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo preview" className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <span className="px-2 text-center font-mono text-[10px] uppercase tracking-wide text-ink-soft">
              No logo
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-md border border-rule-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-paper-dim">
              {preview ? "Replace logo" : "Upload logo"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
              />
            </label>
            {preview && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md px-3 py-1.5 text-sm text-rust hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
            PNG or JPG, resized automatically
          </p>
          {error && <p className="text-xs text-rust">{error}</p>}
        </div>
      </div>
    </div>
  );
}
