// Chụp mọi cảnh (theo chấm mục lục) ở 1440 và 375, cả 2 ngôn ngữ → docs/qa/ của dự án.
// Sửa BASE và OUT (đường dẫn tuyệt đối, dùng dấu /). Playwright MCP browser_run_code_unsafe, filename = file này.
async (page) => {
  const BASE = 'http://localhost:3276/'
  const OUT = 'D:/Claude_Workspace/03_KetQua_DauRa/DonHo_DuaDonCon/landing/docs/qa/'
  const browser = page.context().browser()
  let count = 0
  for (const lng of ['vi', 'en']) for (const [w, h] of [[1440, 900], [375, 812]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage()
    await p.goto(`${BASE}?lang=${lng}`); await p.waitForTimeout(3000)
    const ids = await p.evaluate(() => [...document.querySelectorAll('.dots a')].map((a) => a.dataset.target))
    for (let i = 0; i < ids.length; i++) {
      if (i) { await p.evaluate((i) => document.querySelectorAll('.dots a')[i].click(), i); await p.waitForTimeout(2800) }
      await p.screenshot({ path: `${OUT}${lng}-${w}-${String(i + 1).padStart(2, '0')}-${ids[i]}.png` }); count++
    }
    await ctx.close()
  }
  return `${count} ảnh → ${OUT}`
}
