import { describe, expect, it } from "vitest";
import { hashCode, newPin, newToken, sameHash } from "@/domain/codes";
import { canSeeDropAddress, parseDrop, showDrop } from "@/domain/drop";
import { firstDay, monthOptions, parseMonthFee, parseWeekdays, refundableDays, refundOf, scheduleDays, weekdayOf } from "@/domain/monthly";
import { maskPhone, normalizePhone } from "@/domain/phone";
import { parseDataUrl, sniffImage } from "@/domain/photo";
import { codeUsableAt, STATUSES, STATUS_LABEL, transition, TransitionError } from "@/domain/state";
import { addDays, vnDateTime, vnToday } from "@/domain/time";
import { readSession, signSession } from "@/lib/session";
import { msgHelpers, msgParents, normSchoolName, nudgeDue, parseClass, schoolStage } from "@/domain/sales";
import { seal, unseal } from "@/server/seal";

describe("máy trạng thái", () => {
  it("đi đúng luồng 3 bên: nhận lời → duyệt → giao → xác nhận", () => {
    let s = transition("CHO_NGUOI_DON", "NGUOI_DON_NHAN", "NGUOI_DON");
    s = transition(s, "GV_DUYET", "GIAO_VIEN");
    s = transition(s, "GIAO_TRE", "GIAO_VIEN");
    expect(transition(s, "PH_XAC_NHAN_VE", "PHU_HUYNH")).toBe("HOAN_TAT");
  });

  it("không cho giáo viên duyệt khi người đón chưa nhận lời", () => {
    expect(() => transition("CHO_NGUOI_DON", "GV_DUYET", "GIAO_VIEN")).toThrow(TransitionError);
  });

  it("không cho giao trẻ khi chưa được duyệt hoặc đã bị khoá/huỷ", () => {
    for (const s of ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "BI_KHOA", "DA_HUY", "HET_HAN"] as const) {
      expect(() => transition(s, "GIAO_TRE", "GIAO_VIEN")).toThrow(TransitionError);
    }
  });

  it("chặn sai vai trò: phụ huynh không tự duyệt, người đón không tự giao", () => {
    expect(() => transition("CHO_GIAO_VIEN", "GV_DUYET", "PHU_HUYNH")).toThrow(/Vai trò/);
    expect(() => transition("DA_DUYET", "GIAO_TRE", "NGUOI_DON")).toThrow(/Vai trò/);
  });

  it("phụ huynh huỷ được trước khi giao, không huỷ được sau khi giao", () => {
    for (const s of ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET", "BI_KHOA"] as const) expect(transition(s, "PH_HUY", "PHU_HUYNH")).toBe("DA_HUY");
    expect(() => transition("DA_GIAO", "PH_HUY", "PHU_HUYNH")).toThrow(TransitionError);
  });

  it("mọi trạng thái đều có nhãn hiển thị", () => {
    for (const s of STATUSES) expect(STATUS_LABEL[s].label.length).toBeGreaterThan(3);
  });

  it("mã chỉ dùng từ 30 phút trước giờ đón tới hết khung giờ", () => {
    const start = vnDateTime("2026-11-02", "16:30");
    const end = vnDateTime("2026-11-02", "17:30");
    expect(codeUsableAt(vnDateTime("2026-11-02", "15:59"), start, end)).toBe(false);
    expect(codeUsableAt(vnDateTime("2026-11-02", "16:00"), start, end)).toBe(true);
    expect(codeUsableAt(vnDateTime("2026-11-02", "17:30"), start, end)).toBe(true);
    expect(codeUsableAt(vnDateTime("2026-11-02", "17:31"), start, end)).toBe(false);
  });
});

describe("số điện thoại", () => {
  it("chuẩn hoá +84 / 84 / có dấu cách", () => {
    expect(normalizePhone("+84 901 234 567")).toBe("0901234567");
    expect(normalizePhone("84901234567")).toBe("0901234567");
    expect(normalizePhone("0901.234.567")).toBe("0901234567");
  });
  it("từ chối số sai", () => {
    expect(normalizePhone("0123")).toBeNull();
    expect(normalizePhone("0201234567")).toBeNull();
  });
  it("che bớt số", () => expect(maskPhone("0901234567")).toBe("0901***567"));
});

