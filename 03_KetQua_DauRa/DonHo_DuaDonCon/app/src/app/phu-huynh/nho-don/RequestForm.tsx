"use client";

import { useState } from "react";
import { createRequestAction } from "@/app/actions";
import { DropPicker, type Place } from "@/components/DropPicker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Note } from "@/components/ui";

type S = { id: string; name: string; className: string; pickup: string; allowAdhoc: boolean; trusted: { id: string; name: string; relation: string }[]; pendingTrusted: number };

export function RequestForm({ students, defaultStudent, today, maxDate, places, center }: {
  students: S[]; defaultStudent: string; today: string; maxDate: string; places: Place[]; center: { lat: number; lng: number } | null;
}) {
  const [studentId, setStudentId] = useState(defaultStudent);
  const s = students.find((x) => x.id === studentId)!;
  // "" = người ngoài danh sách; còn lại là id người tin cậy
  const [pick, setPick] = useState<string>(s.trusted[0]?.id ?? "");
  const picked = pick === "" && s.allowAdhoc ? "" : s.trusted.some((t) => t.id === pick) ? pick : (s.trusted[0]?.id ?? "");
  const effective = picked === "" ? "adhoc" : "trusted";

  return (
    <ActionForm action={createRequestAction}>
      {students.length > 1 ? (
        <fieldset>
          <legend>Đón bé nào?</legend>
          <div className="choice">
            {students.map((x) => (
              <label key={x.id}>
                <input type="radio" name="studentId" value={x.id} checked={x.id === studentId} onChange={() => setStudentId(x.id)} />
                <span>{x.name}<span className="sub">{x.className} · giờ đón {x.pickup}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="studentId" value={s.id} />
          <p className="mb-10">Bé <strong>{s.name}</strong> · {s.className} · giờ đón {s.pickup}</p>
        </>
      )}

      <div className="field">
        <label htmlFor="date">Ngày đón</label>
        <input id="date" name="date" type="date" min={today} max={maxDate} defaultValue={today} required />
        <p className="hint">Khung giờ đón theo giờ tan lớp ({s.pickup}).</p>
      </div>

      <fieldset>
        <legend>Ai đón hộ?</legend>
        <input type="hidden" name="mode" value={effective} />
        <div className="choice">
          {s.trusted.map((t) => (
            <label key={t.id}>
              <input type="radio" name="trustedPersonId" value={t.id} checked={picked === t.id} onChange={() => setPick(t.id)} />
              <span>{t.name}<span className="sub">{t.relation} · đã được giáo viên duyệt</span></span>
            </label>
          ))}
          {s.allowAdhoc && (
            <label>
              <input type="radio" name="trustedPersonId" value="" checked={picked === ""} onChange={() => setPick("")} />
              <span>Người khác (ngoài danh sách)<span className="sub">Giáo viên sẽ gọi cho bạn để xác minh</span></span>
            </label>
          )}
        </div>
        {s.pendingTrusted > 0 && <p className="hint">{s.pendingTrusted} người tin cậy đang chờ giáo viên duyệt nên chưa chọn được.</p>}
        {!s.allowAdhoc && s.trusted.length === 0 && <Note kind="warn">Trường chỉ cho người trong danh sách tin cậy đón. Hãy thêm người tin cậy trước.</Note>}
      </fieldset>

      {effective === "adhoc" && (
        <div className="box mb-10">
          <div className="fields">
            <div className="field">
              <label htmlFor="name">Họ tên người đón</label>
              <input id="name" name="name" type="text" autoComplete="off" required />
            </div>
            <div className="field">
              <label htmlFor="phone">Số điện thoại người đón</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" required />
            </div>
          </div>
          <div className="field mb-0">
            <label htmlFor="relation">Quan hệ với bé</label>
            <input id="relation" name="relation" type="text" placeholder="Ví dụ: Cô ruột, hàng xóm" required />
            <p className="hint">Người đón sẽ nhận tin nhắn, tự chụp ảnh chân dung và khai 4 số cuối CCCD khi nhận lời.</p>
          </div>
        </div>
      )}

      <DropPicker places={places} center={center} />

      <div className="field">
        <label htmlFor="reason">Lời nhắn cho cô giáo (không bắt buộc)</label>
        <textarea id="reason" name="reason" maxLength={300} placeholder="Ví dụ: Bố mẹ họp đột xuất, bà ngoại đón giúp." />
      </div>
      <SubmitButton className="btn btn-lg btn-block" >Gửi yêu cầu đón hộ</SubmitButton>
    </ActionForm>
  );
}
