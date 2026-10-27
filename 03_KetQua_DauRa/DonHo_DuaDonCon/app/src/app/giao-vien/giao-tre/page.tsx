import { redirect } from "next/navigation";
import { gateTokenAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { RequestList } from "@/components/RequestList";
import { Empty, Note, PageHead } from "@/components/ui";
import { currentUser, teacherToday } from "@/server/queries";

// Hai cách mở hồ sơ người đón: (1) quét QR bằng camera điện thoại → link mở trang này kèm ?ma=…;
// (2) chọn bé trong danh sách rồi nhập PIN người đón đọc.
export default async function GatePage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  const me = await currentUser();
  if (!me?.isTeacher) redirect("/");
  const { ma } = await searchParams;
  const { today } = await teacherToday(me.id);
  const ready = today.filter((r) => r.status === "DA_DUYET");

  return (
    <>
      <PageHead title="Giao trẻ tại cổng" sub="Quét mã QR của người đón bằng camera điện thoại, hoặc chọn bé rồi nhập mã PIN 6 số." />
      {ma && (
        <div className="card alert-banner">
          <h2>Đã quét mã QR</h2>
          <p className="small muted">Bấm để mở hồ sơ người đón và đối chiếu.</p>
          <ActionForm action={gateTokenAction}>
            <input type="hidden" name="token" value={ma} />
            <SubmitButton className="btn btn-lg btn-block"><Icon name="userCheck" />Mở hồ sơ người đón</SubmitButton>
          </ActionForm>
        </div>
      )}
      <div className="card">
        <h2>Đang chờ đón ({ready.length})</h2>
        {ready.length === 0 ? <Empty icon="checkCircle">Không có bé nào đang chờ người đón hộ.</Empty> : <RequestList rows={ready} show="student" />}
      </div>
      <Note>Quét QR: mở ứng dụng Camera của điện thoại, hướng vào mã trên máy người đón, chạm vào đường link hiện ra. Không quét được thì chọn bé ở trên và nhập PIN.</Note>
    </>
  );
}
