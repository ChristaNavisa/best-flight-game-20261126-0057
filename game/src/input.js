// ARUNIKA: input. One job: keyboard plus mouse, turned into one stick
// vector ({ pitch, roll, throttleDelta, brake }) the flight model consumes.

import { clamp } from './math3d.js';

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0, // -1 (left) .. 1 (right), from the centre of the screen
    mouseY: 0, // -1 (up) .. 1 (down)
    mouseActive: false,
    onKey: null, // callback(key) for one-shot actions
    onDrop: null,
    onToggleCamera: null,
    onRestart: null,
    onMute: null,

    attach() {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        this.keys.add(e.code);
        if (e.code === 'Space') {
          e.preventDefault();
          if (this.onDrop) this.onDrop();
        }
        if (e.code === 'KeyC' && this.onToggleCamera) this.onToggleCamera();
        if (e.code === 'KeyR' && this.onRestart) this.onRestart();
        if (e.code === 'KeyM' && this.onMute) this.onMute();
        if (this.onKey) this.onKey(e.code);
      });
      window.addEventListener('keyup', (e) => {
        this.keys.delete(e.code);
      });
      window.addEventListener('blur', () => {
        this.keys.clear();
      });
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        this.mouseX = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
        this.mouseY = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
        this.mouseActive = true;
      });
      canvas.addEventListener('mouseleave', () => {
        this.mouseActive = false;
      });
      // Keep the page from scrolling on arrows / space while flying.
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
      });
    },

    // Read the stick once per frame.
    read(dt) {
      const k = this.keys;
      let pitch = 0;
      let roll = 0;
      let throttleDelta = 0;
      // Arrows fly the plane (Up = climb, Down = descend); W/S work the throttle.
      if (k.has('ArrowUp')) pitch += 1;
      if (k.has('ArrowDown')) pitch -= 1;
      if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
      if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
      if (k.has('KeyW')) throttleDelta += 0.9;
      if (k.has('KeyS')) throttleDelta -= 0.9;
      if (k.has('ShiftLeft') || k.has('ShiftRight')) throttleDelta += 0.9;
      if (k.has('ControlLeft') || k.has('ControlRight')) throttleDelta -= 0.9;
      // Mouse steering: gentle, blended with the keys, dead zone in the middle.
      if (this.mouseActive) {
        const dead = 0.08;
        const mx = Math.abs(this.mouseX) < dead ? 0 : this.mouseX;
        const my = Math.abs(this.mouseY) < dead ? 0 : this.mouseY;
        roll += mx * 0.85;
        pitch += my * 0.7;
      }
      return {
        pitch: clamp(pitch, -1, 1),
        roll: clamp(roll, -1, 1),
        throttleDelta: clamp(throttleDelta, -1, 1),
        brake: k.has('KeyB'),
        dt,
      };
    },
  };
  return input;
}
