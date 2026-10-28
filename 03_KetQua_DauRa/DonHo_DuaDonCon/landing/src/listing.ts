import { appLink, levelName, levels, norm, scenes, segments, terms, ui } from './content'
import { loadItems, type Item } from './data/items'
import { esc, icon } from './render'
import { locale } from './i18n'

const S = scenes.listing

type Filter = { type: string; segment: string; status: string; q: string }

export type Listing = {
  /** Lọc theo cấp học rồi cuộn tới danh sách ('' = tất cả) */
  showType: (type: string) => void
}

export function setupListing(root: HTMLElement, scrollTo: (el: HTMLElement) => void): Listing {
  const section = root.querySelector<HTMLElement>('#catalog')!
  const form = section.querySelector<HTMLFormElement>('.filters')!
  const list = section.querySelector<HTMLUListElement>('.cards')!
  const count = section.querySelector<HTMLElement>('.count')!
  const notice = section.querySelector<HTMLElement>('.data-notice')!
  const updated = section.querySelector<HTMLElement>('.updated')!
  const segSel = form.querySelector<HTMLSelectElement>('select[name=segment]')!
  const dialog = root.querySelector<HTMLDialogElement>('.unit-dialog')!

  let items: Item[] = []

  /* ---------- Bộ lọc <-> địa chỉ trang (?cap=&tinh=&tt=&q= để gửi link đã lọc qua Zalo) ---------- */
  const read = (): Filter => {
    const d = new FormData(form)
    return {
      type: String(d.get('type') ?? ''),
      segment: String(d.get('segment') ?? ''),
      status: String(d.get('status') ?? ''),
      q: String(d.get('q') ?? '').trim(),
    }
  }
  const write = (f: Partial<Filter>) => {
    if (f.type != null) {
      const r = form.querySelector<HTMLInputElement>(`input[name=type][value="${CSS.escape(f.type)}"]`)
      if (r) r.checked = true
    }
    if (f.segment != null) segSel.value = f.segment
    if (f.status != null) form.querySelector<HTMLSelectElement>('select[name=status]')!.value = f.status
    if (f.q != null) form.querySelector<HTMLInputElement>('input[name=q]')!.value = f.q
  }
  const URL_KEYS = { type: 'cap', segment: 'tinh', status: 'tt', q: 'q' } as const
  const syncUrl = (f: Filter) => {
    const q = new URLSearchParams(location.search)
    for (const [k, p] of Object.entries(URL_KEYS)) {
      const v = f[k as keyof Filter]
      if (v) q.set(p, v)
      else q.delete(p)
    }
    const qs = q.toString()
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`)
  }

  const specText = (u: Item) => (u.spec ? `${u.spec} ${terms.spec.unit}` : '')
  const statusText = (u: Item) => (u.status === 'reserved' ? terms.reserved : terms.available)

  /* ---------- Thẻ trường ---------- */
  const card = (u: Item) => {
    const spec = specText(u)
    return `
    <li class="card-unit card-school${u.status === 'reserved' ? ' is-deposited' : ''}">
      <button type="button" class="card-open" data-code="${esc(u.code)}" aria-haspopup="dialog">
        <span class="card-info">
          <span class="card-top"><span class="card-type">${icon.school}${esc(levelName(u.category))}</span><span class="status status-${u.status}">${esc(statusText(u))}</span></span>
          <span class="card-name">${esc(u.name)}</span>
          <span class="card-meta">${icon.pin}<span>${esc([u.address, u.segment].filter((x) => x && x !== '—').join(', '))}</span></span>
          ${spec ? `<span class="card-meta card-spec">${esc(terms.spec.label)}: ${esc(spec)}</span>` : ''}
        </span>
      </button>
    </li>`
  }

  function apply(push = true) {
    const f = read()
    const nq = norm(f.q)
    const shown = items
      .filter((u) => u.status !== 'gone')
      .filter((u) => !f.type || u.category === f.type)
      .filter((u) => !f.segment || u.segment === f.segment)
      .filter((u) => !f.status || u.status === f.status)
      .filter((u) => !nq || norm(u.name).includes(nq) || norm(u.address).includes(nq))
      // trường đang đón lên trước, rồi theo tên
      .sort((a, b) => Number(a.status === 'reserved') - Number(b.status === 'reserved') || a.name.localeCompare(b.name, 'vi'))
    list.setAttribute('aria-busy', 'false')
    list.innerHTML = shown.length ? shown.map(card).join('') : `<li class="empty">${esc(S.empty)}</li>`
    const open = shown.filter((u) => u.status === 'available').length
    count.textContent = shown.length ? ui.count(open, shown.length - open) : ''
    if (push) syncUrl(f)
  }

  form.addEventListener('change', () => apply())
  let typing = 0
  form.querySelector('input[name=q]')!.addEventListener('input', () => {
    clearTimeout(typing)
    typing = window.setTimeout(() => apply(), 200)
  })
  form.addEventListener('submit', (e) => e.preventDefault())

  /* ---------- Hộp chi tiết ---------- */
  function openItem(code: string) {
    const u = items.find((x) => x.code === code)
    if (!u) return
    const spec = specText(u)
    dialog.querySelector('.unit-body')!.innerHTML = `
      <button type="button" class="unit-close" aria-label="${esc(ui.close)}">${icon.close}</button>
      <div class="unit-info">
        <p class="card-type">${icon.school}${esc(levelName(u.category))}</p>
        <h3 id="u-title" class="unit-title">${esc(u.name)}</h3>
        <p class="status status-${u.status} status-inline">${esc(statusText(u))}</p>
        <dl class="unit-facts">
          <div><dt>${esc(terms.segment)}</dt><dd>${esc(u.segment)}</dd></div>
          ${u.address ? `<div><dt>${esc(ui.facts.ward)}</dt><dd>${esc(u.address)}</dd></div>` : ''}
          ${spec ? `<div><dt>${esc(terms.spec.label)}</dt><dd>${esc(spec)}</dd></div>` : ''}
          ${u.updated ? `<div><dt>${esc(ui.facts.updated)}</dt><dd>${esc(u.updated)}</dd></div>` : ''}
        </dl>
        ${u.note ? `<p class="unit-note">${esc(u.note)}</p>` : ''}
        <div class="unit-actions">
          <a class="btn btn-dark" href="${esc(appLink('/dang-ky'))}">${esc(S.signup)}${icon.right}</a>
          <a class="btn btn-ghost-dark" href="${esc(appLink('/dang-ky'))}">${esc(S.helper)}</a>
        </div>
      </div>`
    dialog.showModal()
  }

  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.card-open')
    if (b) openItem(b.dataset.code!)
  })
  dialog.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t === dialog || t.closest('.unit-close')) dialog.close()
  })

  function fillSelects() {
    const extra = [...new Set(items.map((u) => u.segment))].filter((a) => a !== '—' && !segments.includes(a)).sort((a, b) => a.localeCompare(b, 'vi'))
    segSel.innerHTML =
      `<option value="">${esc(terms.segmentAll)}</option>` + [...segments, ...extra].map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('')
  }

  /* ---------- Tải dữ liệu ---------- */
  loadItems()
    .then((d) => {
      items = d.items
      fillSelects()
      const q = new URLSearchParams(location.search)
      write({ type: q.get('cap') ?? '', segment: q.get('tinh') ?? '', status: q.get('tt') ?? '', q: q.get('q') ?? '' })
      if (!levels.some((l) => l.code === read().type)) write({ type: '' })
      apply(false)
      if (d.source !== 'sheet') {
        notice.hidden = false
        notice.textContent = d.source === 'sample' ? S.sampleNotice : S.cacheNotice
      }
      updated.textContent = ui.updatedAt(
        d.fetchedAt.toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
      )
    })
    .catch(() => {
      list.setAttribute('aria-busy', 'false')
      list.innerHTML = `<li class="empty">${esc(S.error)}</li>`
    })

  const showType = (type: string) => {
    write({ type })
    if (items.length) apply()
    scrollTo(section)
    section.focus({ preventScroll: true })
  }

  root.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-filter-type]')
    if (!a) return
    e.preventDefault()
    showType(a.dataset.filterType!)
  })

  return { showType }
}
