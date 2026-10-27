"use client";
// Form gọi server action, tự hiện lỗi/thành công cạnh form và khoá nút khi đang gửi.
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";
import { Icon } from "./Icon";
import { Note } from "./ui";

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

export function ActionForm({ action, children, className, resetOnOk = false }: { action: Action; children: React.ReactNode; className?: string; resetOnOk?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (resetOnOk && state?.ok) ref.current?.reset(); }, [state, resetOnOk]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && <Note kind="error">{state.error}</Note>}
      {state?.ok && <Note kind="ok">{state.ok}</Note>}
      {children}
    </form>
  );
}

export function SubmitButton({ children, className = "btn", name, value, confirm, noValidate }: { children: React.ReactNode; className?: string; name?: string; value?: string; confirm?: string; noValidate?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" className={className} disabled={pending} aria-busy={pending} formNoValidate={noValidate}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) { e.preventDefault(); return; }
        // Ghi lựa chọn của nút vào ô ẩn: không dựa vào name/value của nút bấm (có lúc không được gửi kèm form action)
        const form = e.currentTarget.form;
        if (form && name && value !== undefined) {
          let input = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
          if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            form.appendChild(input);
          }
          input.value = value;
        }
      }}
    >
      {children}
    </button>
  );
}

/** Chụp/chọn ảnh, thu nhỏ còn cạnh dài 800px JPEG ngay trên máy rồi gửi dưới dạng data URL (ẩn). */
export function PhotoInput({ name, label, capture = "user", required = false }: { name: string; label: string; capture?: "user" | "environment"; required?: boolean }) {
  const [data, setData] = useState("");
  const [err, setErr] = useState("");
  const id = `photo-${name}`;

  async function onPick(file: File | undefined) {
    setErr("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Chọn một tệp ảnh."); return; }
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      setData(c.toDataURL("image/jpeg", 0.85));
    } catch {
      setErr("Không đọc được ảnh này. Thử chụp lại.");
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && " *"}</label>
      <div className="photo-pick">
        {data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data} alt="Ảnh vừa chọn" className="photo" width={96} height={96} />
        ) : (
          <span className="photo photo-empty" aria-hidden="true"><Icon name="camera" size={24} /></span>
        )}
        <input id={id} type="file" accept="image/*" capture={capture} onChange={(e) => onPick(e.target.files?.[0])} aria-describedby={`${id}-hint`} />
      </div>
      <input type="hidden" name={name} value={data} />
      <p className="hint" id={`${id}-hint`}>Ảnh rõ mặt, đủ sáng. Ảnh được thu nhỏ trên máy trước khi gửi.</p>
      {err && <p className="field-error" role="alert">{err}</p>}
    </div>
  );
}
