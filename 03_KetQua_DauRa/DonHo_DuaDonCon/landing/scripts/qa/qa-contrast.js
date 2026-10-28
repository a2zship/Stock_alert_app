// Đo tương phản trên ĐIỂM ẢNH THẬT (kể cả chữ đè lên ảnh) ở mọi cảnh, 2 ngôn ngữ × 1440/375.
// Cách đo: ghi vị trí từng dòng chữ → ẩn chữ → chụp màn hình → tính tương phản giữa màu chữ và từng điểm ảnh nền,
// lấy phân vị 5% (vùng sáng nhất sau chữ). Chạy bằng Playwright MCP browser_run_code_unsafe, filename = file này.
// Lưu ý: lỗi ở "dialog" với dòng nằm sát mép dưới hộp là dòng bị che trong vùng cuộn của hộp → không phải lỗi thật.
async (page) => {
  const BASE = 'http://localhost:3276/'
  const browser = page.context().browser()
  const collect = (only) => {
    const out = []; const scope = only ? document.querySelector(only) : document.body
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT); const seen = new Set(); let n
    while ((n = w.nextNode())) {
      if (!n.textContent.trim()) continue; const el = n.parentElement
      if (!el || seen.has(el) || el.closest('.sr-only')) continue
      let vis = true, e = el
      while (e) { const c = getComputedStyle(e); if (c.visibility === 'hidden' || c.display === 'none' || parseFloat(c.opacity) < 0.95) { vis = false; break } e = e.parentElement }
      if (!vis) continue
      const range = document.createRange(); range.selectNodeContents(n)
      const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth)
      if (!rects.length) continue; seen.add(el); const cs = getComputedStyle(el)
      out.push({ text: n.textContent.trim().slice(0, 30), color: cs.color, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight), rects: rects.map((r) => [r.left, r.top, r.right, r.bottom]) })
    }
    return out
  }
  const analyze = async ({ b64, items }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0)
    const sx = img.width / innerWidth
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return items.map((it) => {
      const m = it.color.match(/[\d.]+/g).map(Number); const Lt = L(m[0], m[1], m[2]); const cons = []
      for (const [x0, y0, x1, y1] of it.rects) {
        const d = cx.getImageData(Math.floor(x0 * sx), Math.floor(y0 * sx), Math.max(1, Math.floor((x1 - x0) * sx)), Math.max(1, Math.floor((y1 - y0) * sx))).data
        for (let i = 0; i < d.length; i += 16) { const Lb = L(d[i], d[i + 1], d[i + 2]); cons.push((Math.max(Lt, Lb) + 0.05) / (Math.min(Lt, Lb) + 0.05)) }
      }
      cons.sort((a, b) => a - b)
      const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 600)
      return { t: it.text, p05: Math.round((cons[Math.floor(cons.length * 0.05)] ?? 21) * 100) / 100, need: large ? 3 : 4.5 }
    })
  }
  const fails = []; let lines = 0
  for (const lng of ['vi', 'en']) for (const [w, h] of [[1440, 900], [375, 812]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage()
    await p.goto(`${BASE}?lang=${lng}`); await p.waitForTimeout(3000)
    const snap = async (name, only) => {
      await p.waitForTimeout(1500)
      const items = await p.evaluate(collect, only)
      await p.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}' })
      const b64 = (await p.screenshot()).toString('base64')
      await p.evaluate(() => [...document.querySelectorAll('style')].pop().remove())
      const res = await p.evaluate(analyze, { b64, items }); lines += res.length
      res.forEach((r) => { if (r.p05 < r.need) fails.push(`${lng}-${w} ${name} | ${r.t} | ${r.p05} < ${r.need}`) })
    }
    await snap('intro')
    const n = await p.locator('.dots a').count()
    for (let i = 1; i < n; i++) { await p.evaluate((i) => document.querySelectorAll('.dots a')[i].click(), i); await p.waitForTimeout(1200); await snap('dot' + i) }
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await snap('bottom')
    await p.evaluate((i) => document.querySelectorAll('.dots a')[i].click(), n - 2); await p.waitForTimeout(1500)
    if (await p.evaluate(() => !!document.querySelector('.card-open'))) { await p.evaluate(() => document.querySelector('.card-open').click()); await snap('dialog', '.unit-dialog') }
    await ctx.close()
  }
  return { lines, failCount: fails.length, fails: fails.slice(0, 50) }
}
