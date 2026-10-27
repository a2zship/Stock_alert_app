import { redirect } from "next/navigation";
import { savePayAccountAction, saveSchoolPayAction, setTeacherShareAction } from "@/app/actions";
import { BankFields } from "@/components/BankFields";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, Note, PageHead } from "@/components/ui";
import { showVnd } from "@/domain/money";
import { PAYOUT_AFTER_DAYS, SCHOOL_RATE, TEACHER_RATE } from "@/domain/share";
import { bankName } from "@/domain/vietqr";
import { currentUser } from "@/server/queries";
import { shareView } from "@/server/share";

const pct = (r: number) => `${Math.round(r * 100)}%`;
const showMonth = (m: string) => { const [y, mm] = m.split("-"); return `Tháng ${Number(mm)}/${y}`; };
const showDay = (d: string) => d.split("-").reverse().join("/");
const STATE = {
  TAM_TINH: { label: "Tạm tính", cls: "badge-info" },
  CHO_CHUYEN: { label: "Chờ nền tảng chuyển", cls: "badge-warn" },
  DA_TRA: { label: "Đã chuyển", cls: "badge-ok" },
} as const;

type Month = Awaited<ReturnType<typeof shareView>>["schools"][number]["months"][number];

function Months({ rows, empty, baseLabel }: { rows: Month[]; empty: string; baseLabel: string }) {
  if (!rows.length) return <Empty icon="banknote">{empty}</Empty>;
  return rows.map((m) => {
    const st = STATE[m.state as keyof typeof STATE];
    return (
      <div key={m.month} className="job">
        <div>
          <strong>{showMonth(m.month)}</strong>
          <div className="meta">{baseLabel} <span className="money">{showVnd(m.base)}</span>{m.state === "TAM_TINH" ? ` · chuyển từ ${showDay(m.from)}` : ""}</div>
        </div>
        <div className="text-right">
          <div className="money">+{showVnd(m.amount)}</div>
          <span className={`badge ${st.cls}`}>{st.label}</span>
        </div>
      </div>
    );
  });
}

