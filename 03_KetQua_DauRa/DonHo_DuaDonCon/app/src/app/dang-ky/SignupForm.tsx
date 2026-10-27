"use client";
// Một form cho cả hai bước: điền thông tin + khu vực → gửi mã; nhập mã → tạo tài khoản.
// Các ô vẫn ở trên form ở bước 2 và được gửi lại; máy chủ kiểm lại toàn bộ trước khi tạo tài khoản.
// Gửi bằng onSubmit (không dùng prop action): React tự xoá form sau mỗi lần gửi qua action, làm mất các ô ở bước 2.
import { startTransition, useActionState } from "react";
import { finishSignupAction, startSignupAction, type FormState } from "@/app/actions";
import { AreaPicker } from "@/components/AreaPicker";
import { Note } from "@/components/ui";

export function SignupForm({ provinces, refCode }: { provinces: { id: number; name: string; formedFrom: string }[]; refCode?: string }) {
  const [sent, send, sending] = useActionState<FormState, FormData>(startSignupAction, null);
  const [done, finish, finishing] = useActionState<FormState, FormData>(finishSignupAction, null);
  const busy = sending || finishing;
  const onCode = sent?.step === "code" || done?.step === "code";
  const err = onCode ? done?.error : sent?.error;

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(() => (onCode ? finish : send)(fd));
    }}>
      {err && <Note kind="error">{err}</Note>}
        <div className="field">
          <label htmlFor="name">Họ và tên</label>
          <input id="name" name="name" type="text" autoComplete="name" required maxLength={60} placeholder="Ví dụ: Nguyễn Thị Mai" />
        </div>
        <div className="field">
          <label htmlFor="phone">Số điện thoại</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
        </div>
        <AreaPicker provinces={provinces} withChild />
        <div className="field">
          <label htmlFor="refCode">Mã giới thiệu <span className="muted">(nếu có)</span></label>
          <input id="refCode" name="refCode" type="text" autoCapitalize="characters" autoComplete="off" maxLength={8} defaultValue={refCode} placeholder="Ví dụ: AB12CD" aria-describedby="refCode-hint" />
          <p id="refCode-hint" className="hint">Người giới thiệu bạn được cảm ơn bằng tín dụng trừ phí. Bạn không mất thêm khoản nào.</p>
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
        {onCode ? "Tạo tài khoản" : "Gửi mã xác nhận"}
      </button>
    </form>
  );
}

