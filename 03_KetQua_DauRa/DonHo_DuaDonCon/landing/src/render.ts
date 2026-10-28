import { appLink, brand, categories, imageCaption, levels, scenes, terms, ui, type Category, type Img } from './content'

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const base = import.meta.env.BASE_URL + 'img/'

type PicOpts = { cls?: string; eager?: boolean; detail?: boolean }

/**
 * Ảnh nền: <name>-1920/-2560 (.avif/.webp) cho màn rộng, <name>-m cho điện thoại.
 * Ảnh cận: <name>-800 (.avif/.webp).
 * Ảnh không eager được giữ ở data-* và chỉ nạp khi sắp tới cảnh (xem loadImages trong main.ts).
 */
function picture(img: Img, { cls = '', eager = false, detail = false }: PicOpts = {}) {
  const p = base + img.src
  const set = (attr: string, v: string) => (eager ? `${attr}="${v}"` : `data-${attr}="${v}"`)
  const sources = detail
    ? `<source type="image/avif" ${set('srcset', `${p}-800.avif`)}>
       <source type="image/webp" ${set('srcset', `${p}-800.webp`)}>`
    : `<source media="(max-width: 767px)" type="image/avif" ${set('srcset', `${p}-m.avif`)}>
       <source media="(max-width: 767px)" type="image/webp" ${set('srcset', `${p}-m.webp`)}>
       <source type="image/avif" ${set('srcset', `${p}-1920.avif 1920w, ${p}-2560.avif 2560w`)} sizes="130vw">
       <source type="image/webp" ${set('srcset', `${p}-1920.webp 1920w, ${p}-2560.webp 2560w`)} sizes="130vw">`
  const src = detail ? `${p}-800.webp` : `${p}-1920.webp`
  const dims = detail ? 'width="800" height="1000"' : 'width="1920" height="1080"'
  return `<picture class="pic ${cls}">${sources}<img ${set('src', src)} alt="${esc(img.alt)}" ${dims} decoding="async"${
    eager ? ' fetchpriority="high"' : ''
  }></picture>`
}

const caption = `<span class="caption" aria-hidden="true">${imageCaption}</span>`

/** Logo cho nền tối: ảnh trong public/brand/ nếu có (SITE.brand.logoOnDark), không thì tên dạng chữ */
const logo = (cls = '') =>
  brand.logoOnDark
    ? `<img class="logo ${cls}" src="${import.meta.env.BASE_URL}${esc(brand.logoOnDark)}" alt="${esc(brand.name)}" width="480" height="160" decoding="async">`
    : `<span class="logo logo-text ${cls}">${esc(brand.name)}</span>`

