import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

export type Film = {
  /** Vị trí cuộn (px) để nhảy tới đầu cảnh i */
  scrollFor: (i: number) => number
  current: () => number
  kill: () => void
}

type Opts = { root: HTMLElement; scenes: HTMLElement[]; mobile: boolean; onScene: (i: number) => void }

/** Mỗi cảnh tự dựng timeline của mình; phần đầu timeline là chuyển cảnh từ cảnh trước sang. */
type SceneBuilder = (el: HTMLElement, prev: HTMLElement | undefined, c: Ctx) => gsap.core.Timeline
type Ctx = { mobile: boolean; splits: SplitText[] }

const q = (el: Element, s: string) => el.querySelector<HTMLElement>(s)
const qa = (el: Element, s: string) => [...el.querySelectorAll<HTMLElement>(s)]

function splitWords(el: Element, c: Ctx) {
  const s = new SplitText(el, { type: 'words', mask: 'words' })
  c.splits.push(s)
  return s.words
}

/** Chữ hiện từng lớp: tên loại theo từng từ → câu dẫn → từng điểm nhấn → giá + nút */
function revealCopy(tl: gsap.core.Timeline, el: HTMLElement, at: number, c: Ctx, points = true) {
  const title = q(el, '.title')
  if (title) tl.from(splitWords(title, c), { yPercent: 110, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, at)
  const fade = { y: 24, autoAlpha: 0, duration: 0.45, ease: 'power2.out' }
  const eyebrow = q(el, '.eyebrow')
  if (eyebrow) tl.from(eyebrow, { autoAlpha: 0, duration: 0.4 }, at)
  const lede = q(el, '.lede')
  if (lede) tl.from(lede, fade, at + 0.35)
  if (points) qa(el, '.points li').forEach((li, i) => tl.from(li, fade, at + 0.6 + i * 0.3))
  const cta = q(el, '.type-cta')
  if (cta) tl.from(cta, fade, at + (points ? 1.5 : 0.7))
}

/** Chữ cảnh trước lui ra trước khi cảnh mới vào, để hai lớp chữ không chồng lên nhau */
function exitPrev(tl: gsap.core.Timeline, prev: HTMLElement | undefined, hideAt: number) {
  if (!prev) return
  const copy = q(prev, '.copy')
  if (copy) tl.to(copy, { autoAlpha: 0, y: -30, duration: 0.4, ease: 'power1.in' }, 0)
  tl.set(prev, { autoAlpha: 0 }, hideAt)
}

const hold = (tl: gsap.core.Timeline, d: number) => tl.to({}, { duration: d })

/* ---------------- Mở cửa ---------------- */
const intro: SceneBuilder = (el, _prev, c) => {
  const tl = gsap.timeline()
  const wall = q(el, '.door-wall')!
  const leafL = q(el, '.door-leaf.l')!
  const leafR = q(el, '.door-leaf.r')!
  const seam = q(el, '.door-seam')!
  const copy = q(el, '.copy')!
  tl.to(q(el, '.hint'), { autoAlpha: 0, duration: 0.3 }, 0)
    .to(copy, { yPercent: -20, autoAlpha: 0, duration: 0.6, ease: 'power1.in' }, 0.1)
    // cửa đôi phủ kín màn hình: vệt sáng ở khe bừng lên rồi tan, hai cánh lùa êm sang hai bên
    .to(seam, { scaleX: 8, autoAlpha: 0, duration: 0.8, ease: 'sine.out' }, 0.2)
    .to(leafL, { xPercent: -100, duration: 1.8, ease: 'sine.inOut' }, 0.3)
    .to(leafR, { xPercent: 100, duration: 1.8, ease: 'sine.inOut' }, 0.3)
    // máy quay tiến nhẹ về phía trước trong lúc cửa mở → có chiều sâu
    .fromTo(wall, { scale: 1 }, { scale: c.mobile ? 1.08 : 1.12, duration: 1.8, ease: 'sine.in' }, 0.3)
    .fromTo(q(el, '.layer.bg'), { scale: 1.3 }, { scale: 1.06, duration: 2.8, ease: 'power1.out' }, 0.3)
    .set(wall, { autoAlpha: 0 }, 2.15)
    .to(q(el, '.shade'), { opacity: 1, duration: 0.5 }, 2.2)
    .fromTo(copy, { yPercent: 12, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, immediateRender: false }, 2.4)
    .to(q(el, '.sub'), { autoAlpha: 1, duration: 0.5 }, 2.55)
  return hold(tl, 0.4)
}

/* ---------------- pan: máy quay lướt ngang + chú thích neo vào đồ vật ---------------- */
const pan: SceneBuilder = (el, prev, c) => {
  const tl = gsap.timeline()
  const pans = qa(el, '.pan') // ảnh + lớp chú thích, luôn di chuyển cùng nhau
  tl.set(el, { autoAlpha: 1 }, 0)
    .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'none' }, 0)
    .fromTo(pans, { scale: 1.12 }, { scale: 1, duration: 1.2, ease: 'power2.out' }, 0)
  if (prev) tl.to(q(prev, '.layer.bg'), { scale: 1.02, duration: 0.8, ease: 'none' }, 0)
  exitPrev(tl, prev, 0.8)

  if (c.mobile) {
    revealCopy(tl, el, 0.6, c)
    tl.to(pans[0], { scale: 1.1, duration: 3, ease: 'none' }, 1.2)
    return hold(tl, 0.5)
  }
  revealCopy(tl, el, 0.6, c, false)
  // khung ảnh rộng 1.3 lần màn hình → lướt ±11.5% bề ngang khung mà không lộ mép.
  // Dùng % (không dùng px) để khỏi phải dựng lại timeline mỗi lần ScrollTrigger tính lại vị trí.
  tl.fromTo(pans, { xPercent: -50 + 11.5 }, { xPercent: -50 - 11.5, duration: 3.6, ease: 'sine.inOut' }, 0.9)
  qa(el, '.callout').forEach((co, i) => {
    const at = 1.4 + i * 1.0
    tl.from(q(co, '.dot'), { scale: 0, duration: 0.3, ease: 'back.out(3)' }, at)
      .from(q(co, '.line'), { scaleX: 0, duration: 0.35, ease: 'power2.out' }, at + 0.15)
      .from(q(co, '.card'), { y: 24, autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, at + 0.35)
  })
  return hold(tl, 0.6)
}

