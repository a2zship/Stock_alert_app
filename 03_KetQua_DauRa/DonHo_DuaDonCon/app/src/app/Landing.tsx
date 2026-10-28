// Trang giới thiệu công khai (chưa đăng nhập): ba đối tượng — phụ huynh bận, phụ huynh hay đi đón, nhà trường.
// Chỉ nói điều app đang làm được; không có số liệu hay lời khen bịa.
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

const AUDIENCES: { id: string; icon: IconName; title: string; lead: string; points: string[]; cta: { href: string; label: string } }[] = [
  {
    id: "phu-huynh", icon: "home", title: "Phụ huynh bận",
    lead: "Hôm nào không kịp đón, nhờ người quen mặt thay vì giao con cho tài xế lạ.",
    points: [
      "Nhờ ông bà, người thân, hoặc phụ huynh cùng lớp trong một phút",
      "Cô kiểm người đón tại cổng: mã QR, ảnh, 4 số cuối CCCD",
      "Theo dõi đường về trên bản đồ, nhận tin khi bé tới nơi",
    ],
    cta: { href: "/dang-ky", label: "Đăng ký phụ huynh" },
  },
  {
    id: "nguoi-don", icon: "wallet", title: "Phụ huynh hay đi đón",
    lead: "Đằng nào cũng ra cổng đón con — đón thêm một bé cùng lớp là có thêm thu nhập.",
    points: [
      "Cô lớp duyệt bạn một lần, sau đó nhận lời nhờ trong nhóm lớp",
      "Phụ huynh nhờ chuyển khoản thẳng cho bạn, app không giữ tiền",
      "Nhận đón cố định theo tháng nếu nhà gần nhau",
    ],
    cta: { href: "/dang-ky", label: "Đăng ký người đón" },
  },
  {
    id: "nha-truong", icon: "school", title: "Nhà trường",
    lead: "Giờ tan học bớt cuộc gọi, có nhật ký giao trẻ làm bằng chứng.",
    points: [
      "Trường không mất phí dùng app",
      "Trường nhận 10%, cô lớp nhận 5% doanh thu phát sinh ở lớp",
      "Tự mở trường, thêm lớp và mời cô trong vài phút",
    ],
    cta: { href: "/mo-truong", label: "Mở Đón Hộ cho trường" },
  },
];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "plus", title: "Phụ huynh nhờ đón", text: "Chọn người tin cậy, hoặc đăng lời nhờ cho phụ huynh cùng lớp." },
  { icon: "userCheck", title: "Cô duyệt", text: "Người lạ với lớp: cô gọi điện xác minh với phụ huynh trước khi duyệt." },
  { icon: "qr", title: "Kiểm tại cổng", text: "Người đón đưa mã QR; cô đối chiếu ảnh, CCCD; bé nhận ra người đón." },
  { icon: "mapPin", title: "Bé về tới nơi", text: "Phụ huynh xem đường về trên bản đồ và bấm xác nhận khi bé về an toàn." },
];

const COMPARE: [string, string, string][] = [
  ["Người đón là ai", "Tài xế khác nhau mỗi lần", "Người thân hoặc phụ huynh cùng lớp, cô đã duyệt"],
  ["Kiểm tại cổng", "Tuỳ trường", "Mã QR + ảnh + 4 số cuối CCCD, có nhật ký"],
  ["Biết bé đã về", "Gọi hỏi tài xế", "Bản đồ theo dõi và tin báo bé tới nơi"],
  ["Bé cần điện thoại", "Không", "Không — người đón mang theo cho bé"],
];

