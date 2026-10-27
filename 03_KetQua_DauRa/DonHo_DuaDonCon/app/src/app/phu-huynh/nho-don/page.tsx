import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, Note, PageHead } from "@/components/ui";
import { addDays, vnToday } from "@/domain/time";
import { placesOf } from "@/server/places";
import { currentUser, parentTrusted } from "@/server/queries";
import { RequestForm } from "./RequestForm";

export default async function NewRequest({ searchParams }: { searchParams: Promise<{ be?: string }> }) {
  const me = await currentUser();
  if (!me?.isParent) redirect("/");
  const { be } = await searchParams;
  const [students, places] = await Promise.all([parentTrusted(me.id), placesOf(me.id)]);
  const sc = students[0]?.class.school;
  const today = vnToday();

  return (
    <>
      <PageHead title="Nhờ đón hộ" sub="Người đón nhận lời, giáo viên duyệt, rồi người đón mới nhận được mã đón." />
      {students.length === 0 ? (
        <Empty>Chưa có trẻ nào gắn với tài khoản của bạn. Liên hệ nhà trường.</Empty>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>
          <RequestForm
            today={today}
            maxDate={addDays(today, 7)}
            places={places.map((p) => ({ id: p.id, label: p.label, address: p.address, ward: p.ward, lat: p.lat, lng: p.lng }))}
            center={sc?.lat != null && sc.lng != null ? { lat: sc.lat, lng: sc.lng } : null}
            defaultStudent={students.some((s) => s.id === be) ? be! : students[0].id}
            students={students.map((s) => ({
              id: s.id, name: s.name, className: s.class.name, pickup: `${s.class.pickupStart}–${s.class.pickupEnd}`, allowAdhoc: s.class.school.allowAdhoc,
              trusted: s.trusted.filter((t) => t.status === "DA_DUYET").map((t) => ({ id: t.id, name: t.name, relation: t.relation })),
              pendingTrusted: s.trusted.filter((t) => t.status === "CHO_DUYET").length,
            }))}
          />
        </div>
      )}
      <Note>Muốn nhờ nhanh lần sau? Thêm ông bà, người thân vào <Link href="/nguoi-tin-cay">danh sách tin cậy</Link> để giáo viên duyệt trước một lần.</Note>
    </>
  );
}
