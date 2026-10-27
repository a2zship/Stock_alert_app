// Ba ô tài khoản ngân hàng nhận tiền (dùng cho người đón có phí, giáo viên, nhà trường).
import { BANKS } from "@/domain/vietqr";

export function BankFields({ id, value, hint }: { id: string; value?: { bankBin: string; bankAccount: string; accountName: string } | null; hint?: string }) {
  return (
    <>
      <div className="fields">
        <div className="field">
          <label htmlFor={`${id}-bin`}>Ngân hàng nhận tiền</label>
          <select id={`${id}-bin`} name="bankBin" defaultValue={value?.bankBin ?? ""} required>
            <option value="" disabled>Chọn ngân hàng</option>
            {BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-acc`}>Số tài khoản</label>
          <input id={`${id}-acc`} name="bankAccount" type="text" inputMode="numeric" autoComplete="off" defaultValue={value?.bankAccount} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`}>Tên chủ tài khoản</label>
        <input id={`${id}-name`} name="accountName" type="text" autoComplete="off" placeholder="NGUYEN VAN A" defaultValue={value?.accountName} required aria-describedby={hint ? `${id}-hint` : undefined} />
        {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      </div>
    </>
  );
}