const svg = (d: string, w = 1.6) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`

export const icon = {
  arrow: svg('M12 4v15m0 0-6-6m6 6 6-6'),
  right: svg('M5 12h14m0 0-6-6m6 6-6 6'),
  chat: svg('M4 5h16v11H9l-5 4V5Z'),
  /** WhatsApp: bong bóng tròn có đuôi (biểu tượng chung, không dùng logo thương hiệu) */
  message: svg('M4.5 19.5l1.2-3.6A8 8 0 1 1 8.3 18.4L4.5 19.5Z'),
  phone: svg('M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z'),
  pin: svg('M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'),
  size: svg('M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6'),
  close: svg('M6 6l12 12M18 6 6 18', 1.8),
  list: svg('M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', 2),
  school: svg('M3 10 12 5l9 5-9 5-9-5Zm3 1.7V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.3'),
  search: svg('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4'),
  check: svg('M5 12.5 10 17l9-10', 2),
  no: svg('M7 7l10 10M17 7 7 17', 2),
  external: svg('M14 5h5v5M19 5l-8 8M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4'),
}

/** id trong trang của cảnh danh mục (tiền tố để không trùng các id cố định) */
export const catId = (code: string) => `c-${code}`

export const navItems = [
  { id: 'intro', label: scenes.intro.nav },
  ...categories.map((t) => ({ id: catId(t.code), label: t.name })),
  { id: 'compare', label: scenes.compare.nav },
  { id: 'catalog', label: scenes.listing.nav },
  { id: 'contact', label: scenes.cta.nav },
]
/** Số cảnh nằm trong đoạn phim được ghim (mở đầu + các danh mục + so sánh) */
export const FILM_SCENES = 2 + categories.length

function intro() {
  const s = scenes.intro
  return `
  <section class="scene s-intro" id="intro" data-scene="0" aria-labelledby="t-intro">
    <div class="layer bg">${picture(s.bg, { eager: true })}</div>
    <div class="door-wall" aria-hidden="true">
      <div class="door-hole">
        <div class="door-leaf l"><span class="pull"></span></div>
        <div class="door-leaf r"><span class="pull"></span></div>
        <span class="door-seam"></span>
      </div>
    </div>
    <div class="shade shade-center"></div>
    <div class="topbar">${logo()}<a class="topbar-login" href="${esc(appLink('/dang-nhap'))}">Đăng nhập</a></div>
    <div class="copy copy-center">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h1 id="t-intro" class="title">${esc(s.title)}</h1>
      <p class="sub">${esc(s.sub)}</p>
    </div>
    <p class="hint" aria-hidden="true"><span>${esc(s.hint)}</span>${icon.arrow}</p>
    ${caption}
  </section>`
}

const copySide: Record<Category['effect'], string> = { pan: 'top', zoom: 'left', wipe: 'right', dusk: 'bottom', reveal: 'left' }

function categoryScene(t: Category, i: number) {
  const side = copySide[t.effect]
  const points = t.callouts.map((c) => `<li>${icon.check}<span>${esc(c.label)}</span></li>`).join('')

  let visual = ''
  if (t.effect === 'pan') {
    const anchored = t.callouts
      .filter((c) => c.x != null && c.y != null)
      .map(
        (c, k) => `
        <div class="callout c${k + 1}${c.x! > 60 ? ' to-left' : ''}${c.y! < 40 || c.below ? ' to-below' : ''}" style="--x:${c.x}%;--y:${c.y}%">
          <span class="dot"></span><span class="line"></span>
          <div class="card"><p class="text">${esc(c.label)}</p></div>
        </div>`,
      )
      .join('')
    visual = `<div class="pan">${picture(t.bg)}</div>
      <div class="shade shade-${side}"></div>
      <div class="pan pan-over" aria-hidden="true"><div class="callouts">${anchored}</div></div>`
  } else {
    const focus = t.focus ? ` style="--fx:${t.focus.x}%;--fy:${t.focus.y}%"` : ''
    visual = `<div class="layer bg"${focus}>${picture(t.bg)}</div>`
    if (t.effect === 'reveal' && t.extra?.[0]) visual += `<div class="layer bg ghost">${picture(t.extra[0])}</div>`
    if (t.effect === 'dusk') visual += `<div class="tint tint-dusk" aria-hidden="true"></div><div class="tint tint-glow" aria-hidden="true"></div>`
    visual += `<div class="shade shade-${side}"></div>`
    if (t.effect === 'zoom' && t.extra?.length)
      visual += `<div class="details">${t.extra.map((d, k) => `<figure class="detail d${k + 1}">${picture(d, { detail: true })}</figure>`).join('')}</div>`
  }

  return `
  <section class="scene s-type fx-${t.effect}" id="${catId(t.code)}" data-scene="${i + 1}" data-type="${esc(t.code)}" aria-labelledby="t-${catId(t.code)}"${
    t.focus ? ` style="--wx:${t.focus.x}%;--wy:${t.focus.y}%"` : ''
  }>
    ${visual}
    <div class="copy copy-${side}">
      <p class="eyebrow">${esc(ui.typeOf(i + 1, categories.length))}</p>
      <h2 id="t-${catId(t.code)}" class="title">${esc(t.name)}</h2>
      <p class="lede">${esc(t.headline)}</p>
      <ul class="points${t.effect === 'pan' ? ' has-anchors' : ''}">${points}</ul>
      <div class="type-cta">
        <a class="btn btn-primary btn-sm" href="${esc(t.cta.href)}">${esc(t.cta.label)}${icon.right}</a>
      </div>
    </div>
    ${caption}
  </section>`
}

function compare() {
  const s = scenes.compare
  return `
  <section class="scene s-compare" id="compare" data-scene="${FILM_SCENES - 1}" aria-labelledby="t-compare">
    <div class="copy copy-center">
      <h2 id="t-compare" class="title">${esc(s.title)}</h2>
      <table class="cmp-table">
        <thead><tr><td></td>${s.cols.map((c) => `<th scope="col"${c.highlight ? ' class="is-ours"' : ''}>${esc(c.name)}</th>`).join('')}</tr></thead>
        <tbody>${s.rows
          .map(
            (row, r) => `<tr><th scope="row">${esc(row)}</th>${s.cols
              .map((c) => `<td class="${c.yes[r] ? 'yes' : 'no'}${c.highlight ? ' is-ours' : ''}">${c.yes[r] ? icon.check : icon.no}<span class="sr-only">${esc(c.yes[r] ? s.yes : s.no)}</span></td>`)
              .join('')}</tr>`,
          )
          .join('')}</tbody>
      </table>
      <a class="cmp-link" href="#catalog" data-filter-type="">${esc(s.cta)}${icon.right}</a>
    </div>
  </section>`
}

function listing() {
  const s = scenes.listing
  const chip = (value: string, label: string, checked = false) =>
    `<label class="chip"><input type="radio" name="type" value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`
  return `
  <section class="listing" id="catalog" aria-labelledby="t-list" tabindex="-1">
    <div class="wrap">
      <h2 id="t-list" class="title">${esc(s.title)}</h2>
      <p class="sub">${esc(s.sub)}</p>
      <p class="data-notice" hidden></p>
      <form class="filters" aria-label="${esc(ui.filtersLabel)}" role="search">
        <fieldset class="chips">
          <legend class="sr-only">${esc(s.typeLabel)}</legend>
          ${chip('', s.all, true)}${levels.map((l) => chip(l.code, l.name)).join('')}
        </fieldset>
        <div class="selects">
          <label class="sel sel-search"><span>${esc(s.searchLabel)}</span><span class="search-box">${icon.search}<input type="search" name="q" placeholder="${esc(s.searchPlaceholder)}" autocomplete="off" enterkeyhint="search"></span></label>
          <label class="sel"><span>${esc(terms.segment)}</span><select name="segment"><option value="">${esc(terms.segmentAll)}</option></select></label>
          <label class="sel"><span>${esc(s.statusLabel)}</span><select name="status">
            <option value="">${esc(s.statusAll)}</option>
            <option value="available">${esc(terms.available)}</option>
            <option value="reserved">${esc(terms.reserved)}</option>
          </select></label>
        </div>
      </form>
      <p class="count" aria-live="polite"></p>
      <ul class="cards" aria-busy="true">${'<li class="card-unit is-skeleton" aria-hidden="true"><span></span><span></span><span></span></li>'.repeat(3)}</ul>
      <div class="not-found">
        <div>
          <p class="not-found-title">${esc(s.notFound.title)}</p>
          <p class="not-found-text">${esc(s.notFound.text)}</p>
        </div>
        <a class="btn btn-dark" href="${esc(appLink('/dang-ky'))}">${esc(s.notFound.cta)}${icon.right}</a>
      </div>
      <p class="updated"></p>
    </div>
  </section>
  <dialog class="unit-dialog" aria-labelledby="u-title"><div class="unit-body"></div></dialog>`
}

function steps() {
  const s = scenes.steps
  return `
  <section class="steps" id="steps" aria-labelledby="t-steps">
    <div class="wrap">
      <h2 id="t-steps" class="title">${esc(s.title)}</h2>
      <ol class="step-list">${s.items
        .map((it, i) => `<li><span class="step-no" aria-hidden="true">${i + 1}</span><p class="step-title">${esc(it)}</p></li>`)
        .join('')}</ol>
    </div>
  </section>`
}

function cta() {
  const s = scenes.cta
  const digits = brand.phoneDigits.replace(/\D/g, '')
  const contact = digits
    ? `<div class="cta-links">
        <a class="btn btn-ghost" href="https://zalo.me/${digits.replace(/^84/, '0')}" target="_blank" rel="noopener">${icon.chat}<span>${esc(s.zalo)}</span></a>
        <a class="btn btn-ghost" href="tel:+${digits}">${icon.phone}<span>${esc(s.call)} ${esc(brand.phone)}</span></a>
      </div>`
    : `<p class="cta-phone">${esc(s.zalo)}: <strong>${esc(brand.phone)}</strong></p>`
  return `
  <section class="cta" id="contact" aria-labelledby="t-cta" tabindex="-1">
    <div class="cta-inner">
      <h2 id="t-cta" class="title">${esc(s.title)}</h2>
      <ul class="paths">
        ${s.paths
          .map(
            (p, i) => `
          <li class="path">
            <p class="path-who">${esc(p.who)}</p>
            <a class="btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}" href="${esc(appLink(p.path))}">${esc(p.label)}${icon.right}</a>
          </li>`,
          )
          .join('')}
      </ul>
      <p class="cta-login"><a href="${esc(appLink('/dang-nhap'))}">${esc(s.login)}</a></p>
      ${contact}
    </div>
    <footer class="foot">
      <div class="foot-top">${logo('foot-logo')}</div>
      <p class="foot-tag">${esc(brand.tagline)}. ${esc(brand.slogan)}</p>
      <p>${esc(ui.footRole)}</p>
      <p>${esc(ui.footNote)}</p>
    </footer>
  </section>`
}

export function render(root: HTMLElement) {
  root.innerHTML = `
  <a class="skip-link" href="#catalog">${esc(ui.skip)}</a>
  <div class="progress" aria-hidden="true"><i></i></div>
  <nav class="dots" aria-label="${esc(ui.navLabel)}">
    <ol>${navItems.map((n) => `<li><a href="#${n.id}" data-target="${n.id}"><span class="sr-only">${esc(n.label)}</span><i aria-hidden="true"></i><em aria-hidden="true">${esc(n.label)}</em></a></li>`).join('')}</ol>
  </nav>
  <a class="jump btn btn-primary" href="#catalog">${icon.list}<span>${esc(scenes.jump)}</span></a>
  <main id="main">
    <div class="film">
      ${intro()}${categories.map(categoryScene).join('')}${compare()}
    </div>
    ${listing()}${steps()}${cta()}
  </main>`
}
