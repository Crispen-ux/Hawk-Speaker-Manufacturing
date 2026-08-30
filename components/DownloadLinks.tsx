import { FileDown, FileText } from "lucide-react";

const btn =
  "flex items-center gap-1.5 rounded-md border border-rule-strong bg-white px-3 py-2 text-sm font-medium text-ink hover:border-navy/40 hover:bg-paper-dim";

export default function DownloadLinks({ csv, pdf }: { csv: string; pdf: string }) {
  return (
    <div className="flex items-end gap-2">
      <a href={csv} className={btn}>
        <FileText size={14} /> CSV
      </a>
      <a href={pdf} className={btn}>
        <FileDown size={14} /> PDF
      </a>
    </div>
  );
}