/**
 * A sliding pill behind a menu, as on the ICA Partners site: it rests on the
 * current item, glides to the item under the pointer (or keyboard focus), and
 * returns to the current item when the pointer leaves. Desktop pointers only;
 * on touch the menu keeps its plain styles.
 *
 * Works for a row (tabs) or a column (sidebar): the pill takes the item's box.
 *
 *   const off = attachPill(menu);   // returns a cleanup
 */
export function attachPill(menu: HTMLElement, { item = 'a', current = 'a.active' }: { item?: string; current?: string } = {}): () => void {
  const desk = window.matchMedia('(hover: hover) and (pointer: fine)');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pill = document.createElement('span');
  pill.className = 'menu-pill';
  pill.setAttribute('aria-hidden', 'true');
  menu.appendChild(pill);
  const items = Array.from(menu.querySelectorAll<HTMLElement>(item));
  const home = () => menu.querySelector<HTMLElement>(current);

  const moveTo = (el: HTMLElement | null, instant = false) => {
    items.forEach((x) => x.classList.toggle('is-lit', x === el));
    if (!el) { pill.style.opacity = '0'; return; }
    if (instant || still) pill.style.transition = 'none';
    pill.style.width = `${el.offsetWidth}px`;
    pill.style.height = `${el.offsetHeight}px`;
    pill.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
    pill.style.opacity = '1';
    if (instant || still) { void pill.offsetWidth; pill.style.transition = ''; }
  };

  const setMode = () => {
    menu.classList.toggle('has-pill', desk.matches);
    moveTo(desk.matches ? home() : null, true);
  };
  const onEnter = (e: Event) => {
    if (!desk.matches) return;
    moveTo(e.currentTarget as HTMLElement, pill.style.opacity !== '1');
  };
  const onLeave = () => { if (desk.matches) moveTo(home()); };
  const onFocusOut = (e: FocusEvent) => {
    if (desk.matches && !menu.contains(e.relatedTarget as Node | null)) moveTo(home());
  };
  const onResize = () => { if (desk.matches) moveTo(menu.querySelector<HTMLElement>('.is-lit') ?? home(), true); };

  items.forEach((a) => { a.addEventListener('mouseenter', onEnter); a.addEventListener('focus', onEnter); });
  menu.addEventListener('mouseleave', onLeave);
  menu.addEventListener('focusout', onFocusOut);
  desk.addEventListener('change', setMode);
  window.addEventListener('resize', onResize);
  // Widths depend on the web fonts; measure again once they are in.
  document.fonts?.ready.then(() => menu.isConnected && setMode());
  // The sidebar animates its width when it collapses.
  const ro = new ResizeObserver(onResize);
  ro.observe(menu);
  setMode();

  return () => {
    items.forEach((a) => { a.removeEventListener('mouseenter', onEnter); a.removeEventListener('focus', onEnter); a.classList.remove('is-lit'); });
    menu.removeEventListener('mouseleave', onLeave);
    menu.removeEventListener('focusout', onFocusOut);
    desk.removeEventListener('change', setMode);
    window.removeEventListener('resize', onResize);
    ro.disconnect();
    menu.classList.remove('has-pill');
    pill.remove();
  };
}
