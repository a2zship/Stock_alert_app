"use client";
// Nhà trường tự mở trường. Chưa đăng nhập: điền thông tin → gửi mã → nhập mã → tạo tài khoản + trường (giống form đăng ký).
// Đã đăng nhập: một bước, không cần số điện thoại.
// Gửi bằng onSubmit (không dùng prop action): React tự xoá form sau mỗi lần gửi qua action, làm mất các ô ở bước 2.
import { startTransition, useActionState } from "react";
import { finishOpenSchoolAction, openSchoolAction, startOpenSchoolAction, type FormState } from "@/app/actions";
import { AreaPicker, type AreaDefaults } from "@/components/AreaPicker";
import { Note } from "@/components/ui";

type Province = { id: number; name: string; formedFrom: string };

export function OpenSchoolForm({ provinces, defaults, schoolName, signedIn }: { provinces: Province[]; defaults?: AreaDefaults; schoolName?: string; signedIn: boolean }) {
  const [sent, send, sending] = useActionState<FormState, FormData>(startOpenSchoolAction, null);
  const [done, finish, finishing] = useActionState<FormState, FormData>(signedIn ? openSchoolAction : finishOpenSchoolAction, null);
  const busy = sending || finishing;
  const onCode = !signedIn && (sent?.step === "code" || done?.step === "code");
  const err = signedIn || onCode ? done?.error : sent?.error;

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(() => (signedIn || onCode ? finish : send)(fd));
    }}>
      {err && <Note kind="error">{err}</Note>}
      {!signedIn && (
        <div className="fields">
          <div className="field">
            <label htmlFor="name">Họ tên người đại diện</label>
            <input id="name" name="name" type="text" autoComplete="name" required maxLength={60} placeholder="Ví dụ: Trần Thị Thu" />
          </div>
          <div className="field">
            <label htmlFor="phone">Số điện thoại</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
          </div>
        </div>
      )}
      <AreaPicker provinces={provinces} defaults={defaults} withSchool={false} />
      <div className="field">
        <label htmlFor="schoolName">Tên trường</label>
        <input id="schoolName" name="schoolName" type="text" required maxLength={120} defaultValue={schoolName} placeholder="Ví dụ: Trường Mầm non Hoa Mai" />
      </div>
      <div className="field">
        <label htmlFor="address">Địa chỉ cổng trường <span className="muted">(không bắt buộc)</span></label>
        <input id="address" name="address" type="text" maxLength={160} autoComplete="street-address" placeholder="Ví dụ: 12 Trần Hưng Đạo" />
      </div>
      {onCode && (
        <>
          {!done?.error && sent?.ok && <Note kind="ok">{sent.ok}</Note>}
          <div className="field">
            <label htmlFor="code">Mã 6 số gửi tới {sent?.phone ?? done?.phone}</label>
            <input id="code" name="code" type="text" className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus />
          </div>
        </>
      )}
      <button type="submit" className="btn btn-lg btn-block" disabled={busy} aria-busy={busy}>
        {signedIn ? "Mở trường" : onCode ? "Mở trường" : "Gửi mã xác nhận"}
      </button>
    </form>
  );
}