describe("giờ Việt Nam", () => {
  it("16:30 giờ VN là 09:30 UTC", () => expect(vnDateTime("2026-10-27", "16:30").toISOString()).toBe("2026-10-27T09:30:00.000Z"));
  it("23:30 UTC đã là ngày hôm sau ở VN", () => expect(vnToday(new Date("2026-10-27T23:30:00Z"))).toBe("2026-10-28"));
  it("cộng ngày qua cuối tháng", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
});

describe("mã đón, niêm phong, phiên", () => {
  const secret = "x".repeat(40);
  it("PIN luôn 6 số, token đủ dài và không trùng", () => {
    for (let i = 0; i < 50; i++) expect(newPin()).toMatch(/^\d{6}$/);
    expect(newToken()).not.toBe(newToken());
    expect(newToken().length).toBeGreaterThanOrEqual(32);
  });
  it("băm theo mục đích: cùng PIN nhưng khác yêu cầu → khác bản băm", () => {
    expect(sameHash(hashCode(secret, "pin:a", "123456"), hashCode(secret, "pin:a", "123456"))).toBe(true);
    expect(sameHash(hashCode(secret, "pin:a", "123456"), hashCode(secret, "pin:b", "123456"))).toBe(false);
  });
  it("niêm phong mở lại được, sửa một ký tự là hỏng", () => {
    const s = seal(secret, { token: "t", pin: "123456" });
    expect(unseal(secret, s)).toEqual({ token: "t", pin: "123456" });
    expect(unseal(secret, s.slice(0, -2) + (s.endsWith("A") ? "BB" : "AA"))).toBeNull();
    expect(unseal("y".repeat(40), s)).toBeNull();
  });
  it("phiên đăng nhập: đúng chữ ký, hết hạn, giả mạo userId", async () => {
    const tok = await signSession(secret, "abc123", Date.now() + 60_000);
    expect(await readSession(secret, tok)).toBe("abc123");
    expect(await readSession(secret, tok, Date.now() + 120_000)).toBeNull();
    expect(await readSession(secret, tok.replace("abc123", "evil99"))).toBeNull();
    expect(await readSession(undefined, tok)).toBeNull();
  });
});

describe("ảnh tải lên", () => {
  it("nhận diện PNG/JPEG theo chữ ký tệp", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
  });
  it("từ chối tệp đội lốt ảnh", () => {
    const fake = `data:image/png;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`;
    expect(parseDataUrl(fake)).toHaveProperty("error");
    expect(parseDataUrl("data:image/svg+xml;base64,AAAA")).toHaveProperty("error");
  });
});

describe("bản đồ: khoảng cách + thời gian", async () => {
  const { distanceM, etaMinutes, showDistance, validLatLng } = await import("@/domain/geo");
  it("haversine đúng bậc độ lớn, ETA ≥ 1 phút", () => {
    const d = distanceM({ lat: 10.0341, lng: 105.7852 }, { lat: 10.0431, lng: 105.7852 }); // ~1 km theo vĩ độ
    expect(d).toBeGreaterThan(990);
    expect(d).toBeLessThan(1010);
    expect(etaMinutes(0)).toBe(1);
    expect(etaMinutes(1000)).toBe(4);
    expect(showDistance(840)).toBe("840 m");
    expect(showDistance(2350)).toBe("2,4 km");
    expect(validLatLng(10, 105)).toBe(true);
    expect(validLatLng(91, 105)).toBe(false);
    expect(validLatLng(Number.NaN, 105)).toBe(false);
  });
});

describe("điểm tương trợ", async () => {
  const { computeReward } = await import("@/domain/reward");
  const p = (replyMinutes: number | null, thanked = false) => ({ completedAt: new Date(), replyMinutes, thanked });
  it("chưa đón lần nào → hạng đầu, chưa có huy hiệu", () => {
    const r = computeReward([]);
    expect(r.points).toBe(0);
    expect(r.tier.key).toBe("dong-hanh");
    expect(r.badges.every((b) => !b.earned)).toBe(true);
    expect(r.unlocked("tin-cay")).toBe(false);
  });
  it("cộng điểm đón + phản hồi nhanh + lời cảm ơn, lên hạng khi đủ mốc", () => {
    const r = computeReward([p(3, true), p(5, true), p(30)]);
    expect(r.points).toBe(3 * 10 + 2 * 5 + 2 * 2);
    expect(r.tier.key).toBe("tin-cay");
    expect(r.next?.key).toBe("dai-su");
    expect(r.progress).toBeGreaterThan(0);
    expect(r.badges.find((b) => b.key === "lan-dau")?.earned).toBe(true);
    expect(r.badges.find((b) => b.key === "nhanh")?.earned).toBe(false);
  });
});

