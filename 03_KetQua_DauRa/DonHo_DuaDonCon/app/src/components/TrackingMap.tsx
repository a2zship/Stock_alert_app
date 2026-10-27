"use client";
// Bản đồ theo dõi giao nhận bé (Leaflet + bản đồ OpenStreetMap).
// Người xem: tự tải lại vị trí mỗi 10 giây. Người đón: bật/tắt chia sẻ vị trí, gửi điểm mới tối đa 15 giây một lần.
import "leaflet/dist/leaflet.css";
import type { LatLngExpression, Map as LMap, Marker, Polyline } from "leaflet";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { arriveDropAction, arriveGateAction } from "@/app/actions";
import { showDistance } from "@/domain/geo";
import type { TrackingData } from "@/server/tracking";
import { ActionForm, SubmitButton } from "./forms";
import { Icon } from "./Icon";
import { DEFAULT_CENTER, pinIcon, TILES } from "./mapKit";
import { Note } from "./ui";

const POLL_MS = 10_000;
const SEND_MS = 15_000;
const hhmm = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m <= 0 ? "vừa xong" : `${m} phút trước`;
};
export function TrackingMap({ requestId, initial, isDelegate, studentName }: { requestId: string; initial: TrackingData; isDelegate: boolean; studentName: string }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [sharing, setSharing] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ L: typeof import("leaflet"); map: LMap; school?: Marker; person?: Marker; home?: Marker; line?: Polyline } | null>(null);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const storeKey = `donho-share-${requestId}`;

  // ── Vẽ bản đồ (chỉ chạy trên trình duyệt) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      const c = initial.school ?? DEFAULT_CENTER;
      const center: LatLngExpression = [c.lat, c.lng];
      const m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, 15);
      L.tileLayer(TILES.url, { ...TILES.opts, attribution: TILES.attribution }).addTo(m);
      map.current = { L, map: m };
      draw(initial);
    })();
    return () => { cancelled = true; map.current?.map.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = useCallback((d: TrackingData) => {
    const ctx = map.current;
    if (!ctx) return;
    const { L, map: m } = ctx;
    const icon = (k: Parameters<typeof pinIcon>[1]) => pinIcon(L, k);
    if (d.school && !ctx.school) ctx.school = L.marker([d.school.lat, d.school.lng], { icon: icon("school"), title: d.school.name, keyboard: false }).addTo(m);
    // Điểm trả: chỉ hiện khi đang đưa bé về (hoặc người xem là phụ huynh/GV xem trước)
    const home: LatLngExpression | null = d.drop?.lat != null && d.drop.lng != null ? [d.drop.lat, d.drop.lng] : null;
    if (home && !ctx.home) ctx.home = L.marker(home, { icon: icon("home"), title: d.drop!.label, keyboard: false }).addTo(m);
    if (!home && ctx.home) { ctx.home.remove(); ctx.home = undefined; }
    const target: LatLngExpression | null = d.status === "DA_DUYET" && d.school ? [d.school.lat, d.school.lng] : d.status === "DA_GIAO" ? home : null;
    if (d.delegate) {
      const pos: LatLngExpression = [d.delegate.lat, d.delegate.lng];
      if (ctx.person) ctx.person.setLatLng(pos);
      else ctx.person = L.marker(pos, { icon: icon("person"), title: d.delegate.name, keyboard: false }).addTo(m);
      const color = getComputedStyle(document.documentElement).getPropertyValue("--map-person").trim() || "#c2410c";
      if (target) {
        const pts: LatLngExpression[] = [pos, target];
        if (ctx.line) ctx.line.setLatLngs(pts);
        else ctx.line = L.polyline(pts, { color, weight: 3, dashArray: "6 8" }).addTo(m);
        m.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 16 });
      } else {
        ctx.line?.remove(); ctx.line = undefined;
        m.setView(pos, Math.max(m.getZoom(), 15));
      }
    } else {
      ctx.person?.remove(); ctx.person = undefined; ctx.line?.remove(); ctx.line = undefined;
      // chưa có vị trí người đón: cho thấy cả trường và điểm trả
      if (home && d.school) m.fitBounds(L.latLngBounds([home, [d.school.lat, d.school.lng]]), { padding: [48, 48], maxZoom: 16 });
    }
  }, []);

  const apply = useCallback((d: TrackingData) => {
    setData((prev) => {
      if (prev.status !== d.status) router.refresh(); // trạng thái đổi (đã giao, đã về…) → tải lại cả trang
      return d;
    });
    draw(d);
  }, [draw, router]);

  // Trang được làm mới (sau khi bấm "Tôi đã tới cổng"…) → nhận dữ liệu mới từ máy chủ
  useEffect(() => { setData(initial); draw(initial); }, [initial, draw]);

  // ── Người xem: tự tải lại ──
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      const res = await fetch(`/yeu-cau/${requestId}/vi-tri`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) apply(await res.json());
    }, POLL_MS);
    return () => clearInterval(t);
  }, [requestId, apply]);

  // ── Người đón: chia sẻ vị trí ──
  const send = useCallback(async (body: object) => {
    const res = await fetch(`/yeu-cau/${requestId}/vi-tri`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res) { setErr("Mất kết nối, đang thử lại…"); return; }
    const j = await res.json();
    if (!res.ok) { setErr(j.error ?? "Không gửi được vị trí."); return; }
    setErr("");
    apply(j);
  }, [requestId, apply]);

  const stop = useCallback(async (tellServer: boolean) => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
    try { sessionStorage.removeItem(storeKey); } catch { /* bỏ qua */ }
    if (tellServer) await send({ stop: true });
  }, [send, storeKey]);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) { setErr("Máy này không hỗ trợ định vị."); return; }
    setErr("");
    lastSent.current = 0;
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setSharing(true);
        if (Date.now() - lastSent.current < SEND_MS) return;
        lastSent.current = Date.now();
        void send({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => { setErr(e.code === e.PERMISSION_DENIED ? "Bạn chưa cho phép dùng vị trí. Mở cài đặt trình duyệt để cho phép." : "Chưa lấy được vị trí, thử ra chỗ thoáng hơn."); void stop(false); },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    try { sessionStorage.setItem(storeKey, "1"); } catch { /* bỏ qua */ }
  }, [send, stop, storeKey]);

  // Tải lại trang khi đang chia sẻ → tự bật lại
  useEffect(() => {
    let resume = false;
    try { resume = sessionStorage.getItem(storeKey) === "1"; } catch { /* bỏ qua */ }
    if (isDelegate && initial.canShare && resume) start();
    return () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = data;
  const going = d.status === "DA_DUYET";
  const live = d.delegate ? (d.delegate.stale ? "stale" : "on") : "off";
  const kid = `bé ${studentName.split(" ").pop()}`;
  const title = going ? (d.arrivedAt ? `Người đón đã tới cổng lúc ${hhmm(d.arrivedAt)}` : d.nearGate ? "Người đón đang ở gần cổng trường" : d.delegate ? "Người đón đang trên đường tới trường" : "Chờ người đón xuất phát")
    : d.droppedAt ? `Người đón báo đã đưa ${kid} tới nơi lúc ${hhmm(d.droppedAt)}`
      : d.nearDrop ? `${kid[0].toUpperCase()}${kid.slice(1)} sắp tới ${d.drop!.label.toLowerCase()}` : `Đang đưa ${kid} về`;

  return (
    <section className="card track-card" aria-labelledby="track-title">
      <div className="track-head">
        <div>
          <h2 id="track-title">{title}</h2>
          <span className={`live-dot ${live}`}>{live === "on" ? "Đang chia sẻ vị trí" : live === "stale" ? "Mất tín hiệu vài phút" : "Chưa chia sẻ vị trí"}</span>
        </div>
        <div className="map-legend" aria-hidden="true">
          <span><i className="lg-school" />Trường</span>
          <span><i className="lg-person" />Người đón</span>
          {d.drop?.lat != null && <span><i className="lg-home" />Điểm trả</span>}
        </div>
      </div>
      {d.drop && <p className="drop-line"><Icon name="home" size={16} /><span><strong>Trả bé tại {d.drop.label}:</strong> {d.drop.address}</span></p>}
      <div className="track-map" ref={box} role="img" aria-label={d.delegate && d.distance != null ? `Bản đồ: người đón cách trường ${showDistance(d.distance)}` : "Bản đồ vị trí trường và người đón"} />
      <div className="track-stats">
        {going ? (
          <>
            <div><div className="k">Cách trường</div><div className="v">{d.distance != null ? showDistance(d.distance) : "—"}</div></div>
            <div><div className="k">Dự kiến tới</div><div className="v">{d.arrivedAt ? "Đã tới" : d.eta != null ? `${d.eta} phút` : "—"}</div></div>
          </>
        ) : (
          <>
            <div><div className="k">Đã giao lúc</div><div className="v">{d.handedOverAt ? hhmm(d.handedOverAt) : "—"}</div></div>
            {d.droppedAt
              ? <div><div className="k">Tới nơi lúc</div><div className="v">{hhmm(d.droppedAt)}</div></div>
              : <div><div className="k">Cách điểm trả</div><div className="v">{d.dropDistance != null ? `${showDistance(d.dropDistance)}${d.dropEta != null ? ` · ${d.dropEta} phút` : ""}` : "—"}</div></div>}
          </>
        )}
        <div><div className="k">Cập nhật</div><div className="v">{d.delegate ? ago(d.delegate.at) : "—"}</div></div>
      </div>
      <div className="track-foot">
        {err && <Note kind="error">{err}</Note>}
        {isDelegate ? (
          <>
            {!d.canShare && <Note>Bạn bật được chia sẻ vị trí từ 60 phút trước giờ đón.</Note>}
            <div className="actions">
              {d.canShare && (sharing
                ? <button type="button" className="btn btn-plain" onClick={() => void stop(true)}><Icon name="pause" size={16} />Tắt chia sẻ vị trí</button>
                : <button type="button" className="btn" onClick={start}><Icon name="navigation" size={16} />{going ? "Bắt đầu đi đón — chia sẻ vị trí" : "Chia sẻ vị trí khi đưa bé về"}</button>)}
              {!going && !d.droppedAt && (
                <ActionForm action={arriveDropAction} className="inline">
                  <input type="hidden" name="id" value={requestId} />
                  <SubmitButton className={`btn ${d.nearDrop || !d.drop?.lat ? "btn-ok" : "btn-ghost"}`}><Icon name="home" size={16} />Đã đưa bé tới nơi</SubmitButton>
                </ActionForm>
              )}
              {going && !d.arrivedAt && d.canShare && (
                <ActionForm action={arriveGateAction} className="inline">
                  <input type="hidden" name="id" value={requestId} />
                  <SubmitButton className={`btn ${d.nearGate ? "btn-ok" : "btn-ghost"}`}><Icon name="mapPin" size={16} />Tôi đã tới cổng</SubmitButton>
                </ActionForm>
              )}
            </div>
            <p className="small muted mt-10">Chỉ phụ huynh của bé và cô giáo lớp thấy vị trí của bạn. Hệ thống chỉ giữ điểm mới nhất và xoá ngay khi bé về an toàn.</p>
          </>
        ) : (
          <p className="small muted mb-0">Vị trí do người đón tự bật chia sẻ, tự cập nhật mỗi 10 giây. Chỉ phụ huynh và cô giáo lớp xem được, xoá khi bé về an toàn.</p>
        )}
      </div>
    </section>
  );
}
