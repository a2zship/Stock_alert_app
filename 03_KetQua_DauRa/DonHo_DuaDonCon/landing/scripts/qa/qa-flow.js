// Kiểm tra chức năng trên BẢN BUILD (npm run preview). Chạy bằng Playwright MCP:
//   browser_run_code_unsafe  với  filename = <skill>/scripts/qa/qa-flow.js
// Sửa BASE nếu cổng preview khác. Mỗi phần dùng context mới (tránh trình duyệt khôi phục vị trí cuộn cũ).
async (page) => {
  const BASE = 'http://localhost:3276/'
  const browser = page.context().browser()
  const out = {}
  for (const lng of ['vi', 'en']) for (const [w, h] of [[1440, 900], [375, 812]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    const errors = []
    p.on('pageerror', (e) => errors.push(String(e)))
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
    await p.goto(`${BASE}?lang=${lng}`); await p.waitForTimeout(2500)
    const r = { errors }
    // 1. lăn chuột → phim được dựng, cửa mở
    await p.mouse.move(w / 2, h / 2)
    for (let k = 0; k < 4; k++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(200) }
    await p.waitForTimeout(1000)
    r.pinned = await p.evaluate(() => !!document.querySelector('.pin-spacer'))
    // 2. chấm mục lục → đúng cảnh
    const n = await p.locator('.dots a').count()
    const seq = []
    for (let i = 1; i < n - 2; i++) {
      await p.evaluate((i) => document.querySelectorAll('.dots a')[i].click(), i)
      await p.waitForTimeout(2300)
      seq.push(await p.evaluate(() => [...document.querySelectorAll('.film .scene')].filter((s) => getComputedStyle(s).visibility !== 'hidden' && +getComputedStyle(s).opacity > 0.5).map((s) => s.id).join('+')))
    }
    r.scenes = seq
    // 3. nút trong cảnh danh mục đầu → danh sách lọc đúng
    await p.evaluate(() => document.querySelector('.s-type [data-filter-type]').click()); await p.waitForTimeout(2000)
    r.filter = await p.evaluate(() => ({ q: location.search, cards: document.querySelectorAll('.card-open').length, count: document.querySelector('.count').textContent }))
    // 4. hộp chi tiết → đặt lịch điền sẵn
    if (r.filter.cards) {
      await p.evaluate(() => document.querySelector('.card-open').click()); await p.waitForTimeout(500)
      r.dialogOpen = await p.evaluate(() => document.querySelector('.unit-dialog').open)
      await p.evaluate(() => document.querySelector('[data-book]').click()); await p.waitForTimeout(1600)
      r.prefill = await p.evaluate(() => ({ unit: document.querySelector('#f-unit').value, focus: document.activeElement.id }))
    }
    // 5. form: số quốc tế hợp lệ, số sai báo lỗi
    await p.fill('#f-name', 'Test User'); await p.fill('#f-phone', '+44 7700 900123')
    await p.fill('#f-date', new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10))
    await p.evaluate(() => document.querySelector('form.form button[type=submit]').click()); await p.waitForTimeout(300)
    r.formOk = await p.evaluate(() => !document.querySelector('.err:not(:empty)') && !!document.querySelector('.form-status').textContent)
    // 6. nút nổi ẩn ở cuối trang; không tràn ngang
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(1200)
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(600)
    r.jumpHiddenAtEnd = await p.evaluate(() => getComputedStyle(document.querySelector('.jump')).visibility === 'hidden')
    r.overflowX = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) // <= 0 là đạt (-15 = thanh cuộn)
    out[`${lng}-${w}`] = r
    await ctx.close()
  }
  // 7. link đã lọc mở thẳng danh sách; đổi ngôn ngữ giữ bộ lọc
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
    const cat = await (async () => { await p.goto(BASE); await p.waitForTimeout(1500); return p.evaluate(() => document.querySelector('.s-type').dataset.type) })()
    await p.goto(`${BASE}?lang=vi&cat=${cat}`); await p.waitForTimeout(3500)
    out.deepLink = await p.evaluate(() => Math.abs(document.getElementById('catalog').getBoundingClientRect().top) < 5)
    await p.evaluate(() => document.querySelector('.lang a:not([aria-current])').click()); await p.waitForLoadState('load'); await p.waitForTimeout(2500)
    out.langSwitchKeepsFilter = await p.evaluate((cat) => location.search.includes(`cat=${cat}`) && document.documentElement.lang === 'en', cat)
    await ctx.close()
  }
  // 8. reduced-motion + skip link
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' }); const p = await ctx.newPage()
    await p.goto(BASE); await p.waitForTimeout(2000)
    out.reduced = await p.evaluate(() => ({ film: document.documentElement.classList.contains('is-film'), pinned: !!document.querySelector('.pin-spacer'), overflowX: document.documentElement.scrollWidth - innerWidth }))
    await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(600)
    out.skipLink = await p.evaluate(() => document.activeElement.id === 'catalog')
    await ctx.close()
  }
  return out
}
