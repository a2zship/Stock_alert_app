"use client";
// Phần tương tác của nhóm lớp: ô soạn tin / đăng lời nhờ, và tự tải tin mới.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postAskAction, postMessageAction } from "@/app/actions";
import { DropPicker, type Place } from "@/components/DropPicker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";

/** Tải lại nội dung nhóm mỗi 8 giây khi tab đang mở (bản mẫu chưa dùng WebSocket). */
export function AutoRefresh({ ms = 8000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}

type Kid = { id: string; name: string };

export function Composer({ classId, kids, today, maxDate, places, center }: {
  classId: string; kids: Kid[]; today: string; maxDate: string; places: Place[]; center: { lat: number; lng: number } | null;
}) {
  const [mode, setMode] = useState<"msg" | "ask">("msg");
  return (
    <div className="composer">
      {kids.length > 0 && (
        <div className="seg" role="group" aria-label="Loại tin">
          <button type="button" aria-pressed={mode === "msg"} onClick={() => setMode("msg")}><Icon name="message" size={16} />Nhắn tin</button>
          <button type="button" aria-pressed={mode === "ask"} onClick={() => setMode("ask")}><Icon name="hand" size={16} />Nhờ đón hộ</button>
        </div>
      )}
      {mode === "msg" ? (
        <ActionForm action={postMessageAction} resetOnOk>
          <input type="hidden" name="classId" value={classId} />
          <div className="row-input">
            <div className="grow">
              <label htmlFor="body" className="sr-only">Tin nhắn cho cả lớp</label>
              <textarea id="body" name="body" maxLength={500} placeholder="Nhắn cho cả lớp…" required />
            </div>
            <SubmitButton className="btn btn-icon" ><Icon name="send" /><span className="sr-only">Gửi</span></SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <ActionForm action={postAskAction} resetOnOk>
          <div className="fields">
            <div className="field">
              <label htmlFor="ask-kid">Đón bé</label>
              <select id="ask-kid" name="studentId" required>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
            </div>
            <div className="field">
              <label htmlFor="ask-date">Ngày</label>
              <input id="ask-date" name="date" type="date" min={today} max={maxDate} defaultValue={today} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ask-note">Lời nhắn (không bắt buộc)</label>
            <input id="ask-note" name="note" type="text" maxLength={300} placeholder="Ví dụ: Mình kẹt họp tới 18h" />
          </div>
          <DropPicker places={places} center={center} prefix="ask-drop" />
          <SubmitButton className="btn btn-accent btn-block"><Icon name="hand" />Đăng lời nhờ vào nhóm</SubmitButton>
          <p className="hint">Người nhận giúp vẫn phải nhận lời, được cô duyệt và kiểm mã tại cổng như mọi lần đón hộ. Số điện thoại không hiện trong nhóm.</p>
        </ActionForm>
      )}
    </div>
  );
}
