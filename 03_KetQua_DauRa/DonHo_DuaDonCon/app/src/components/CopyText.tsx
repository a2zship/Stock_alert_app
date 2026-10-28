"use client";
// Ô chữ chỉ đọc + nút sao chép (điện thoại có hộp chia sẻ của hệ điều hành) — cho tin mẫu và đường dẫn gửi qua Zalo.
import { useState } from "react";
import { Icon } from "./Icon";

export function CopyText({ id, label, text, rows }: { id: string; label: string; text: string; rows?: number }) {
  const [done, setDone] = useState("");
  async function copy(share: boolean) {
    try {
      if (share && navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      setDone("Đã sao chép. Dán vào Zalo để gửi.");
    } catch {
      setDone("Chưa sao chép được — chọn ô chữ và sao chép tay.");
    }
  }
  return (
    <div className="copy-text">
      <label htmlFor={id} className="sr-only">{label}</label>
      {rows
        ? <textarea id={id} readOnly value={text} rows={rows} onFocus={(e) => e.currentTarget.select()} />
        : <input id={id} type="text" readOnly value={text} onFocus={(e) => e.currentTarget.select()} />}
      <div className="actions">
        <button type="button" className="btn btn-sm" onClick={() => copy(false)}><Icon name="copy" size={16} />Sao chép</button>
        <button type="button" className="btn btn-plain btn-sm" onClick={() => copy(true)}><Icon name="send" size={16} />Chia sẻ</button>
      </div>
      <p className="hint" role="status" aria-live="polite">{done}</p>
    </div>
  );
}

export function PrintButton({ children }: { children: React.ReactNode }) {
  return <button type="button" className="btn btn-plain btn-sm" onClick={() => window.print()}><Icon name="printer" size={16} />{children}</button>;
}
