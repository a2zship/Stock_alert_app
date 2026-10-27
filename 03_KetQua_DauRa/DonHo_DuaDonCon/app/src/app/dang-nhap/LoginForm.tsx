"use client";

import { useActionState } from "react";
import { sendOtpAction, verifyOtpAction, type FormState } from "@/app/actions";
import { SubmitButton } from "@/components/forms";
import { Note } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [sent, send] = useActionState<FormState, FormData>(sendOtpAction, null);
  const [verified, verify] = useActionState<FormState, FormData>(verifyOtpAction, null);
  const phone = verified?.phone ?? sent?.phone ?? "";
  const onCode = sent?.step === "code" || verified?.step === "code";

  if (!onCode) {
    return (
      <form action={send}>
        {sent?.error && <Note kind="error">{sent.error}</Note>}
        <div className="field">
          <label htmlFor="phone">Số điện thoại</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone} required />
        </div>
        <SubmitButton className="btn btn-lg btn-block">Gửi mã đăng nhập</SubmitButton>
      </form>
    );
  }
  return (
    <>
      <form action={verify}>
        {verified?.error ? <Note kind="error">{verified.error}</Note> : sent?.ok && <Note kind="ok">{sent.ok}</Note>}
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="code">Mã 6 số gửi tới {phone}</label>
          <input id="code" name="code" type="text" className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus />
        </div>
        <SubmitButton className="btn btn-lg btn-block">Đăng nhập</SubmitButton>
      </form>
      <form action={send} className="mt-10">
        <input type="hidden" name="phone" value={phone} />
        <SubmitButton className="btn btn-plain btn-block">Gửi lại mã</SubmitButton>
      </form>
    </>
  );
}