/* ---------------- zoom: đẩy máy vào điểm nhấn + ảnh cận trượt parallax ---------------- */
const zoom: SceneBuilder = (el, prev, c) => {
  const tl = gsap.timeline()
  const bg = q(el, '.layer.bg')!
  tl.set(el, { autoAlpha: 1 }, 0).fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'none' }, 0)
  exitPrev(tl, prev, 0.8)
  tl.fromTo(bg, { scale: 1.12 }, { scale: 1.4, duration: 3.6, ease: 'power1.inOut' }, 0)
  // các lớp ảnh cận đi với tốc độ khác nhau → cảm giác chiều sâu
  qa(el, '.detail').forEach((d, i) =>
    tl.fromTo(d, { yPercent: 80 + i * 60, autoAlpha: 0 }, { yPercent: -40 - i * 50, autoAlpha: 1, duration: 3.2, ease: 'none' }, 0.5),
  )
  revealCopy(tl, el, 0.7, c)
  return hold(tl, 0.4)
}

/* ---------------- wipe: cảnh mới vuốt dọc lên che cảnh cũ ---------------- */
const wipe: SceneBuilder = (el, prev, c) => {
  const tl = gsap.timeline()
  tl.set(el, { autoAlpha: 1 }, 0)
    .fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0)
    .fromTo(q(el, '.layer.bg'), { scale: 1.2 }, { scale: 1.02, duration: 2.4, ease: 'power2.out' }, 0)
  if (prev) tl.to(q(prev, '.layer.bg'), { y: c.mobile ? -60 : -120, duration: 1.1, ease: 'power3.inOut' }, 0)
  exitPrev(tl, prev, 1.1)
  revealCopy(tl, el, 0.9, c)
  return hold(tl, 0.8)
}

/* ---------------- dusk: cửa sổ mở tròn ra, ánh sáng chuyển sang hoàng hôn ---------------- */
const dusk: SceneBuilder = (el, prev, c) => {
  const tl = gsap.timeline()
  const cs = getComputedStyle(el)
  const at = `${cs.getPropertyValue('--wx').trim() || '50%'} ${cs.getPropertyValue('--wy').trim() || '50%'}`
  tl.set(el, { autoAlpha: 1 }, 0)
    .fromTo(el, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 1.3, ease: 'power2.in' }, 0)
    .fromTo(q(el, '.layer.bg'), { scale: 1.3 }, { scale: 1.05, duration: 3.6, ease: 'none' }, 0)
    // ảnh cat-4 (Canva) vốn đã là chiều muộn → phủ nhẹ, đậm hơn sẽ chìm mất cửa sáng đèn
    .to(q(el, '.tint-dusk'), { opacity: 0.5, duration: 2.2, ease: 'none' }, 1.2)
    .to(q(el, '.tint-glow'), { opacity: 1, duration: 1.6, ease: 'none' }, 1.6)
  exitPrev(tl, prev, 1.3)
  revealCopy(tl, el, 1.1, c)
  return hold(tl, 0.4)
}

