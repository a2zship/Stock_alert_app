import './styles.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { render, navItems, FILM_SCENES } from './render'
import { scenes as copy, ui } from './content'
import { lang } from './i18n'
import { buildFilm, type Film } from './film'
import { setupListing } from './listing'

gsap.registerPlugin(ScrollTrigger, SplitText)

/* ---------- Ngôn ngữ: thẻ html, tiêu đề tab, mô tả, font chữ cho tiếng Anh ---------- */
document.documentElement.lang = lang
document.title = ui.pageTitle
document.querySelector('meta[name=description]')?.setAttribute('content', ui.pageDesc)

const root = document.getElementById('app')!
render(root)
const html = document.documentElement

/* ---------- Ảnh: đánh dấu ảnh thiếu, nạp lười theo cảnh ---------- */
root.addEventListener(
  'error',
  (e) => {
    const t = e.target as HTMLElement
    if (t instanceof HTMLImageElement) t.closest('.pic, .card-media')?.classList.add('is-missing')
  },
  true,
)

const scenes = [...root.querySelectorAll<HTMLElement>('.film .scene')]
const loaded = new Set<number>([0])

function loadImages(i: number) {
  if (i < 0 || i >= scenes.length || loaded.has(i)) return
  loaded.add(i)
  scenes[i].querySelectorAll<HTMLElement>('[data-srcset], [data-src]').forEach((el) => {
    if (el.dataset.srcset) el.setAttribute('srcset', el.dataset.srcset)
    if (el.dataset.src) el.setAttribute('src', el.dataset.src)
  })
}

/* ---------- Màn chờ ----------
 * Màn chờ (trong index.html) hiện trong lúc tải JavaScript. Khung đầu là hai cánh cửa đóng kín nên
 * không cần đợi ảnh phòng phía sau: ảnh đó đã được tải trước (preload, ưu tiên cao) và chỉ lộ ra khi khách cuộn.
 */
function firstFrameReady() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

/* ---------- Thanh tiến trình + chấm mục lục ---------- */
const bar = root.querySelector<HTMLElement>('.progress i')!
const dotLinks = [...root.querySelectorAll<HTMLAnchorElement>('.dots a')]
let activeDot = -1
let sectionDot = -1 // chấm của phần sau phim (danh sách / đặt lịch) khi đang ở đó
function setActive(i: number) {
  if (i === activeDot) return
  activeDot = i
  dotLinks.forEach((a, k) => a.setAttribute('aria-current', k === i ? 'true' : 'false'))
}

let lenis: Lenis | null = null
let film: Film | null = null
/** Dựng phim nếu chưa dựng (chế độ phim dựng lười ở lần tương tác đầu). Trả về film hoặc null ở chế độ tĩnh. */
let ensureFilm: () => Film | null = () => null

function scrollToEl(el: HTMLElement) {
  const y = el.getBoundingClientRect().top + window.scrollY
  if (lenis) lenis.scrollTo(y, { duration: 1.2 })
  else window.scrollTo({ top: y })
}

const listing = setupListing(root, scrollToEl)

dotLinks.forEach((a, i) => {
  a.addEventListener('click', (e) => {
    const id = a.dataset.target!
    if (i >= FILM_SCENES) {
      e.preventDefault()
      if (id === 'catalog') return listing.showType('')
      const el = document.getElementById(id)!
      scrollToEl(el)
      el.focus({ preventScroll: true })
      return
    }
    const f = ensureFilm()
    if (!f) return // bố cục tĩnh: để trình duyệt tự nhảy tới #id
    e.preventDefault()
    loadImages(i)
    const y = f.scrollFor(i)
    if (lenis) lenis.scrollTo(y, { duration: 1.4 })
    else window.scrollTo({ top: y })
  })
})

root.querySelector('.skip-link')!.addEventListener('click', (e) => {
  e.preventDefault()
  const el = document.getElementById('catalog')!
  const y = el.getBoundingClientRect().top + window.scrollY
  if (lenis) lenis.scrollTo(y, { immediate: true })
  else window.scrollTo(0, y)
  el.focus({ preventScroll: true })
})

// Nút nổi "Tìm trường của con": mở danh sách trường (cảnh trong phim có nút riêng dẫn vào app)
const jump = root.querySelector<HTMLAnchorElement>('.jump')!
jump.querySelector('span')!.textContent = copy.jump
jump.addEventListener('click', (e) => {
  e.preventDefault()
  listing.showType('')
})

ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
})

// Các phần sau phim: danh sách căn, cách thuê, đặt lịch
const after: [string, number][] = [
  ['#catalog', navItems.findIndex((n) => n.id === 'catalog')],
  ['#contact', navItems.findIndex((n) => n.id === 'contact')],
]
after.forEach(([sel, dot]) =>
  ScrollTrigger.create({
    trigger: sel,
    refreshPriority: -1, // tính sau đoạn ghim phim để vị trí đúng
    start: 'top 55%',
    end: 'bottom 55%',
    onToggle: (self) => {
      if (self.isActive) sectionDot = dot
      else if (sectionDot === dot) sectionDot = -1
      setActive(sectionDot >= 0 ? sectionDot : (film?.current() ?? 0))
      // danh sách nền sáng: đổi màu chấm mục lục cho dễ thấy
      root.querySelector('.dots')!.classList.toggle('on-light', sectionDot === after[0][1])
    },
  }),
)

