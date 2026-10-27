"use client";
// Ô khai điểm trả bé cho MỘT lần nhờ đón: chọn nhanh điểm đã lưu, gõ địa chỉ, ghim trên bản đồ (không bắt buộc).
// Gửi lên server qua các ô dropLabel / dropAddress / dropWard / dropLat / dropLng / savePlace.
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { DEFAULT_CENTER, pinIcon, TILES } from "./mapKit";

export type Place = { id: string; label: string; address: string; ward: string; lat: number | null; lng: number | null };
type Pin = { lat: number; lng: number } | null;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function DropPicker({ places, center, prefix = "drop" }: { places: Place[]; center: { lat: number; lng: number } | null; prefix?: string }) {
  const [fill, setFill] = useState<{ key: number; label: string; address: string; ward: string }>({ key: 0, label: "", address: "", ward: "" });
  const [chosen, setChosen] = useState<string | null>(null);
  const [pin, setPin] = useState<Pin>(null);
  const [showMap, setShowMap] = useState(false);
  const [err, setErr] = useState("");
  const [locating, setLocating] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ L: typeof import("leaflet"); map: LMap; marker?: Marker } | null>(null);
  const pinRef = useRef<Pin>(null);
  pinRef.current = pin;

  // ── Bản đồ: chỉ tạo khi mở ──
  useEffect(() => {
    if (!showMap) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || ctx.current) return;
      const start = pinRef.current ?? center ?? DEFAULT_CENTER;
      const m = L.map(box.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], pinRef.current ? 17 : 15);
      L.tileLayer(TILES.url, { ...TILES.opts, attribution: TILES.attribution }).addTo(m);
      m.on("click", (e) => setPin({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }));
      ctx.current = { L, map: m };
      drawPin(pinRef.current);
    })();
    return () => { cancelled = true; ctx.current?.map.remove(); ctx.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  function drawPin(p: Pin) {
    const c = ctx.current;
    if (!c) return;
    if (!p) { c.marker?.remove(); c.marker = undefined; return; }
    if (c.marker) c.marker.setLatLng([p.lat, p.lng]);
    else {
      c.marker = c.L.marker([p.lat, p.lng], { icon: pinIcon(c.L, "home"), draggable: true, title: "Điểm trả bé", keyboard: false }).addTo(c.map);
      c.marker.on("dragend", () => { const ll = c.marker!.getLatLng(); setPin({ lat: round(ll.lat), lng: round(ll.lng) }); });
    }
  }
  useEffect(() => { drawPin(pin); }, [pin]);

  const choose = (p: Place) => {
    setChosen(p.id);
    setFill({ key: fill.key + 1, label: p.label, address: p.address, ward: p.ward });
    const next = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;
    setPin(next);
    if (next) ctx.current?.map.setView([next.lat, next.lng], 17);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) { setErr("Máy này không hỗ trợ định vị."); return; }
    setErr(""); setLocating(true); setShowMap(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const next = { lat: round(p.coords.latitude), lng: round(p.coords.longitude) };
        setPin(next);
        ctx.current?.map.setView([next.lat, next.lng], 17);
      },
      (e) => { setLocating(false); setErr(e.code === e.PERMISSION_DENIED ? "Bạn chưa cho phép dùng vị trí. Hãy chạm vào bản đồ để ghim." : "Chưa lấy được vị trí. Hãy chạm vào bản đồ để ghim."); },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const id = (k: string) => `${prefix}-${k}`;
  return (
    <fieldset className="drop-picker">
      <legend>Trả bé ở đâu?</legend>
      {places.length > 0 && (
        <div className="chips" role="group" aria-label="Điểm trả đã lưu">
          {places.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={chosen === p.id} onClick={() => choose(p)}>
              <Icon name="home" size={16} />{p.label}
            </button>
          ))}
        </div>
      )}
      <div key={fill.key}>
        <div className="fields">
          <div className="field">
            <label htmlFor={id("label")}>Tên gọi</label>
            <input id={id("label")} name="dropLabel" type="text" maxLength={30} defaultValue={fill.label} placeholder="Nhà, Nhà bà ngoại…" onChange={() => setChosen(null)} />
          </div>
          <div className="field">
            <label htmlFor={id("ward")}>Phường/xã</label>
            <input id={id("ward")} name="dropWard" type="text" maxLength={60} defaultValue={fill.ward} placeholder="Ví dụ: Phường Ninh Kiều" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor={id("address")}>Số nhà, tên đường</label>
          <input id={id("address")} name="dropAddress" type="text" maxLength={200} defaultValue={fill.address} autoComplete="street-address" placeholder="Ví dụ: 25 Mậu Thân, hẻm 3" required />
        </div>
      </div>

      <input type="hidden" name="dropLat" value={pin?.lat ?? ""} />
      <input type="hidden" name="dropLng" value={pin?.lng ?? ""} />
      <div className="actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={locate} disabled={locating}>
          <Icon name="navigation" size={16} />{locating ? "Đang lấy vị trí…" : "Tôi đang ở đây"}
        </button>
        {!showMap && <button type="button" className="btn btn-plain btn-sm" onClick={() => setShowMap(true)}><Icon name="mapPin" size={16} />Ghim trên bản đồ</button>}
        {pin && <button type="button" className="btn btn-plain btn-sm" onClick={() => setPin(null)}><Icon name="x" size={16} />Bỏ ghim</button>}
      </div>
      {showMap && <div className="drop-map" ref={box} role="img" aria-label={pin ? "Bản đồ: đã ghim điểm trả bé" : "Bản đồ: chạm để ghim điểm trả bé"} />}
      {err && <p className="hint hint-error" role="alert">{err}</p>}
      <p className="hint">{pin ? "Đã ghim — kéo ghim nếu chưa đúng cổng nhà." : "Ghim giúp người đón tìm đúng cổng nhà (không bắt buộc)."} Cả nhóm lớp chỉ thấy phường/xã; số nhà chỉ cô giáo và người đón đã được duyệt thấy, tự xoá khi bé về.</p>
      <div className="checks mt-10">
        <label>
          <input type="checkbox" name="savePlace" value="1" />
          <span>Lưu điểm này để lần sau chọn nhanh</span>
        </label>
      </div>
    </fieldset>
  );
}
