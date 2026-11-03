const NOTICE_CLASS = "ls-notice";
const EDGE_GAP = 8;
let timer: ReturnType<typeof setTimeout> | undefined;

export function placeInViewport(element: HTMLElement, x: number, y: number): void {
  const { width, height } = element.getBoundingClientRect();
  element.style.left = `${Math.max(EDGE_GAP, Math.min(x, window.innerWidth - width - EDGE_GAP))}px`;
  element.style.top = `${Math.max(EDGE_GAP, Math.min(y, window.innerHeight - height - EDGE_GAP))}px`;
}

export function showNotice(message: string, x: number, y: number): void {
  document.querySelector(`.${NOTICE_CLASS}`)?.remove();
  clearTimeout(timer);
  const notice = document.createElement("div");
  notice.className = NOTICE_CLASS;
  notice.setAttribute("role", "status");
  notice.textContent = message;
  document.body.appendChild(notice);
  placeInViewport(notice, x, y);
  requestAnimationFrame(() => notice.classList.add(`${NOTICE_CLASS}--visible`));
  timer = setTimeout(() => notice.remove(), 1800);
}