describe("điểm trả bé", () => {
  it("bỏ trống = chưa khai; khai thì cần địa chỉ + phường/xã; ghim phải đủ cặp toạ độ hợp lệ", () => {
    expect(parseDrop({})).toBeNull();
    expect(parseDrop({ label: "", address: " ", ward: "", lat: "", lng: "" })).toBeNull();
    expect(parseDrop({ address: "12 Lê Lợi" })).toMatchObject({ error: expect.stringMatching(/phường/) });
    expect(parseDrop({ ward: "Phường An Hòa" })).toMatchObject({ error: expect.stringMatching(/số nhà/) });
    expect(parseDrop({ address: "12 Lê Lợi", ward: "Phường An Hòa", lat: "10.03" })).toMatchObject({ error: expect.stringMatching(/không hợp lệ/) });
    expect(parseDrop({ address: "12  Lê Lợi", ward: "Phường An Hòa", lat: "10.03", lng: "105.78" }))
      .toEqual({ label: "Điểm trả", address: "12 Lê Lợi", ward: "Phường An Hòa", lat: 10.03, lng: 105.78 });
    expect(showDrop({ address: "12 Lê Lợi", ward: "Phường An Hòa" })).toBe("12 Lê Lợi, Phường An Hòa");
  });

  it("người đón chỉ thấy địa chỉ sau khi được duyệt", () => {
    const delegate = { guardian: false, teacher: false, delegate: true };
    expect(canSeeDropAddress("CHO_NGUOI_DON", delegate)).toBe(false);
    expect(canSeeDropAddress("CHO_GIAO_VIEN", delegate)).toBe(false);
    expect(canSeeDropAddress("DA_DUYET", delegate)).toBe(true);
    expect(canSeeDropAddress("DA_GIAO", delegate)).toBe(true);
    expect(canSeeDropAddress("CHO_NGUOI_DON", { guardian: false, teacher: true, delegate: false })).toBe(true);
    expect(canSeeDropAddress("DA_GIAO", { guardian: false, teacher: false, delegate: false })).toBe(false);
  });
});

describe("đón có phí: VietQR + thù lao", async () => {
  const { crc16, transferNote, vietQr } = await import("@/domain/vietqr");
  const { commissionOf, parseFee, parsePay } = await import("@/domain/money");
  it("CRC16-CCITT-FALSE đúng giá trị chuẩn", () => expect(crc16("123456789")).toBe("29B1"));
  it("mã VietQR có đủ trường NAPAS, số tiền, nội dung không dấu và CRC khớp", () => {
    const q = vietQr({ bin: "970436", account: "0123456789", amount: 50000, note: "Đón hộ bé" });
    expect(q.startsWith("000201010212")).toBe(true);
    expect(q).toContain("A000000727");
    expect(q).toContain("970436");
    expect(q).toContain("0123456789");
    expect(q).toContain("QRIBFTTA");
    expect(q).toContain("5303704540550000");
    expect(q).toContain("DON HO BE");
    expect(q.slice(-4)).toBe(crc16(q.slice(0, -4)));
    expect(transferNote("Đinh   Thị Ánh-Ngọc!!")).toBe("DINH THI ANH NGOC");
  });
  it("thù lao: bỏ trống = miễn phí; ngoài khoảng hoặc lẻ nghìn thì báo lỗi; phí làm tròn nghìn", () => {
    expect(parseFee("")).toBeNull();
    expect(parseFee("50.000")).toBe(50000);
    expect(parseFee("10000")).toHaveProperty("error");
    expect(parseFee("500000")).toHaveProperty("error");
    expect(parseFee("50500")).toHaveProperty("error");
    expect(parseFee("abc")).toHaveProperty("error");
    expect(commissionOf(50000)).toBe(5000);
    expect(commissionOf(35000)).toBe(4000);
    expect(commissionOf(35000, 0.15)).toBe(5000);
  });
  it("số tiền cảm ơn: trống = mức tối thiểu; không thấp hơn mức đã hứa; chặn gõ thừa số 0", () => {
    expect(parsePay("", 50000)).toBe(50000);
    expect(parsePay("70.000", 50000)).toBe(70000);
    expect(parsePay("40000", 50000)).toHaveProperty("error");
    expect(parsePay("5000000", 50000)).toHaveProperty("error");
    expect(parsePay("70500", 50000)).toHaveProperty("error");
  });
});

