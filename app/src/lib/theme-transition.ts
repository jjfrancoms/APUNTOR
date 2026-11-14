import { Platform } from 'react-native';
import { cssEasing, motion } from '@/theme';

/**
 * Cambio de tema con revelado circular (solo web): el tema nuevo se expande en círculo desde el
 * control que se tocó, con la API View Transitions. En nativo, en navegadores sin la API o con
 * «reducir movimiento», el cambio es inmediato.
 */

const STYLE_ID = 'apuntor-theme-reveal';
/** Un clic reciente cuenta como origen; pasado este tiempo se usa el elemento con foco. */
const POINTER_TTL_MS = 2000;

let lastPointer: { x: number; y: number; at: number } | null = null;
let tracking = false;

/** Recuerda dónde se tocó por última vez, para no pasar el evento por cada control. */
function trackPointer(): void {
  if (tracking || typeof document === 'undefined') return;
  tracking = true;
  document.addEventListener(
    'pointerdown',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY, at: Date.now() };
    },
    { capture: true, passive: true },
  );
}

if (Platform.OS === 'web') trackPointer();

function origin(): { x: number; y: number } {
  if (lastPointer && Date.now() - lastPointer.at < POINTER_TTL_MS) return lastPointer;
  // Desde teclado: el centro del control con foco (o el de la ventana si no hay).
  const el = document.activeElement;
  if (el && el !== document.body) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/** Distancia desde el punto hasta la esquina más lejana de la ventana. */
function farthestCorner(x: number, y: number): number {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

/**
 * Deja que React confirme el estado nuevo en el DOM antes de que el navegador tome la captura
 * final. No sirve `requestAnimationFrame`: mientras corre este paso el navegador no dibuja, y
 * Chrome cancela la transición a los 4 s.
 */
function afterCommit(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => setTimeout(resolve, 0), 0);
  });
}

/**
 * Ejecuta `update` (el cambio de tema, p. ej. `updateSettings({ theme })`) con el revelado
 * circular cuando es posible; si no, lo ejecuta tal cual.
 */
export function revealThemeChange(update: () => void): void {
  if (
    Platform.OS !== 'web' ||
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return;
  }
  const { x, y } = origin();
  const radius = farthestCorner(x, y);
  // Sin fundido cruzado del navegador: lo único que se anima es el círculo.
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}';
  document.head.appendChild(style);
  const done = () => style.remove();
  try {
    const transition = document.startViewTransition(async () => {
      update();
      await afterCommit();
    });
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: motion.duration.reveal,
            easing: cssEasing('inOut'),
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => undefined);
    transition.finished.then(done, done);
  } catch {
    done();
    update();
  }
}