/* ---------------- reveal: nội thất gợi ý mờ dần, còn lại căn nhà trống ---------------- */
const reveal: SceneBuilder = (el, prev, c) => {
  const tl = gsap.timeline()
  tl.set(el, { autoAlpha: 1 }, 0).fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'none' }, 0)
  exitPrev(tl, prev, 0.8)
  tl.fromTo(qa(el, '.layer.bg'), { scale: 1.15 }, { scale: 1.02, duration: 3.4, ease: 'power1.out' }, 0)
  const ghost = q(el, '.ghost')
  if (ghost) tl.fromTo(ghost, { opacity: 1 }, { opacity: 0, duration: 1.6, ease: 'power1.inOut' }, 1.2)
  revealCopy(tl, el, 0.8, c)
  return hold(tl, 0.6)
}

/* ---------------- so sánh nhanh: thẻ bay vào theo nhịp ---------------- */
const compare: SceneBuilder = (el, prev, c) => {
  const tl = gsap.timeline()
  tl.set(el, { autoAlpha: 1 }, 0).fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'none' }, 0)
  exitPrev(tl, prev, 0.7)
  revealCopy(tl, el, 0.4, c, false)
  qa(el, '.cmp').forEach((card, i) =>
    tl.from(
      card,
      { y: c.mobile ? 40 : 90, x: c.mobile ? 0 : (i - 2) * 40, rotate: c.mobile ? 0 : (i - 2) * 2, autoAlpha: 0, duration: 0.6, ease: 'power3.out' },
      0.8 + i * 0.25,
    ),
  )
  return hold(tl, 1.2)
}

const byEffect: Record<string, SceneBuilder> = { pan, zoom, wipe, dusk, reveal }

function builderFor(el: HTMLElement): SceneBuilder {
  if (el.classList.contains('s-intro')) return intro
  if (el.classList.contains('s-compare')) return compare
  const fx = [...el.classList].find((k) => k.startsWith('fx-'))?.slice(3) ?? 'pan'
  return byEffect[fx] ?? pan
}

export function buildFilm({ root, scenes, mobile, onScene }: Opts): Film {
  const film = q(root, '.film')!
  const c: Ctx = { mobile, splits: [] }
  const master = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
  const starts: number[] = []
  // khung ảnh được căn giữa bằng GSAP (không dùng translate % của CSS) để zoom/pan không bị lệch khi đổi cỡ
  if (!mobile) gsap.set(film.querySelectorAll('.pan, .layer.bg'), { xPercent: -50, yPercent: -50, x: 0, y: 0 })

  scenes.forEach((el, i) => {
    if (i > 0) gsap.set(el, { autoAlpha: 0 })
    starts.push(master.duration())
    master.add(builderFor(el)(el, scenes[i - 1], c), master.duration())
  })

  // tốc độ cuộn: bao nhiêu % chiều cao màn hình cho 1 đơn vị thời gian
  const perUnit = mobile ? 50 : 62
  let cur = 0
  const st = ScrollTrigger.create({
    trigger: film,
    start: 'top top',
    end: () => `+=${(master.duration() * perUnit * window.innerHeight) / 100}`,
    pin: true,
    scrub: 0.6,
    animation: master,
    onUpdate: (self) => {
      const t = self.progress * master.duration()
      let i = 0
      while (i + 1 < starts.length && t >= starts[i + 1] - 0.3) i++
      if (i !== cur) {
        cur = i
        onScene(i)
      }
    },
  })
  onScene(0)

  return {
    // điểm dừng = lúc chữ của cảnh đã hiện gần đủ, không phải khung đầu còn trống
    scrollFor: (i) => {
      const t = i === 0 ? 0 : Math.min(starts[i] + 3.1, (starts[i + 1] ?? master.duration()) - 0.2)
      return st.start + (t / master.duration()) * (st.end - st.start)
    },
    current: () => cur,
    kill: () => {
      st.kill()
      master.kill()
      c.splits.forEach((s) => s.revert())
      gsap.set([...scenes, ...root.querySelectorAll('.film *')], { clearProps: 'all' })
    },
  }
}