describe("thành viên ưu đãi", async () => {
  const { addMonths, jobRate, priceOf, rateOf, startOfNew, tierInfo } = await import("@/domain/membership");
  it("giá: 12 tháng tính 10 tháng; phí không vượt mức gốc của nền tảng", () => {
    expect(priceOf("VANG", 1)).toBe(69_000);
    expect(priceOf("VANG", 12)).toBe(690_000);
    expect(rateOf(tierInfo("VANG"), 0.1)).toBe(0.05);
    expect(rateOf(tierInfo("BAC"), 0.04)).toBe(0.04);
  });
  it("phí một lượt có phí = mức thấp hơn của người đón và người nhờ", () => {
    expect(jobRate(tierInfo("THUONG"), tierInfo("THUONG"), 0.1)).toBe(0.1);
    expect(jobRate(tierInfo("THUONG"), tierInfo("KIM_CUONG"), 0.1)).toBe(0.03);
    expect(jobRate(tierInfo("VANG"), tierInfo("BAC"), 0.1)).toBe(0.05);
  });
  it("gia hạn cùng hạng nối tiếp; nâng hạng bắt đầu ngay; hạ hạng chờ gói cao hết hạn", () => {
    const now = new Date("2026-10-27T00:00:00Z");
    const bac = { tier: "BAC", endsAt: addMonths(now, 1) };
    expect(startOfNew([bac], "BAC", now)).toEqual(bac.endsAt);
    expect(startOfNew([bac], "VANG", now)).toEqual(now);
    const vang = { tier: "VANG", endsAt: addMonths(now, 12) };
    expect(startOfNew([vang], "BAC", now)).toEqual(vang.endsAt);
    expect(startOfNew([], "KIM_CUONG", now)).toEqual(now);
  });
});

describe("đón theo tháng", () => {
  it("lịch buổi: đúng thứ trong tuần, tháng này chỉ từ ngày mai", () => {
    expect(weekdayOf("2026-11-02")).toBe(1); // Thứ Hai
    const nov = scheduleDays("2026-11", [1, 3, 5], "2026-11-01");
    expect(nov).toHaveLength(13);
    expect(nov[0]).toBe("2026-11-02");
    expect(nov.every((d) => [1, 3, 5].includes(weekdayOf(d)))).toBe(true);
    const now = vnDateTime("2026-10-27", "10:00");
    expect(monthOptions(now)).toEqual(["2026-10", "2026-11"]);
    expect(monthOptions(vnDateTime("2026-12-05", "10:00"))).toEqual(["2026-12", "2027-01"]);
    expect(firstDay("2026-10", now)).toBe("2026-10-28");
    expect(firstDay("2026-11", now)).toBe("2026-11-01");
    expect(parseWeekdays(["1", "1", "7", "3"])).toEqual([1, 3]);
    expect(parseWeekdays([])).toHaveProperty("error");
  });

  it("trọn gói tối thiểu 20.000đ mỗi buổi; hoàn tiền theo tỉ lệ buổi không đón", () => {
    expect(parseMonthFee("400.000", 20)).toBe(400_000);
    expect(parseMonthFee("399000", 20)).toHaveProperty("error");
    expect(parseMonthFee("400500", 20)).toHaveProperty("error");
    expect(parseMonthFee("", 20)).toHaveProperty("error");
    expect(refundOf(600_000, 20, 5)).toBe(150_000);
    expect(refundOf(500_000, 3, 1)).toBe(167_000); // làm tròn nghìn
    expect(refundOf(600_000, 20, 99)).toBe(600_000);
    const days = ["d1", "d2", "d3", "d4", "d5", "d6"];
    // người đón dừng sau d2: hoàn d3..d6 + buổi đã nghỉ d1
    expect(refundableDays({ days, missed: ["d1"], endDate: "d2", by: "NGUOI_DON" })).toBe(5);
    // phụ huynh dừng sau d2: 4 buổi còn lại trừ 2 buổi báo trước
    expect(refundableDays({ days, missed: [], endDate: "d2", by: "PHU_HUYNH" })).toBe(2);
    expect(refundableDays({ days, missed: [], endDate: "d5", by: "PHU_HUYNH" })).toBe(0);
    expect(refundableDays({ days, missed: ["d4"], endDate: null, by: "HE_THONG" })).toBe(1);
  });
});

