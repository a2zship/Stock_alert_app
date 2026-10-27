// Dùng chung cho các bản đồ Leaflet: nền bản đồ + ghim SVG cùng bộ icon của app (không dùng ảnh/emoji).

// Nền bản đồ OSM France (kiểu HOT, dữ liệu OpenStreetMap) — chỉ cho bản mẫu.
// Dùng thật ở quy mô lớn cần nhà cung cấp bản đồ có hợp đồng/khoá riêng — xem README.
export const TILES = {
  url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  attribution: "© Người đóng góp OpenStreetMap · OSM France",
  opts: { maxZoom: 19, subdomains: "abc", referrerPolicy: "strict-origin" as const }, // chỉ gửi tên miền, không lộ đường dẫn chứa mã yêu cầu
};

/** Tâm mặc định khi trường chưa có toạ độ (Cần Thơ). */
export const DEFAULT_CENTER = { lat: 10.0341, lng: 105.7852 };

const PIN = {
  school: '<path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5"/>',
  person: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5M5 9v12h14V9M9 21v-6h6v6"/>',
};
export type PinKind = keyof typeof PIN;

export const pinHtml = (kind: PinKind) =>
  `<span class="pin-mark pin-${kind}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PIN[kind]}</svg></span>`;

export const pinIcon = (L: typeof import("leaflet"), kind: PinKind) =>
  L.divIcon({ className: "pin-wrap", html: pinHtml(kind), iconSize: [36, 36], iconAnchor: [18, 36] });
