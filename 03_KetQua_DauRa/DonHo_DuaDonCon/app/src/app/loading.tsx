// Khung chờ khi trang đang tải — giữ chỗ để không bị nhảy bố cục.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      <div className="skeleton" style={{ height: 32, width: 220, marginBottom: 20 }} />
      <div className="skeleton" style={{ height: 140, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 240 }} />
    </div>
  );
}