describe("khu vực đăng ký", () => {
  it("tỉnh bắt buộc; phường/xã chọn hoặc gõ tay có tiền tố; trường không bắt buộc", async () => {
    const { parseArea, parseChild, parseName } = await import("@/domain/area");
    expect(parseArea({})).toEqual({ error: expect.stringMatching(/tỉnh/) });
    expect(parseArea({ provinceId: "6", wardId: "12" })).toEqual({ provinceId: 6, wardId: 12, wardName: null, schoolId: null, schoolName: null });
    expect(parseArea({ provinceId: "6", wardId: "khac", wardName: "  xã   Mỹ Khánh " })).toMatchObject({ wardId: null, wardName: "Xã Mỹ Khánh" });
    expect(parseArea({ provinceId: "6", wardId: "khac", wardName: "Mỹ Khánh" })).toHaveProperty("error");
    expect(parseArea({ provinceId: "6", wardId: "khac", wardName: "Xã Mỹ Khánh", schoolId: "s1" })).toHaveProperty("error");
    expect(parseArea({ provinceId: "6", wardId: "3", schoolId: "khac", schoolName: "Trường MN Hoa Mai" })).toMatchObject({ schoolId: null, schoolName: "Trường MN Hoa Mai" });
    expect(parseChild({})).toBeNull();
    expect(parseChild({ classId: "c1", studentName: "An", relation: "Mẹ" })).toHaveProperty("error");
    expect(parseChild({ classId: "c1", studentName: "Lê Minh An", relation: "Chú" })).toHaveProperty("error");
    expect(parseChild({ classId: "c1", studentName: "Lê  Minh An", relation: "Mẹ" })).toEqual({ classId: "c1", studentName: "Lê Minh An", relation: "Mẹ" });
    expect(parseName("Mai")).toHaveProperty("error");
  });
});

describe("vòng phát lời nhờ", () => {
  it("càng gần giờ đón càng mở rộng nhanh; có người nhận hoặc qua giờ thì dừng; có thù lao dừng ở trường", async () => {
    const { dueEscalation, nextScope, stepMinutes } = await import("@/domain/ask");
    expect([stepMinutes(8 * 60), stepMinutes(3 * 60), stepMinutes(30)]).toEqual([30, 15, 5]);
    expect(nextScope("LOP")).toBe("TRUONG");
    expect(nextScope("TRUONG", 50000)).toBeNull();
    const start = new Date("2030-01-02T09:30:00Z");
    const base = { scope: "LOP" as const, scopeAt: new Date("2030-01-02T07:00:00Z"), offers: 0, pickupStart: start, pickupEnd: new Date("2030-01-02T10:30:00Z") };
    expect(dueEscalation(base, new Date("2030-01-02T07:10:00Z"))).toBeNull(); // còn 140 phút → bước 15, mới chờ 10
    expect(dueEscalation(base, new Date("2030-01-02T07:16:00Z"))).toBe("TRUONG");
    expect(dueEscalation({ ...base, offers: 1 }, new Date("2030-01-02T09:00:00Z"))).toBeNull();
    expect(dueEscalation(base, new Date("2030-01-02T10:31:00Z"))).toBeNull();
  });
});

describe("giới thiệu & chia sẻ doanh thu", async () => {
  const { splitShares, proRata, evenSplit, payableFrom, isPayable, parseRefCode, refActive, canClaimRef } = await import("@/domain/share");
  const part = (base: number, teacherIds: string[], teacherShare = true) => ({ base, classId: "c", schoolId: "s", teacherIds, teacherShare });

  it("chia: giới thiệu 20% trên tổng, trường 10%, cô 5% chia đều; không cô hoặc trường tắt thì gộp về trường", () => {
    expect(splitShares([part(39000, ["a", "b"])], "r").map((l) => [l.kind, l.userId ?? l.schoolId, l.amount]))
      .toEqual([["GIOI_THIEU", "r", 7800], ["TRUONG", "s", 3900], ["GIAO_VIEN", "a", 975], ["GIAO_VIEN", "b", 975]]);
    expect(splitShares([part(1000, ["a", "b", "c"])], null).filter((l) => l.kind === "GIAO_VIEN").reduce((s, l) => s + l.amount, 0)).toBe(50);
    expect(splitShares([part(39000, [])], null).map((l) => [l.kind, l.amount])).toEqual([["TRUONG", 5850]]);
    expect(splitShares([part(39000, ["a"], false)], null).map((l) => [l.kind, l.amount])).toEqual([["TRUONG", 5850]]);
    expect(splitShares([part(0, ["a"])], "r")).toEqual([]);
  });

  it("chia tiền mặt theo tỉ lệ / chia đều: tổng luôn khớp", () => {
    expect(proRata([6000, 3000], 6000)).toEqual([4000, 2000]);
    expect(proRata([1, 1, 1], 100).reduce((s, x) => s + x, 0)).toBe(100);
    expect(proRata([5000], 0)).toEqual([0]);
    expect(evenSplit(39000, 2)).toEqual([19500, 19500]);
    expect(evenSplit(10, 3)).toEqual([4, 3, 3]);
  });

  it("hạn chuyển, mã, 12 tháng, 7 ngày", () => {
    expect(payableFrom("2026-10")).toBe("2026-11-08");
    expect(payableFrom("2026-12")).toBe("2027-01-08");
    expect(isPayable("2026-10", new Date("2026-11-07T12:00:00+07:00"))).toBe(false);
    expect(isPayable("2026-10", new Date("2026-11-08T00:30:00+07:00"))).toBe(true);
    expect(parseRefCode(" ab12-cd ")).toBe("AB12CD");
    expect(parseRefCode("")).toBeNull();
    expect(parseRefCode("ABC")).toMatchObject({ error: expect.any(String) });
    const at = new Date("2026-01-15T00:00:00Z");
    expect(refActive(at, new Date("2027-01-14T00:00:00Z"))).toBe(true);
    expect(refActive(at, new Date("2027-01-16T00:00:00Z"))).toBe(false);
    expect(refActive(null, at)).toBe(false);
    expect(canClaimRef(at, new Date("2026-01-21T00:00:00Z"))).toBe(true);
    expect(canClaimRef(at, new Date("2026-01-23T00:00:00Z"))).toBe(false);
  });
});