// Nút "Xem căn đang trống" ẩn khi danh sách đã lên màn hình (và mọi phần phía sau).
// Đo trực tiếp vị trí danh sách: chiều cao trang đổi khi các phần dưới được vẽ (content-visibility),
// nên không dựa vào mốc "cuối trang" tính sẵn của ScrollTrigger.
const listingEl = document.getElementById('catalog')!
const checkJump = () => jump.classList.toggle('is-hidden', listingEl.getBoundingClientRect().top < window.innerHeight)
window.addEventListener('scroll', checkJump, { passive: true })
window.addEventListener('resize', checkJump)
checkJump()

/** Tiêu đề mở màn hiện từng từ khi trang vừa tải xong (không phụ thuộc timeline phim) */
function playIntro() {
  const intro = scenes[0]
  const split = new SplitText(intro.querySelector('.title')!, { type: 'words', mask: 'words' })
  gsap
    .timeline({ onComplete: () => split.revert() })
    .from(intro.querySelectorAll('.eyebrow, .topbar'), { autoAlpha: 0, duration: 0.6 })
    // ngắn gọn: tiêu đề là phần tử lớn nhất màn đầu (LCP), hiện xong càng sớm càng tốt
    .from(split.words, { yPercent: 110, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, 0)
}

/* ---------- Chế độ phim / tĩnh theo media query ---------- */
const mm = gsap.matchMedia()

mm.add(
  {
    desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    mobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
    reduce: '(prefers-reduced-motion: reduce)',
  },
  (ctx) => {
    const { desktop, mobile, reduce } = ctx.conditions as Record<string, boolean>

    if (reduce) {
      // Bố cục đọc tĩnh: nạp ảnh khi section sắp vào màn hình
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            const i = scenes.indexOf(en.target as HTMLElement)
            if (en.isIntersecting) {
              loadImages(i)
              if (sectionDot < 0) setActive(i)
            }
          }),
        { rootMargin: '100% 0px' },
      )
      scenes.forEach((s) => io.observe(s))
      return () => io.disconnect()
    }

    // Khung đầu (cánh cửa đứng yên) chỉ cần CSS. Timeline cả bộ phim khá nặng nên chỉ dựng
    // ở lần tương tác đầu tiên (lăn chuột, chạm, bấm phím…) để trang mở ra không bị khựng.
    html.classList.add('is-film')
    const tick = (time: number) => lenis?.raf(time * 1000)
    const triggers = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'] as const
    const off = () => triggers.forEach((t) => window.removeEventListener(t, build, true))

    function build() {
      off()
      if (film) return film
      // Trang đã bị cuộn tới phần sau phim (link #contact, scrollIntoView…) trước khi dựng:
      // nhớ phần đang xem để sau khi chèn đoạn ghim vẫn giữ khách ở đúng chỗ.
      const y0 = window.scrollY
      const after = [...root.querySelectorAll<HTMLElement>('#catalog, #steps, #contact')]
      const top = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY
      const anchor = [...after].reverse().find((el) => top(el) <= y0 + 1)
      const within = anchor ? y0 - top(anchor) : 0
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
      film = buildFilm({
        root,
        scenes,
        mobile: !!mobile && !desktop,
        onScene: (i) => {
          if (sectionDot < 0) setActive(i)
          loadImages(i + 1)
          loadImages(i + 2)
        },
      })
      ScrollTrigger.refresh() // các phần sau phim tính lại vị trí sau khi có đoạn ghim
      lenis.resize() // Lenis nhớ chiều cao trang cũ (chưa có đoạn ghim) → đo lại, nếu không sẽ không cuộn quá được
      if (anchor) {
        const y = top(anchor) + within
        window.scrollTo(0, y)
        lenis.scrollTo(y, { immediate: true, force: true })
      }
      return film
    }
    ensureFilm = build
    triggers.forEach((t) => window.addEventListener(t, build, { capture: true, passive: true }))
    loadImages(1)
    setActive(0)

    return () => {
      off()
      ensureFilm = () => null
      film?.kill()
      film = null
      gsap.ticker.remove(tick)
      lenis?.destroy()
      lenis = null
      html.classList.remove('is-film')
    }
  },
)


// Hộp chi tiết căn đang mở thì dừng cuộn mượt để cuộn được bên trong hộp
const dialog = root.querySelector<HTMLDialogElement>('.unit-dialog')!
new MutationObserver(() => (dialog.open ? lenis?.stop() : lenis?.start())).observe(dialog, { attributes: true, attributeFilter: ['open'] })

firstFrameReady().then(() => {
  html.classList.remove('is-loading')
  if (html.classList.contains('is-film')) playIntro()
  else setActive(0)
  // mở link đã lọc (?cap=...) thì đưa khách thẳng tới danh sách
  if (/[?&](cap|tinh|tt|q)=/.test(location.search)) {
    ensureFilm()
    // đợi ScrollTrigger tính xong đoạn ghim phim (có thể phải chờ trang tải xong), rồi mới đo vị trí danh sách
    const go = () =>
      requestAnimationFrame(() => {
        const el = document.getElementById('catalog')!
        const y = el.getBoundingClientRect().top + window.scrollY
        lenis?.resize()
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
        else window.scrollTo(0, y)
      })
    const once = () => {
      ScrollTrigger.removeEventListener('refresh', once)
      go()
    }
    ScrollTrigger.addEventListener('refresh', once)
    ScrollTrigger.refresh()
  }
})
