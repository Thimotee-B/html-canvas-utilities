import { CanvasPlugin } from "./base";

export interface CanvasTransformerOptions {
  scale?: number;
  offset?: DOMPoint;
  canPan?: boolean;
  canZoom?: boolean;
  keyboardNavigation?: boolean;
  maxScale?: number;
  minScale?: number;
  // maxBounds?: Bounds;
}

// export interface Bounds {
//   minX: number;
//   minY: number;
//   maxX: number;
//   maxY: number;
// }

export class CanvasTransformer extends CanvasPlugin {
  constructor(readonly options: CanvasTransformerOptions = {}) {
    super();
    this.keyboardNavigation = options.keyboardNavigation ?? true;
    this.maxScale = options.maxScale ?? 10;
    this.minScale = options.minScale ?? 0.1;
    // this.maxBounds = options.maxBounds;
  }

  touches?: TouchList;
  mouse = new DOMPoint(0, 0);
  gestureEvent = false;
  mouseDown = false;
  spacePressed = false;
  controlPressed = false;
  shiftPressed = false;
  metaPressed = false;
  middleClick = false;
  keyboardNavigation: boolean;
  minScale: number;
  maxScale: number;
  maxBounds?: Bounds;
  _previousGesture: MouseEvent & GestureEvent;