describe("phễu tự bán", () => {
  it("bước của trường xét lần lượt: chưa qua bước trước thì không tính bước sau", () => {
    const c = { teachers: 0, parents: 0, helpers: 0, pickups: 0, revenue: 0 };
    expect(schoolStage(c)).toBe("MOI_DANG_KY");
    expect(schoolStage({ ...c, teachers: 1 })).toBe("CO_CO_GIAO");
    expect(schoolStage({ ...c, teachers: 1, parents: 5 })).toBe("CO_PHU_HUYNH");
    expect(schoolStage({ ...c, teachers: 1, parents: 5, helpers: 2 })).toBe("CO_NGUOI_DON");
    expect(schoolStage({ ...c, teachers: 1, parents: 5, helpers: 2, pickups: 1, revenue: 900 })).toBe("CO_DOANH_THU");
    // có lượt đón nhưng chưa đủ người đón: vẫn ở bước người đón
    expect(schoolStage({ ...c, teachers: 1, parents: 9, helpers: 1, pickups: 4, revenue: 900 })).toBe("CO_PHU_HUYNH");
  });

  it("khớp tên trường phụ huynh gõ: bỏ dấu, chữ thường, bỏ chữ trường, MN/TH viết tắt", () => {
    expect(normSchoolName("Trường Mầm non Hướng Dương")).toBe("mam non huong duong");
    expect(normSchoolName("MN  Hướng Dương")).toBe("mam non huong duong");
    expect(normSchoolName("TH Lê Lợi")).toBe(normSchoolName("Trường Tiểu học Lê Lợi"));
    expect(normSchoolName("Mầm non Đông Hải")).not.toBe(normSchoolName("Mầm non Hải Đông"));
  });

  it("nhắc việc: tối đa 3 lần, cách nhau ≥ 7 ngày", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
    expect(nudgeDue([], now)).toBe(true);
    expect(nudgeDue([ago(6)], now)).toBe(false);
    expect(nudgeDue([ago(7)], now)).toBe(true);
    expect(nudgeDue([ago(30), ago(20), ago(10)], now)).toBe(false);
  });

  it("lớp: tên và giờ đón hợp lệ; tin mẫu có đường dẫn và tên lớp", () => {
    expect(parseClass({ name: " Lá  1 ", pickupStart: "16:30", pickupEnd: "17:30" })).toEqual({ name: "Lá 1", pickupStart: "16:30", pickupEnd: "17:30" });
    expect(parseClass({ name: "Lá 1", pickupStart: "16:30", pickupEnd: "16:30" })).toHaveProperty("error");
    expect(parseClass({ name: "Lá 1", pickupStart: "25:00", pickupEnd: "26:00" })).toHaveProperty("error");
    const p = { school: "Trường Mầm non Hoa Mai", cls: "Lá 1", url: "https://donho.vn/dang-ky?lop=abc" };
    for (const m of [msgParents(p), msgHelpers(p)]) { expect(m).toContain(p.url); expect(m).toContain("Lá 1"); }
  });
});
