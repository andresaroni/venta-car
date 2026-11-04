// Carrusel ligero basado en scroll-snap (permite deslizar con el dedo en móvil).
// Marcado esperado:
//   [data-carousel] > [data-track] > .slide*
//   [data-prev], [data-next], [data-dots] (opcionales)

export interface CarouselController {
  goTo(index: number, smooth?: boolean): void;
  readonly index: number;
}

export function initCarousel(
  root: HTMLElement,
  onChange?: (index: number) => void,
): CarouselController | null {
  const track = root.querySelector<HTMLElement>('[data-track]');
  if (!track) return null;
  const slides = Array.from(track.children) as HTMLElement[];
  const total = slides.length;
  const prev = root.querySelector<HTMLButtonElement>('[data-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-next]');
  const dotsWrap = root.querySelector<HTMLElement>('[data-dots]');
  let current = 0;

  if (total <= 1) {
    prev?.remove();
    next?.remove();
    dotsWrap?.remove();
  }

  const dots: HTMLButtonElement[] = [];
  if (dotsWrap && total > 1) {
    dotsWrap.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dot';
      dot.setAttribute('aria-label', `Image ${i + 1} of ${total}`);
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(i);
      });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    }
  }

  function render() {
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
    onChange?.(current);
  }

  function goTo(index: number, smooth = true) {
    if (!track) return;
    const i = (index + total) % total;
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    current = i;
    render();
  }

  prev?.addEventListener('click', (e) => {
    e.stopPropagation();
    goTo(current - 1);
  });
  next?.addEventListener('click', (e) => {
    e.stopPropagation();
    goTo(current + 1);
  });

  let ticking = false;
  track.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const i = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
        if (i !== current && i >= 0 && i < total) {
          current = i;
          render();
        }
      });
    },
    { passive: true },
  );

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  });

  render();

  return {
    goTo,
    get index() {
      return current;
    },
  };
}
