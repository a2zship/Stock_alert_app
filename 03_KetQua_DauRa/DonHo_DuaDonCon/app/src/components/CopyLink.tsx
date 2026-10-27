"use client";
// Ô liên kết chỉ đọc + nút sao chép / chia sẻ (điện thoại có hộp chia sẻ của hệ điều hành).
import { useState } from "react";
import { Icon } from "./Icon";

export function CopyLink({ url, text }: { url: string; text: string }) {
  const [done, setDone] = useState("");
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: "Đón Hộ", text, url }); return; }
      await navigator.clipboard.writeText(url);
      setDone("Đã sao chép liên kết.");
    } catch {
      setDone("Chưa sao chép được — chọn ô liên kết và sao chép tay.");
    }
  }
  return (
    <div className="copy-link">
      <label htmlFor="ref-url" className="sr-only">Liên kết giới thiệu</label>
      <input id="ref-url" type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn btn-accent" onClick={share}><Icon name="send" size={16} />Gửi liên kết</button>
      <p className="hint" role="status" aria-live="polite">{done}</p>
    </div>
  );
}