const FAQ: [string, string][] = [
  ["Nhờ đón có mất tiền không?", "Nhờ đón, cô duyệt, kiểm tại cổng, bản đồ và tin báo bé về đều miễn phí. Khi nhờ phụ huynh khác đón có thù lao, bạn tự đặt mức tối thiểu và chuyển thẳng cho người đón; nền tảng trích phí từ phía người đón."],
  ["Trường của con chưa dùng Đón Hộ thì sao?", "Bạn vẫn đăng ký và ghi tên trường để đề xuất. Khi đủ phụ huynh cùng đề xuất, app gửi bạn đường dẫn để mời nhà trường mở Đón Hộ."],
  ["App lưu những gì về bé?", "Họ tên, lớp và ảnh để cô đối chiếu. Hồ sơ bé không lưu địa chỉ nhà; điểm trả khai theo từng lần và tự xoá khi xong."],
  ["Ai chịu trách nhiệm giao trẻ?", "Nhà trường, như hiện nay. Đón Hộ là công cụ giúp cô kiểm đúng người và ghi lại bằng chứng."],
];

export function Landing() {
  return (
    <div className="landing">
      <header className="lp-bar">
        <Link href="/" className="lp-brand"><span className="logo-mark logo-sm"><Icon name="shield" size={16} /></span>Đón Hộ</Link>
        <Link href="/dang-nhap" className="btn btn-plain btn-sm">Đăng nhập</Link>
      </header>

      <section className="lp-hero">
        <p className="lp-eyebrow">Nhờ đón con có cô giáo xác nhận</p>
        <h1>Bận đột xuất? Nhờ mẹ của bạn cùng lớp đón con.</h1>
        <p className="lp-lead">Cô xác minh người đón tại cổng. Bé không cần mang điện thoại — người đón mang theo cho bé, bạn theo dõi trên bản đồ tới khi bé về.</p>
        <div className="actions">
          <Link href="/dang-ky" className="btn btn-lg">Đăng ký phụ huynh</Link>
          <Link href="/mo-truong" className="btn btn-lg btn-ghost">Nhà trường: mở Đón Hộ</Link>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-who">
        <h2 id="lp-who">Đón Hộ dành cho ai</h2>
        <div className="lp-cards">
          {AUDIENCES.map((a) => (
            <article key={a.id} id={a.id} className="card lp-card">
              <span className="lp-icon"><Icon name={a.icon} size={24} /></span>
              <h3>{a.title}</h3>
              <p className="muted">{a.lead}</p>
              <ul className="lp-points">
                {a.points.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}
              </ul>
              <Link href={a.cta.href} className="btn btn-block">{a.cta.label}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-how">
        <h2 id="lp-how">Một lần đón hộ diễn ra thế nào</h2>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="lp-step-no" aria-hidden="true">{i + 1}</span>
              <div><strong><Icon name={s.icon} size={16} /> {s.title}</strong><p className="muted">{s.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section" aria-labelledby="lp-compare">
        <h2 id="lp-compare">So với đặt xe đón con</h2>
        <div className="table-wrap">
          <table className="lp-table">
            <thead><tr><th scope="col"><span className="sr-only">Tiêu chí</span></th><th scope="col">Đặt xe</th><th scope="col">Đón Hộ</th></tr></thead>
            <tbody>
              {COMPARE.map(([k, a, b]) => <tr key={k}><th scope="row">{k}</th><td>{a}</td><td>{b}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-faq">
        <h2 id="lp-faq">Câu hỏi thường gặp</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="lp-faq">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section className="lp-cta">
        <h2>Trường của con chưa có Đón Hộ?</h2>
        <p>Gửi trang này cho cô hoặc chủ trường. Mở trường mất khoảng 3 phút, không mất phí.</p>
        <div className="actions">
          <Link href="/mo-truong" className="btn btn-lg">Mở Đón Hộ cho trường</Link>
          <Link href="/dang-ky" className="btn btn-lg btn-ghost">Đăng ký và đề xuất trường</Link>
        </div>
      </section>

      <footer className="lp-foot small muted">Đón Hộ — bản thử nghiệm. Trách nhiệm giao trẻ vẫn thuộc nhà trường.</footer>
    </div>
  );
}
