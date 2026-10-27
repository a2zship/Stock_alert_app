"use client";
// Bộ chọn khu vực thực tế: Tỉnh/thành → Phường/xã → Trường → (Lớp + bé cần cô xác nhận).
// Phường/xã hoặc trường không có trong danh sách thì gõ tay (lưu "chưa xác minh" / "đề xuất").
import { useEffect, useState } from "react";
import { CLAIM_RELATIONS } from "@/domain/area";

type Opt = { id: number; name: string };
type SchoolOpt = { id: string; name: string; classes: { id: string; name: string }[] };
/** wardName = phường/xã gõ tay chưa xác minh (không có trong danh sách chọn) → mở sẵn ô gõ tên. */
export type AreaDefaults = { provinceId?: number | null; wardId?: number | null; wardName?: string | null; schoolId?: string | null; schoolName?: string | null };

const OTHER = "khac";

async function load<T>(q: string): Promise<T[]> {
  try {
    const res = await fetch(`/api/khu-vuc?${q}`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export function AreaPicker({ provinces, defaults = {}, withChild = false }: {
  provinces: { id: number; name: string; formedFrom: string }[]; defaults?: AreaDefaults; withChild?: boolean;
}) {
  const [province, setProvince] = useState(defaults.provinceId ? String(defaults.provinceId) : "");
  const [ward, setWard] = useState(defaults.wardName ? OTHER : defaults.wardId ? String(defaults.wardId) : "");
  const [school, setSchool] = useState(defaults.schoolId ?? (defaults.schoolName ? OTHER : ""));
  const [wards, setWards] = useState<Opt[] | null>(null);
  const [schools, setSchools] = useState<SchoolOpt[] | null>(null);
  const [cls, setCls] = useState("");

  useEffect(() => {
    setWards(null);
    if (province) load<Opt>(`tinh=${province}`).then(setWards);
  }, [province]);
  useEffect(() => {
    setSchools(null);
    if (ward && ward !== OTHER) load<SchoolOpt>(`phuong=${ward}`).then(setSchools);
  }, [ward]);

  const typedWard = ward === OTHER;
  const chosen = schools?.find((s) => s.id === school);
  const typedSchool = typedWard || school === OTHER || (schools !== null && schools.length === 0);

  return (
    <>
      <div className="field">
        <label htmlFor="provinceId">Tỉnh/thành phố</label>
        <select id="provinceId" name="provinceId" required value={province}
          onChange={(e) => { setProvince(e.target.value); setWard(""); setSchool(""); setCls(""); }}>
          <option value="" disabled>Chọn tỉnh/thành</option>
          {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}{p.formedFrom ? ` (gồm ${p.formedFrom})` : ""}</option>)}
        </select>
        <p className="hint">Theo 34 tỉnh/thành từ 01/07/2025.</p>
      </div>

      {province && (
        <div className="field">
          <label htmlFor="wardId">Phường/xã</label>
          <select id="wardId" name="wardId" required value={ward} disabled={wards === null}
            onChange={(e) => { setWard(e.target.value); setSchool(""); setCls(""); }}>
            <option value="" disabled>{wards === null ? "Đang tải…" : "Chọn phường/xã"}</option>
            {wards?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            <option value={OTHER}>Không có trong danh sách — tôi gõ tên</option>
          </select>
        </div>
      )}
      {typedWard && (
        <div className="field">
          <label htmlFor="wardName">Tên phường/xã</label>
          <input id="wardName" name="wardName" type="text" required maxLength={60} defaultValue={defaults.wardName ?? ""} placeholder="Ví dụ: Phường Tân An" />
          <p className="hint">Ghi đúng tên mới sau sáp nhập. Tên gõ tay được đánh dấu &quot;chưa xác minh&quot; tới khi quản trị đối chiếu.</p>
        </div>
      )}

      {ward && !typedWard && schools && schools.length > 0 && (
        <div className="field">
          <label htmlFor="schoolId">Trường của con</label>
          <select id="schoolId" name="schoolId" value={school} onChange={(e) => { setSchool(e.target.value); setCls(""); }}>
            <option value="">Chưa chọn (tôi chỉ đi đón giúp)</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value={OTHER}>Trường của con chưa có trong danh sách</option>
          </select>
        </div>
      )}
      {ward && typedSchool && (
        <div className="field">
          <label htmlFor="schoolName">Tên trường của con (không bắt buộc)</label>
          <input id="schoolName" name="schoolName" type="text" maxLength={120} defaultValue={defaults.schoolName ?? ""} placeholder="Ví dụ: Trường Mầm non Hoa Mai" />
          <p className="hint">Trường chưa dùng Đón Hộ: app ghi nhận đề xuất. Bạn vẫn dùng được các tính năng giúp đón.</p>
        </div>
      )}

      {withChild && chosen && (
        <fieldset className="field">
          <legend>Bé cần cô xác nhận (không bắt buộc)</legend>
          <div className="fields">
            <div className="field">
              <label htmlFor="classId">Lớp</label>
              <select id="classId" name="classId" value={cls} onChange={(e) => setCls(e.target.value)}>
                <option value="">Để sau</option>
                {chosen.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {cls && (
              <>
                <div className="field">
                  <label htmlFor="studentName">Họ tên bé</label>
                  <input id="studentName" name="studentName" type="text" required maxLength={60} placeholder="Ví dụ: Nguyễn Minh Khang" />
                </div>
                <div className="field">
                  <label htmlFor="relation">Bạn là</label>
                  <select id="relation" name="relation" required defaultValue="">
                    <option value="" disabled>Chọn</option>
                    {CLAIM_RELATIONS.map((r) => <option key={r} value={r}>{r} của bé</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
          <p className="hint">Cô lớp gọi điện cho bạn để xác minh, rồi mới gắn bé vào tài khoản. Trước đó bạn chưa nhờ đón cho bé được.</p>
        </fieldset>
      )}
    </>
  );
}