  init(canvas: HTMLCanvasElement, plugins: CanvasPlugin[]) {
    super.init(canvas, plugins);
    this.transform = this.ctx.getTransform();

    this.options.scale ??= 1;
    this.options.offset ??= new DOMPoint(0, 0);
    this.scale(this.options.scale);
    this.pan(this.options.offset);

    // Scroll events
    this.canvas.addEventListener("wheel", this.onWheelEvent.bind(this), {
      passive: false,
    });

    // Mouse Events
    this.canvas.addEventListener(
      "mousedown",
      this.onMouseDown.bind(this),
      false
    );
    this.canvas.addEventListener(
      "mousemove",
      this.onMouseMove.bind(this),
      false
    );
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this), false);

    // Touch Events
    this.canvas.addEventListener(
      "touchstart",
      this.onTouchStart.bind(this),
      false
    );
    this.canvas.addEventListener(
      "touchmove",
      this.onTouchMove.bind(this),
      false
    );
    this.canvas.addEventListener("touchend", this.onTouchEnd.bind(this), false);

    // Double click and click
    this.canvas.addEventListener(
      "dblclick",
      this.onDoubleClick.bind(this),
      false
    );
    this.canvas.addEventListener("click", this.onClick.bind(this), false);

    // TODO: Prevent Safari iPadOS pinch / zoom
    this.canvas.addEventListener(
      "gesturestart",
      this.onGestureStart.bind(this),
      false
    );
    this.canvas.addEventListener(
      "gesturechange",
      this.onGestureChange.bind(this),
      false
    );
    this.canvas.addEventListener(
      "gestureend",
      this.onGestureEnd.bind(this),
      false
    );

    // Keyboard Events
    document.addEventListener("keydown", this.onKeyDownEvent.bind(this), false);
    document.addEventListener("keyup", this.onKeyUpEvent.bind(this), false);

    // Drag and drop events
    this.canvas.addEventListener("dragover", this.onDrop.bind(this), false);
    this.canvas.addEventListener("drop", this.onDrop.bind(this), false);
  }

  private transform: DOMMatrix;
  get matrix() {
    return this.transform;
  }
  set matrix(matrix: DOMMatrix) {
    this.transform = matrix;
  }

  /**
   * Transforms the mouse coordinates to the local coordinates of the canvas
   *
   * @param point X and Y coordinates of the vector
   */
  localPoint(point: DOMPoint) {
    const { scale, offset } = this.info;
    const x = point.x / scale - offset.x / scale;
    const y = point.y / scale - offset.y / scale;
    return new DOMPoint(x, y);
    // return point.matrixTransform(this.matrix.inverse());
  }

  worldPoint(point: DOMPoint) {
    const { scale, offset } = this.info;
    const x = point.x * scale + offset.x;
    const y = point.y * scale + offset.y;
    return new DOMPoint(x, y);
  }

  /**
   * Apply a new transform to the canvas
   *
   * @param ctx Canvas Rendering Context
   */
  applyTransform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(this.matrix);
  }

  get canZoom(): boolean {
    return this.options.canZoom ?? true;
  }

  /**
   * Scale the canvas by a factor and origin in the viewport
   *
   * @param delta Scale delta
   * @param origin Origin to scale at
   */
  scale(scale: number, origin?: DOMPoint) {
    if (!this.canZoom) return;
    if (Number.isNaN(scale)) return;
    const amount = scale * this.info.scale;
    this.options.scale = amount;
    // Make sure the scale is within bounds
    if (amount < this.minScale || amount > this.maxScale) {
      return;
    }
    const center = origin || this.mouse;
    const point = this.localPoint(center);
    this.matrix = this.matrix.scale(scale, scale, 0, point.x, point.y, point.z);
  }

  /**
   * Scale the canvas by a factor and origin in the viewport
   *
   * @param delta Scale delta
   * @param origin Origin to scale at
   */
  zoom(amount: number, origin?: DOMPoint) {
    if (!this.canZoom) return;
    if (Number.isNaN(amount)) return;
    const delta = this.info.scale - amount;
    this.options.scale = amount;
    // Make sure the scale is within bounds
    if (amount < this.minScale || amount > this.maxScale) {
      return;
    }
    const center = origin || this.mouse;
    const point = this.localPoint(center);
    this.matrix = this.matrix.scale(delta, delta, 0, point.x, point.y, point.z);
  }

  zoomIn() {
    this.scale(1.1);
  }

  zoomOut() {
    this.scale(0.9);
  }

  reset() {
    this.matrix = new DOMMatrix();
  }

  get canPan(): boolean {
    return this.options.canPan ?? true;
  }

  /**
   * Pan the canvas in a given direction
   *
   * @param delta X and Y coordinates of the vector
   */
  pan(delta: DOMPoint) {
    if (!this.canPan) return;
    if (Number.isNaN(delta)) return;
    const { scale } = this.info;
    const oldX = this.options.offset.x;
    const oldY = this.options.offset.y;
    this.options.offset.x += delta.x / scale;
    this.options.offset.y += delta.y / scale;
    const oldMatrix = this.matrix;
    this.matrix = this.matrix.translate(
      delta.x / scale,
      delta.y / scale,
      delta.z / scale
    );
    // if (!this.inBounds()) {
    //   this.matrix = oldMatrix;
    //   this.options.offset.x = oldX;
    //   this.options.offset.y = oldY;
    // }
  }

  // inBounds() {
  //   if (this.maxBounds) {
  //     const info = this.info;
  //     const width = this.canvas.width;
  //     const height = this.canvas.height;
  //     const scale = info.scale;
  //     const dx = info.offset.x;
  //     const dy = info.offset.y;

  //     console.log(dx, dy, scale, width, height);

  //     const minX = this.maxBounds.minX;
  //     const minY = this.maxBounds.minY;
  //     const maxX = this.maxBounds.maxX;
  //     const maxY = this.maxBounds.maxY;

  //     console.log(minX, minY, maxX, maxY);

  //     if (dx < minX || dy < minY || dx > maxX || dy > maxY) {
  //       return false;
  //     }
  //   }
  //   return true;
  // }

  get info(): CanvasInfo {
    const { scaleX, scaleY, translateX, translateY, rotate } = decomposeMatrix(
      this.matrix
    );
    return {
      scale: Math.min(scaleX, scaleY),
      offset: new DOMPoint(translateX, translateY),
      rotation: rotate,
      mouse: this.mouse,
      mouseDown: this.mouseDown,
    };
  }

  private onWheelEvent(e: WheelEvent) {
    this.preventDefault(e);
    if (this.gestureEvent) return;
    const origin = new DOMPoint(e.offsetX, e.offsetY);
    if (e.ctrlKey || this.controlPressed) {
      let scale = 1;
      if (e.deltaY < 0) {
        scale = Math.min(this.maxScale, scale * 1.1);
      } else {
        scale = Math.max(this.minScale, scale * (1 / 1.1));
      }
      this.scale(scale, origin);
    } else {
      this.pan(new DOMPoint(-e.deltaX, -e.deltaY));
    }
  }

  onMouseDown(e: MouseEvent) {
    this.mouse = new DOMPoint(e.offsetX, e.offsetY);
    this.mouseDown = true;
  }

  onMouseMove(e: MouseEvent) {
    this.mouse = new DOMPoint(e.offsetX, e.offsetY);
  }

  onMouseUp(e: MouseEvent) {
    this.mouse = new DOMPoint(e.offsetX, e.offsetY);
    this.mouseDown = false;
  }

  onTouchStart(e: TouchEvent) {
    this.preventDefault(e);

    this.touches = e.touches;
    this.mouseDown = true;
    this.gestureEvent = this.touches.length > 1;
  }

  onTouchMove(e: TouchEvent) {
    this.preventDefault(e);

    const prev = this.touches!;
    this.touches = e.touches;

    if (this.gestureEvent) {
      const oldPoint1 = new DOMPoint(prev[0].clientX, prev[0].clientY);
      const oldPoint2 = new DOMPoint(prev[1].clientX, prev[1].clientY);
      const newPoint1 = new DOMPoint(
        this.touches[0].clientX,
        this.touches[0].clientY
      );
      const newPoint2 = new DOMPoint(
        this.touches[1].clientX,
        this.touches[1].clientY
      );
      if (this.touches.length === 2) {
        // Get the center of the two touches
        const oldCenter = new DOMPoint(
          (oldPoint1.x + oldPoint2.x) / 2,
          (oldPoint1.y + oldPoint2.y) / 2
        );
        const newCenter = new DOMPoint(
          (newPoint1.x + newPoint2.x) / 2,
          (newPoint1.y + newPoint2.y) / 2
        );

        // Get the distance between the two touches
        const oldDistance = distance(oldPoint1, oldPoint2);
        const newDistance = distance(newPoint1, newPoint2);

        // Get the scale factor
        const scale = newDistance / oldDistance;

        // Scale at the center of the two touches
        this.scale(scale, newCenter);

        // Pan the difference between the two touches
        if (newCenter !== oldCenter) {
          const oldMin = new DOMPoint(
            Math.min(oldPoint1.x, oldPoint2.x),
            Math.min(oldPoint1.y, oldPoint2.y)
          );
          const newMin = new DOMPoint(
            Math.min(newPoint1.x, newPoint2.x),
            Math.min(newPoint1.y, newPoint2.y)
          );
          const delta = new DOMPoint(newMin.x - oldMin.x, newMin.y - oldMin.y);
          this.pan(delta);
        }
      } else if (this.touches.length === 3) {
        const oldPoint3 = new DOMPoint(prev[2].clientX, prev[2].clientY);
        const newPoint3 = new DOMPoint(
          this.touches[2].clientX,
          this.touches[2].clientY
        );

        // Pan the canvas
        const oldMin = new DOMPoint(
          Math.min(oldPoint1.x, oldPoint2.x, oldPoint3.x),
          Math.min(oldPoint1.y, oldPoint2.y, oldPoint3.y)
        );
        const newMin = new DOMPoint(
          Math.min(newPoint1.x, newPoint2.x, oldPoint3.x),
          Math.min(newPoint1.y, newPoint2.y, newPoint3.y)
        );
        const delta = new DOMPoint(newMin.x - oldMin.x, newMin.y - oldMin.y);
        this.pan(delta);
      }
    }
  }

  onTouchEnd(e: TouchEvent) {
    this.preventDefault(e);

    this.touches = e.touches;
    this.mouseDown = this.touches.length === 0;
    this.gestureEvent = this.touches.length > 1;
  }

  onKeyDownEvent(e: KeyboardEvent) {
    const isActive =
      this.canvas === document.activeElement ||
      this.canvas.contains(document.activeElement);
    if (!isActive) return;
    this.preventDefault(e);
    if (this.keyboardNavigation) {
      if (e.key === "ArrowLeft") {
        this.pan(new DOMPoint(-10, 0));
      } else if (e.key === "ArrowRight") {
        this.pan(new DOMPoint(10, 0));
      } else if (e.key === "ArrowUp") {
        this.pan(new DOMPoint(0, -10));
      } else if (e.key === "ArrowDown") {
        this.pan(new DOMPoint(0, 10));
      } else if (e.key === "=") {
        this.scale(1.1, this.mouse);
      } else if (e.key === "-") {
        this.scale(1 / 1.1, this.mouse);
      }
    }
    this.controlPressed = e.ctrlKey;
    this.shiftPressed = e.shiftKey;
    this.metaPressed = e.metaKey;
    this.spacePressed = e.key === " ";
  }

  onKeyUpEvent(e: KeyboardEvent) {
    this.preventDefault(e);
    this.controlPressed = false;
    this.spacePressed = false;
    this.shiftPressed = false;
    this.metaPressed = false;
  }

  onDoubleClick(e: MouseEvent) {
    this.preventDefault(e);
  }

  onClick(e: MouseEvent) {
    this.preventDefault(e);
  }

  onDragOver(e: DragEvent) {
    this.preventDefault(e);
  }

  onDrop(e: DragEvent) {
    this.preventDefault(e);
  }

  onGestureStart(e: MouseEvent & GestureEvent) {
    this.preventDefault(e);
    this._previousGesture = e;
    this.gestureEvent = true;
    return false;
  }

  onGestureChange(e: MouseEvent & GestureEvent) {
    this.preventDefault(e);
    const point = new DOMPoint(e.clientX, e.clientY);
    const prevScale = this._previousGesture.scale;
    const scale = e.scale;
    const scaleDelta = scale / prevScale;
    this.scale(scaleDelta, point);
    this._previousGesture = e;
    return false;
  }

  onGestureEnd(e: MouseEvent & GestureEvent) {
    this.preventDefault(e);
    this._previousGesture = e;
    this.gestureEvent = false;
    return false;
  }

  preventDefault(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  draw(ctx: CanvasRenderingContext2D, timestamp: number): void {
    ctx.setTransform(this.transform);
  }

  resize(rect: DOMRect): void {}
}

// https://gist.github.com/fwextensions/2052247
function decomposeMatrix(m: DOMMatrix) {
  const E = (m.a + m.d) / 2;
  const F = (m.a - m.d) / 2;
  const G = (m.c + m.b) / 2;
  const H = (m.c - m.b) / 2;

  const Q = Math.sqrt(E * E + H * H);
  const R = Math.sqrt(F * F + G * G);
  const a1 = Math.atan2(G, F);
  const a2 = Math.atan2(H, E);
  const theta = (a2 - a1) / 2;
  const phi = (a2 + a1) / 2;

  return {
    translateX: m.e,
    translateY: m.f,
    rotate: (-phi * 180) / Math.PI,
    scaleX: Q + R,
    scaleY: Q - R,
    skew: (-theta * 180) / Math.PI,
  };
}

function distance(a: DOMPoint, b: DOMPoint): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export interface CanvasInfo {
  scale: number;
  offset: DOMPoint;
  rotation: number;
  mouse: DOMPoint;
  mouseDown: boolean;
}

interface GestureEvent {
  scale: number;
  rotation: number;
}
