import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useRadialMenuStore } from '../../store/radial-menu-store';
import { branchFromNode } from '../../store/actions';
import type { PathType } from '../../core/types';
import styles from './RadialMenu.module.css';

const RADIUS_FULL = 80;
const RADIUS_COMPACT = 56;
const BUTTON_SIZE_FULL = 44;
const BUTTON_SIZE_COMPACT = 36;
const BUTTON_RADIUS_FULL = BUTTON_SIZE_FULL / 2;
const BUTTON_RADIUS_COMPACT = BUTTON_SIZE_COMPACT / 2;
const BUFFER = 8;

interface PathConfig {
  path: PathType;
  label: string;
  angle: number; // degrees
  accent: string;
}

const PATHS: PathConfig[] = [
  { path: 'clarify',    label: 'Clarify',    angle: 270, accent: '#5b8def' },
  { path: 'go-deeper',  label: 'Deeper',     angle: 330, accent: '#7b4fbf' },
  { path: 'challenge',  label: 'Challenge',  angle: 30,  accent: '#d94f4f' },
  { path: 'apply',      label: 'Apply',      angle: 90,  accent: '#4faf7b' },
  { path: 'connect',    label: 'Connect',    angle: 150, accent: '#d4a017' },
  { path: 'surprise',   label: 'Surprise',   angle: 210, accent: '#e07baf' },
];

function clamp(min: number, val: number, max: number) {
  return Math.max(min, Math.min(val, max));
}

export function RadialMenu() {
  const isOpen = useRadialMenuStore(s => s.isOpen);
  const position = useRadialMenuStore(s => s.position);
  const targetNodeId = useRadialMenuStore(s => s.targetNodeId);
  const targetFsmState = useRadialMenuStore(s => s.targetFsmState);
  const paneBounds = useRadialMenuStore(s => s.paneBounds);
  const close = useRadialMenuStore(s => s.close);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDisabled = targetFsmState !== 'resolved';

  // Determine if compact mode (pane < 400px min dimension)
  const isCompact = paneBounds != null &&
    Math.min(paneBounds.width, paneBounds.height) < 400;

  // Fallback to dropdown if pane is very small (< 300px width)
  const useDropdown = paneBounds != null && paneBounds.width < 300;

  const radius = isCompact ? RADIUS_COMPACT : RADIUS_FULL;
  const buttonRadius = isCompact ? BUTTON_RADIUS_COMPACT : BUTTON_RADIUS_FULL;
  const buttonSize = isCompact ? BUTTON_SIZE_COMPACT : BUTTON_SIZE_FULL;
  const margin = radius + buttonRadius + BUFFER;

  // Clamp center: use pane bounds if available, otherwise viewport
  const { cx, cy } = useMemo(() => {
    if (paneBounds) {
      return {
        cx: clamp(paneBounds.left + margin, position.x, paneBounds.left + paneBounds.width - margin),
        cy: clamp(paneBounds.top + margin, position.y, paneBounds.top + paneBounds.height - margin),
      };
    }
    return {
      cx: clamp(margin, position.x, window.innerWidth - margin),
      cy: clamp(margin, position.y, window.innerHeight - margin),
    };
  }, [position, paneBounds, margin]);

  const handleSelect = useCallback((pathType: PathType) => {
    if (isDisabled || !targetNodeId) return;
    void branchFromNode(targetNodeId, pathType);
    close();
  }, [isDisabled, targetNodeId, close]);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  // Focus first button on open
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const first = containerRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]');
      first?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Dropdown fallback for very small panes
  if (useDropdown) {
    return (
      <>
        <div className={styles.backdrop} onClick={close} />
        <div
          ref={containerRef}
          className={styles.dropdown}
          role="menu"
          style={{ left: position.x, top: position.y }}
        >
          {PATHS.map((p) => (
            <button
              key={p.path}
              role="menuitem"
              className={`${styles.dropdownItem} ${isDisabled ? styles.disabled : ''}`}
              style={{ borderLeftColor: p.accent }}
              aria-disabled={isDisabled}
              aria-label={p.label}
              tabIndex={0}
              onClick={() => handleSelect(p.path)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop — reduced opacity in quadrant mode */}
      <div
        className={styles.backdrop}
        style={paneBounds ? { opacity: 0.06 } : undefined}
        onClick={close}
      />

      {/* Radial container */}
      <div
        ref={containerRef}
        className={styles.container}
        role="menu"
        style={{ left: cx, top: cy }}
      >
        {PATHS.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius - buttonRadius;
          const y = Math.sin(rad) * radius - buttonRadius;

          return (
            <button
              key={p.path}
              role="menuitem"
              className={`${styles.button} ${isDisabled ? styles.disabled : ''}`}
              style={{
                left: x,
                top: y,
                width: buttonSize,
                height: buttonSize,
                backgroundColor: p.accent,
                borderColor: p.accent,
                transitionDelay: `${i * 30}ms`,
                fontSize: isCompact ? '0.55rem' : '0.65rem',
              }}
              ref={(el) => {
                if (el) {
                  requestAnimationFrame(() => {
                    el.classList.add(styles.visible);
                  });
                }
              }}
              aria-disabled={isDisabled}
              aria-label={p.label}
              tabIndex={0}
              onClick={() => handleSelect(p.path)}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