export default async function SharePage() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  if (!me.isTeacher && !me.isSchoolAdmin) redirect("/");
  const v = await shareView(me.id);

  return (
    <>
      <PageHead title="Chia sẻ doanh thu" sub={`Đón Hộ trích ${pct(SCHOOL_RATE)} cho nhà trường và ${pct(TEACHER_RATE)} cho giáo viên lớp trên số tiền nền tảng thực thu từ phụ huynh mỗi lớp. Không phụ thuộc số lượt cô duyệt hay từ chối.`} />

      <div className="row">
        <div className="col">
          {v.teacher && (
            <div className="card">
              <h2>Phần của tôi</h2>
              <p className="small muted">Lớp: {v.teacher.classes.map((c) => `${c.name} (${c.school})`).join(", ")}</p>
              {v.teacher.classes.some((c) => !c.on) && <Note kind="warn">Trường của bạn đã chuyển phần chia sẻ của giáo viên về quỹ trường. Phần phát sinh trước lúc đổi vẫn giữ nguyên.</Note>}
              <Months rows={v.teacher.months} empty="Chưa có doanh thu nào phát sinh ở lớp của bạn." baseLabel="Doanh thu lớp" />
            </div>
          )}

          {v.schools.map((s) => (
            <div key={s.id} className="card">
              <h2>{s.name}</h2>
              <h3 className="mt-10">Phần của trường</h3>
              <Months rows={s.months} empty="Chưa có doanh thu nào phát sinh ở trường." baseLabel="Doanh thu" />
              <h3 className="mt-15">Phần của giáo viên trong trường</h3>
              <Months rows={s.teacherMonths} empty={s.teacherShare ? "Chưa có." : "Đang gộp phần của giáo viên về trường."} baseLabel="Doanh thu các lớp" />
            </div>
          ))}
        </div>

        <div className="col">
          {v.teacher && (
            <div className="card">
              <h2>Tài khoản nhận</h2>
              {v.teacher.account
                ? <p className="small"><Icon name="checkCircle" size={16} /> {bankName(v.teacher.account.bankBin)} · {v.teacher.account.bankAccount} · {v.teacher.account.accountName}</p>
                : <Note kind="warn">Chưa có tài khoản nhận. Nền tảng chưa chuyển được phần của bạn.</Note>}
              <ActionForm action={savePayAccountAction} keep>
                <BankFields id="t" value={v.teacher.account} hint="Tài khoản phải đứng tên chính bạn." />
                <SubmitButton className="btn">{v.teacher.account ? "Cập nhật tài khoản" : "Lưu tài khoản"}</SubmitButton>
              </ActionForm>
            </div>
          )}

          {v.schools.map((s) => (
            <div key={s.id} className="card">
              <h2>Cài đặt của trường</h2>
              <h3>Phần của giáo viên</h3>
              <p className="small muted">{s.teacherShare
                ? `Đang bật: ${pct(TEACHER_RATE)} doanh thu mỗi lớp chia đều cho giáo viên lớp đó.`
                : `Đang tắt: phần ${pct(TEACHER_RATE)} của giáo viên gộp vào quỹ trường (trường tự khen thưởng theo quy chế).`}</p>
              <ActionForm action={setTeacherShareAction}>
                <input type="hidden" name="schoolId" value={s.id} />
                {s.teacherShare
                  ? <SubmitButton className="btn btn-plain" name="decision" value="off" confirm="Gộp phần của giáo viên về quỹ trường từ hôm nay?">Gộp về quỹ trường</SubmitButton>
                  : <SubmitButton className="btn btn-plain" name="decision" value="on" confirm="Chia phần cho giáo viên từng lớp từ hôm nay?">Chia cho giáo viên</SubmitButton>}
              </ActionForm>
              <h3 className="mt-15">Tài khoản nhận của trường</h3>
              {s.account
                ? <p className="small"><Icon name="checkCircle" size={16} /> {s.account.bank} · {s.account.account} · {s.account.name}</p>
                : <Note kind="warn">Chưa có tài khoản nhận của trường.</Note>}
              <ActionForm action={saveSchoolPayAction} keep>
                <input type="hidden" name="schoolId" value={s.id} />
                <BankFields id={`s-${s.id}`} value={s.account ? { bankBin: s.account.bankBin, bankAccount: s.account.account, accountName: s.account.name } : null} hint="Tài khoản đứng tên nhà trường." />
                <SubmitButton className="btn">{s.account ? "Cập nhật tài khoản" : "Lưu tài khoản"}</SubmitButton>
              </ActionForm>
            </div>
          ))}

          <div className="card card-soft">
            <h3>Quy tắc chia sẻ</h3>
            <ul className="small mb-0">
              <li>Nguồn chia: tiền nền tảng <strong>thực thu</strong> từ phụ huynh — phí thành viên (tính cho lớp có con người mua) và phí nền tảng của lượt đón có phí / đón theo tháng (tính cho lớp của bé được đón). Phần trả bằng tín dụng giới thiệu không chia.</li>
              <li>Nhà trường <strong>{pct(SCHOOL_RATE)}</strong>. Giáo viên lớp <strong>{pct(TEACHER_RATE)}</strong>, lớp có nhiều cô thì chia đều. Lớp chưa có cô, hoặc trường tắt phần của giáo viên, thì phần đó vào quỹ trường.</li>
              <li>Phần chia <strong>không tính theo lượt cô duyệt</strong>: duyệt hay từ chối không làm tăng hay giảm. Cô vẫn bắt buộc gọi xác minh và kiểm tại cổng như mọi lần.</li>
              <li>Tạm tính trong tháng; nền tảng đối soát rồi chuyển khoản từ ngày {PAYOUT_AFTER_DAYS + 1} tháng sau. Khoản bị huỷ khi đối soát thì bỏ khỏi phần chia.</li>
              <li>Giáo viên vẫn dùng được mã giới thiệu như mọi người dùng.</li>
              <li>Khoản nhận có thể phải kê khai thuế thu nhập cá nhân. Trường công lập nên hỏi phòng giáo dục về việc giáo viên nhận khoản này.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
