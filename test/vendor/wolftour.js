/*!
 * ============================================================================
 * WolfTour Engine v2.0.0 — 100% Native ES6+ & WebGL 360° Panorama Engine
 * © 2026 Wolf Studio (https://wolf-studio.ru) | Кирилл Бахарев. Все права защищены.
 *
 * Любое копирование, декомпиляция, модификация или размещение данного движка
 * на сторонних сайтах без письменного разрешения правообладателя строго
 * запрещены (ст. 1259, 1301 ГК РФ).
 * ============================================================================
 */
(function(global) {
  'use strict';

  const EPSILON = 1e-6;
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function clamp(val, min, max) {
    return val < min ? min : (val > max ? max : val);
  }

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function pixelRatio() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    return Math.min(dpr, 2);
  }


  function htov(hfov, width, height) {
    return 2 * Math.atan((height * Math.tan(hfov / 2)) / width);
  }

  function vtoh(vfov, width, height) {
    return 2 * Math.atan((width * Math.tan(vfov / 2)) / height);
  }

  // =========================================================================
  // ВСТРОЕННАЯ МАТРИЧНАЯ И ВЕКТОРНАЯ МАТЕМАТИКА
  // =========================================================================
  const Mat4 = {
    create() {
      const out = new Float32Array(16);
      out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
      return out;
    },
    copy(out, a) {
      out.set(a);
      return out;
    },
    perspective(out, fovy, aspect, near, far) {
      const f = 1.0 / Math.tan(fovy / 2);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[11] = -1;
      if (far != null && far !== Infinity) {
        const nf = 1 / (near - far);
        out[10] = (far + near) * nf;
        out[14] = 2 * far * near * nf;
      } else {
        out[10] = -1;
        out[14] = -2 * near;
      }
      return out;
    },
    rotateX(out, a, rad) {
      const s = Math.sin(rad), c = Math.cos(rad);
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      if (a !== out) out.set(a);
      out[4] = a10 * c + a20 * s; out[5] = a11 * c + a21 * s;
      out[6] = a12 * c + a22 * s; out[7] = a13 * c + a23 * s;
      out[8] = a20 * c - a10 * s; out[9] = a21 * c - a11 * s;
      out[10] = a22 * c - a12 * s; out[11] = a23 * c - a13 * s;
      return out;
    },
    rotateY(out, a, rad) {
      const s = Math.sin(rad), c = Math.cos(rad);
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      if (a !== out) out.set(a);
      out[0] = a00 * c - a20 * s; out[1] = a01 * c - a21 * s;
      out[2] = a02 * c - a22 * s; out[3] = a03 * c - a23 * s;
      out[8] = a00 * s + a20 * c; out[9] = a01 * s + a21 * c;
      out[10] = a02 * s + a22 * c; out[11] = a03 * s + a23 * c;
      return out;
    },
    rotateZ(out, a, rad) {
      const s = Math.sin(rad), c = Math.cos(rad);
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      if (a !== out) out.set(a);
      out[0] = a00 * c + a10 * s; out[1] = a01 * c + a11 * s;
      out[2] = a02 * c + a12 * s; out[3] = a03 * c + a13 * s;
      out[4] = a10 * c - a00 * s; out[5] = a11 * c - a01 * s;
      out[6] = a12 * c - a02 * s; out[7] = a13 * c - a03 * s;
      return out;
    },
    translate(out, a, x, y, z) {
      if (a !== out) out.set(a);
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
      return out;
    },
    scale(out, a, x, y, z) {
      if (a !== out) out.set(a);
      out[0] *= x; out[1] *= x; out[2] *= x; out[3] *= x;
      out[4] *= y; out[5] *= y; out[6] *= y; out[7] *= y;
      out[8] *= z; out[9] *= z; out[10] *= z; out[11] *= z;
      return out;
    },
    invert(out, a) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
      const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
      const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1.0 / det;
      out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    },
    transformVec4(out, v, m) {
      const x = v[0], y = v[1], z = v[2], w = v[3];
      out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
      out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
      out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
      out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
      return out;
    }
  };

  class EventEmitter {
    constructor() {
      this._listeners = {};
    }
    addEventListener(type, fn) {
      if (!this._listeners[type]) this._listeners[type] = [];
      if (this._listeners[type].indexOf(fn) === -1) this._listeners[type].push(fn);
    }
    removeEventListener(type, fn) {
      const list = this._listeners[type];
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    }
    emit(type, ...args) {
      const list = this._listeners[type];
      if (!list) return;
      const copy = list.slice();
      for (let i = 0; i < copy.length; i++) copy[i].apply(this, args);
    }
  }
  // =========================================================================
  // КАМЕРА (RECTILINEAR VIEW) И ЛИМИТЕРЫ
  // =========================================================================
  class RectilinearView extends EventEmitter {
    constructor(params, limiter) {
      super();
      params = params || {};
      this._yaw = params.yaw != null ? params.yaw : 0;
      this._pitch = params.pitch != null ? params.pitch : 0;
      this._roll = params.roll != null ? params.roll : 0;
      this._fov = params.fov != null ? params.fov : Math.PI / 4;
      this._width = params.width || 0;
      this._height = params.height || 0;
      this._limiter = limiter || null;
      this._projMatrix = Mat4.create();
      this._invProjMatrix = Mat4.create();
      this._frustum = [
        new Float32Array(4), new Float32Array(4),
        new Float32Array(4), new Float32Array(4), new Float32Array(4)
      ];
      this._projectionChanged = true;
      this._tmpVec = new Float32Array(4);
      this._update({});
    }

    yaw() { return this._yaw; }
    pitch() { return this._pitch; }
    roll() { return this._roll; }
    fov() { return this._fov; }
    width() { return this._width; }
    height() { return this._height; }
    size(out) { out = out || {}; out.width = this._width; out.height = this._height; return out; }
    parameters(out) {
      out = out || {};
      out.yaw = this._yaw; out.pitch = this._pitch;
      out.roll = this._roll; out.fov = this._fov;
      return out;
    }

    setYaw(v) { this._update({ yaw: v }); }
    setPitch(v) { this._update({ pitch: v }); }
    setRoll(v) { this._update({ roll: v }); }
    setFov(v) { this._update({ fov: v }); }
    offsetYaw(v) { this.setYaw(this._yaw + v); }
    offsetPitch(v) { this.setPitch(this._pitch + v); }
    offsetRoll(v) { this.setRoll(this._roll + v); }
    offsetFov(v) { this.setFov(this._fov + v); }
    setSize(s) { this._update({ width: s.width, height: s.height }); }
    setParameters(p) {
      this._update({ yaw: p.yaw, pitch: p.pitch, roll: p.roll, fov: p.fov });
    }

    _update(p) {
      const prevYaw = this._yaw, prevPitch = this._pitch, prevRoll = this._roll;
      const prevFov = this._fov, prevW = this._width, prevH = this._height;

      let state = {
        yaw: p.yaw != null ? p.yaw : prevYaw,
        pitch: p.pitch != null ? p.pitch : prevPitch,
        roll: p.roll != null ? p.roll : prevRoll,
        fov: p.fov != null ? p.fov : prevFov,
        width: p.width != null ? p.width : prevW,
        height: p.height != null ? p.height : prevH
      };

      if (this._limiter) state = this._limiter(state) || state;

      state.yaw = mod(state.yaw - Math.PI, -2 * Math.PI) + Math.PI;
      state.pitch = mod(state.pitch - Math.PI, -2 * Math.PI) + Math.PI;
      state.roll = mod(state.roll - Math.PI, -2 * Math.PI) + Math.PI;

      const maxVfov = htov(Math.PI, state.width, state.height);
      const limitFov = isNaN(maxVfov) ? Math.PI : Math.min(Math.PI, maxVfov);
      state.fov = clamp(state.fov, EPSILON, limitFov - EPSILON);

      this._yaw = state.yaw; this._pitch = state.pitch; this._roll = state.roll;
      this._fov = state.fov; this._width = state.width; this._height = state.height;

      if (this._yaw !== prevYaw || this._pitch !== prevPitch || this._roll !== prevRoll ||
          this._fov !== prevFov || this._width !== prevW || this._height !== prevH) {
        this._projectionChanged = true;
        this.emit('change');
      }
      if (this._width !== prevW || this._height !== prevH) this.emit('resize');
    }

    _updateProjection() {
      if (!this._projectionChanged) return;
      const m = this._projMatrix;
      const aspect = (this._width > 0 && this._height > 0) ? (this._width / this._height) : 1;
      Mat4.perspective(m, this._fov, aspect, -1, 1);
      Mat4.rotateZ(m, m, this._roll);
      Mat4.rotateX(m, m, this._pitch);
      Mat4.rotateY(m, m, this._yaw);
      Mat4.invert(this._invProjMatrix, m);

      const f = this._frustum;
      f[0].set([m[3] + m[0], m[7] + m[4], m[11] + m[8], 0]);
      f[1].set([m[3] - m[0], m[7] - m[4], m[11] - m[8], 0]);
      f[2].set([m[3] + m[1], m[7] + m[5], m[11] + m[9], 0]);
      f[3].set([m[3] - m[1], m[7] - m[5], m[11] - m[9], 0]);
      f[4].set([m[3] + m[2], m[7] + m[6], m[11] + m[10], 0]);
      this._projectionChanged = false;
    }

    projection() { this._updateProjection(); return this._projMatrix; }
    inverseProjection() { this._updateProjection(); return this._invProjMatrix; }

    intersects(vertices) {
      this._updateProjection();
      for (let i = 0; i < this._frustum.length; i++) {
        const plane = this._frustum[i];
        let inside = false;
        for (let j = 0; j < vertices.length; j++) {
          const v = vertices[j];
          if (plane[0] * v[0] + plane[1] * v[1] + plane[2] * v[2] >= 0) {
            inside = true;
            break;
          }
        }
        if (!inside) return false;
      }
      return true;
    }

    selectLevel(levels) {
      const targetH = pixelRatio() * this._height;
      const tanHalf = Math.tan(0.5 * this._fov);
      for (let i = 0; i < levels.length; i++) {
        if (tanHalf * levels[i].size >= targetH) return levels[i];
      }
      return levels[levels.length - 1];
    }

    coordinatesToScreen(coords, out) {
      out = out || {};
      if (this._width <= 0 || this._height <= 0) {
        out.x = null; out.y = null; return null;
      }
      const yaw = coords.yaw, pitch = coords.pitch;
      const cosP = Math.cos(pitch);
      const v = this._tmpVec;
      v[0] = Math.sin(yaw) * cosP;
      v[1] = -Math.sin(pitch);
      v[2] = -Math.cos(yaw) * cosP;
      v[3] = 1;
      Mat4.transformVec4(v, v, this.projection());
      if (v[3] >= 0) {
        out.x = this._width * (v[0] / v[3] + 1) / 2;
        out.y = this._height * (1 - v[1] / v[3]) / 2;
        return out;
      }
      out.x = null; out.y = null;
      return null;
    }
  }

  RectilinearView.limit = {
    yaw: (min, max) => (s) => { s.yaw = clamp(s.yaw, min, max); return s; },
    pitch: (min, max) => (s) => { s.pitch = clamp(s.pitch, min, max); return s; },
    vfov: (min, max) => (s) => { s.fov = clamp(s.fov, min, max); return s; },
    hfov: (min, max) => (s) => {
      if (s.width > 0 && s.height > 0) {
        s.fov = clamp(s.fov, htov(min, s.width, s.height), htov(max, s.width, s.height));
      }
      return s;
    },
    resolution: (maxRes) => (s) => {
      if (s.height > 0) {
        const minFov = 2 * Math.atan((pixelRatio() * s.height) / maxRes);
        s.fov = clamp(s.fov, minFov, Infinity);
      }
      return s;
    },
    traditional: (maxRes, maxVfov, maxHfov) => {
      maxHfov = maxHfov != null ? maxHfov : maxVfov;
      const limRes = RectilinearView.limit.resolution(maxRes);
      const limV = RectilinearView.limit.vfov(0, maxVfov);
      const limH = RectilinearView.limit.hfov(0, maxHfov);
      const limP = RectilinearView.limit.pitch(-Math.PI / 2, Math.PI / 2);
      return (s) => limP(limH(limV(limRes(s))));
    }
  };
  // =========================================================================
  // ГЕОМЕТРИЯ КУБА (CUBE GEOMETRY) И ИСТОЧНИК ТАЙЛОВ (IMAGE URL SOURCE)
  // =========================================================================
  const FACE_ROT = {
    f: { x: 0, y: 0 }, b: { x: 0, y: Math.PI },
    l: { x: 0, y: Math.PI / 2 }, r: { x: 0, y: -Math.PI / 2 },
    u: { x: Math.PI / 2, y: 0 }, d: { x: -Math.PI / 2, y: 0 }
  };
  const FACE_ORDER = 'fudlrb';

  function rotateVec3(v, rx, ry) {
    if (rx) {
      const s = Math.sin(rx), c = Math.cos(rx);
      const y = v[1] * c - v[2] * s, z = v[1] * s + v[2] * c;
      v[1] = y; v[2] = z;
    }
    if (ry) {
      const s = Math.sin(ry), c = Math.cos(ry);
      const x = v[0] * c + v[2] * s, z = -v[0] * s + v[2] * c;
      v[0] = x; v[2] = z;
    }
  }


  class CubeTile {
    constructor(face, x, y, z, geometry) {
      this.face = face;
      this.x = x;
      this.y = y;
      this.z = z;
      this.geometry = geometry;
      this._level = geometry.levelList[z];
      this.key = `${z}_${face}_${y}_${x}`;
    }
    rotX() { return FACE_ROT[this.face].x; }
    rotY() { return FACE_ROT[this.face].y; }
    centerX() { return (this.x + 0.5) / this._level.numTiles - 0.5; }
    centerY() { return 0.5 - (this.y + 0.5) / this._level.numTiles; }
    scale() { return 1 / this._level.numTiles; }
    vertices() {
      if (this._verts) return this._verts;
      const r = FACE_ROT[this.face];
      const hs = this.scale() / 2;
      const cx = this.centerX(), cy = this.centerY();
      const pts = [
        new Float32Array([cx - hs, cy + hs, -0.5]),
        new Float32Array([cx + hs, cy + hs, -0.5]),
        new Float32Array([cx + hs, cy - hs, -0.5]),
        new Float32Array([cx - hs, cy - hs, -0.5])
      ];
      for (let i = 0; i < 4; i++) rotateVec3(pts[i], r.x, r.y);
      this._verts = pts;
      return pts;
    }
    parent() {
      if (this.z === 0) return null;
      const curN = this._level.numTiles;
      const parN = this.geometry.levelList[this.z - 1].numTiles;
      return new CubeTile(
        this.face,
        Math.floor(this.x / curN * parN),
        Math.floor(this.y / curN * parN),
        this.z - 1,
        this.geometry
      );
    }
  }

  class CubeGeometry {
    constructor(levels) {
      this.levelList = levels.slice().sort((a, b) => a.size - b.size).map((l, idx) => ({
        index: idx,
        size: l.size,
        tileSize: l.tileSize,
        fallbackOnly: !!l.fallbackOnly,
        numTiles: Math.ceil(l.size / l.tileSize)
      }));
      this.selectableLevelList = this.levelList.filter(l => !l.fallbackOnly);
      if (!this.selectableLevelList.length) this.selectableLevelList = this.levelList;
      this._levelTilesCache = {};
    }
    levelTiles(z) {
      if (this._levelTilesCache[z]) return this._levelTilesCache[z];
      const n = this.levelList[z].numTiles;
      const list = [];
      for (let f = 0; f < FACE_ORDER.length; f++) {
        const face = FACE_ORDER[f];
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            list.push(new CubeTile(face, x, y, z, this));
          }
        }
      }
      this._levelTilesCache[z] = list;
      return list;
    }
    visibleTiles(view) {
      const targetLvl = view.selectLevel(this.selectableLevelList);
      const candidates = this.levelTiles(targetLvl.index);
      const res = [];
      for (let i = 0; i < candidates.length; i++) {
        if (view.intersects(candidates[i].vertices())) res.push(candidates[i]);
      }
      return res;
    }
  }

  class ImageUrlSource {
    constructor(template, opts) {
      this._template = template;
      this._previewUrl = opts && opts.cubeMapPreviewUrl ? opts.cubeMapPreviewUrl : null;
      this._faceOrder = (opts && opts.cubeMapPreviewFaceOrder) || 'bdflru';
    }
    static fromString(template, opts) {
      return new ImageUrlSource(template, opts);
    }
    getTileDescriptor(tile) {
      if (tile.z === 0 && this._previewUrl) {
        const idx = this._faceOrder.indexOf(tile.face);
        return { url: this._previewUrl, previewIndex: idx >= 0 ? idx : 0 };
      }
      const url = this._template
        .replace(/\{z\}/g, tile.z)
        .replace(/\{f\}/g, tile.face)
        .replace(/\{y\}/g, tile.y)
        .replace(/\{x\}/g, tile.x);
      return { url, previewIndex: -1 };
    }
  }

  // =========================================================================
  // МЕНЕДЖЕР ТЕКСТУР И WEBGL-РЕНДЕРЕР КУБА
  // =========================================================================
  class TextureManager {
    constructor(gl, onLoaded) {
      this.gl = gl;
      this.onLoaded = onLoaded;
      this.textures = new Map();
      this.loading = new Set();
      this.queue = [];
      this.activeLoads = 0;
      this.maxConcurrency = 12;
      this.previewCache = new Map();
    }

    get(sceneId, source, tile, highPriority) {
      const cacheKey = `${sceneId}:${tile.key}`;
      if (this.textures.has(cacheKey)) return this.textures.get(cacheKey);
      if (this.loading.has(cacheKey)) return null;

      const desc = source.getTileDescriptor(tile);
      this.loading.add(cacheKey);
      const job = { cacheKey, desc };
      if (tile.z === 0) {
        this.activeLoads++;
        this._loadJob(job);
        return null;
      }
      if (highPriority) {
        this.queue.unshift(job);
      } else {
        this.queue.push(job);
      }
      this._pump();
      return null;
    }

    _pump() {
      while (this.activeLoads < this.maxConcurrency && this.queue.length > 0) {
        const job = this.queue.shift();
        this.activeLoads++;
        this._loadJob(job);
      }
    }

    _loadJob(job) {
      const done = (imgSource) => {
        this.activeLoads--;
        this.loading.delete(job.cacheKey);
        if (imgSource && this.gl) {
          const tex = this._uploadTexture(imgSource);
          this.textures.set(job.cacheKey, tex);
          if (this.onLoaded) this.onLoaded();
        }
        this._pump();
      };

            if (job.desc.previewIndex >= 0) {
        this._loadPreviewSlice(job.desc.url, job.desc.previewIndex, done);
      } else {
        const img = new Image();
        if (/^https?:\/\//i.test(job.desc.url)) img.crossOrigin = 'anonymous';
        img.onload = () => done(img);
        img.onerror = () => done(null);
        img.src = job.desc.url;
      }
    }

    _loadPreviewSlice(url, faceIdx, cb) {
      const sliceFromImg = (img) => {
        const w = img.naturalWidth || img.width;
        const h = Math.floor((img.naturalHeight || img.height) / 6);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, faceIdx * h, w, h, 0, 0, w, h);
        cb(canvas);
      };

      let entry = this.previewCache.get(url);
      if (entry) {
        if (entry.img) return sliceFromImg(entry.img);
        if (entry.error) return cb(null);
        entry.waiters.push(sliceFromImg);
        return;
      }

      entry = { img: null, error: false, waiters: [sliceFromImg] };
      this.previewCache.set(url, entry);
      const img = new Image();
      if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        entry.img = img;
        entry.waiters.forEach(fn => fn(img));
        entry.waiters.length = 0;
      };
      img.onerror = () => {
        entry.error = true;
        entry.waiters.forEach(() => cb(null));
        entry.waiters.length = 0;
      };
      img.src = url;
    }

    _uploadTexture(source) {
      const gl = this.gl;
      if (this.textures.size > 140) {
        for (const [oldKey, oldTex] of this.textures) {
          if (!oldKey.includes(':0_')) {
            gl.deleteTexture(oldTex);
            this.textures.delete(oldKey);
            if (this.textures.size <= 110) break;
          }
        }
      }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return tex;
    }
  }
  // =========================================================================
  // WEBGL РЕНДЕРЕР КУБА
  // =========================================================================
  class CubeRenderer {
    constructor(gl) {
      this.gl = gl;
      this.projMatrix = Mat4.create();
      this.program = this._createProgram(
        `attribute vec3 aPos;
         attribute vec2 aUv;
         uniform mat4 uProj;
         uniform float uDepth;
         varying vec2 vUv;
         void main() {
           gl_Position = uProj * vec4(aPos, 1.0);
           gl_Position.z = uDepth * gl_Position.w;
           vUv = aUv;
         }`,
        `precision mediump float;
         uniform sampler2D uSampler;
         uniform float uOpacity;
         varying vec2 vUv;
         void main() {
           vec4 col = texture2D(uSampler, vUv);
           gl_FragColor = vec4(col.rgb, col.a * uOpacity);
         }`
      );
      this.posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5,-0.5,0, 0.5,-0.5,0, 0.5,0.5,0, -0.5,0.5,0]), gl.STATIC_DRAW);

      this.uvBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 1,1, 0,1]), gl.STATIC_DRAW);

      this.idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);
    }

    _createProgram(vsSrc, fsSrc) {
      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(prog);
      prog.aPos = gl.getAttribLocation(prog, 'aPos');
      prog.aUv = gl.getAttribLocation(prog, 'aUv');
      prog.uProj = gl.getUniformLocation(prog, 'uProj');
      prog.uDepth = gl.getUniformLocation(prog, 'uDepth');
      prog.uSampler = gl.getUniformLocation(prog, 'uSampler');
      prog.uOpacity = gl.getUniformLocation(prog, 'uOpacity');
      return prog;
    }

    renderScene(scene, texMgr, opacity, layerOffset) {
      const gl = this.gl;
      const p = this.program;
      gl.useProgram(p);
      gl.enableVertexAttribArray(p.aPos);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.vertexAttribPointer(p.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(p.aUv);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
      gl.vertexAttribPointer(p.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);

      gl.uniform1f(p.uOpacity, opacity);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(p.uSampler, 0);

      const visible = scene._geometry.visibleTiles(scene._view);
      const drawMap = new Map();

      for (let i = 0; i < visible.length; i++) {
        const tile = visible[i];
        const tex = texMgr.get(scene._uid, scene._source, tile, true);
        if (tex) {
          drawMap.set(tile.key, { tile, tex });
        } else {
          let par = tile.parent();
          while (par) {
            const pTex = texMgr.get(scene._uid, scene._source, par, true);
            if (pTex) { drawMap.set(par.key, { tile: par, tex: pTex }); break; }
            par = par.parent();
          }
        }
      }

      const items = Array.from(drawMap.values()).sort((a, b) => b.tile.z - a.tile.z);
      const baseProj = scene._view.projection();

      for (let i = 0; i < items.length; i++) {
        const { tile, tex } = items[i];
        Mat4.copy(this.projMatrix, baseProj);
        Mat4.rotateX(this.projMatrix, this.projMatrix, tile.rotX());
        Mat4.rotateY(this.projMatrix, this.projMatrix, tile.rotY());
        Mat4.translate(this.projMatrix, this.projMatrix, tile.centerX(), tile.centerY(), -0.5);
        Mat4.scale(this.projMatrix, this.projMatrix, tile.scale(), tile.scale(), 1);

        const depth = ((layerOffset + 1) * 16 - tile.z) / 64;
        gl.uniform1f(p.uDepth, depth);
        gl.uniformMatrix4fv(p.uProj, false, this.projMatrix);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
    }
  }
  // =========================================================================
  // ХОТСПОТЫ, СЦЕНА И VIEWER С УПРАВЛЕНИЕМ НА POINTER EVENTS
  // =========================================================================
  class Hotspot {
    constructor(element, container, view, coords) {
      this._el = element;
      this._container = container;
      this._view = view;
      this._coords = { yaw: coords.yaw || 0, pitch: coords.pitch || 0 };
      this._pos = { x: 0, y: 0 };
      this._container.appendChild(this._el);
      this._update();
    }
    domElement() { return this._el; }
    position() { return this._coords; }
    setPosition(c) { Object.assign(this._coords, c); this._update(); }
    destroy() { if (this._el.parentNode) this._el.parentNode.removeChild(this._el); }
    _update() {
      const res = this._view.coordinatesToScreen(this._coords, this._pos);
      if (res && res.x != null && res.y != null) {
        this._el.style.display = 'block';
        this._el.style.position = 'absolute';
        this._el.style.transform = `translate3d(${res.x.toFixed(2)}px, ${res.y.toFixed(2)}px, 0)`;
      } else {
        this._el.style.display = 'none';
      }
    }
  }

  class HotspotContainer {
    constructor(parentEl, view) {
      this._view = view;
      this._hotspots = [];
      this._el = document.createElement('div');
      this._el.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:5;';
      parentEl.appendChild(this._el);
    }
    createHotspot(el, coords) {
      el.style.pointerEvents = 'auto';
      const hs = new Hotspot(el, this._el, this._view, coords);
      this._hotspots.push(hs);
      return hs;
    }
    destroyHotspot(hs) {
      const idx = this._hotspots.indexOf(hs);
      if (idx !== -1) { this._hotspots.splice(idx, 1); hs.destroy(); }
    }
    listHotspots() { return this._hotspots.slice(); }
    show() { this._el.style.display = 'block'; }
    hide() { this._el.style.display = 'none'; }
    _update() {
      for (let i = 0; i < this._hotspots.length; i++) this._hotspots[i]._update();
    }
  }

  // =========================================================================
  // КОНТРОЛЛЕР ГИРОСКОПА С ОТНОСИТЕЛЬНОЙ ПРИВЯЗКОЙ К ТОЧКЕ СТАРТА
  // =========================================================================
  class GyroscopeController extends EventEmitter {
    constructor(viewer) {
      super();
      this._viewer = viewer;
      this._enabled = false;
      this._calibrated = false;
      this._baseYaw = 0;
      this._basePitch = 0;
      this._refYaw = 0;
      this._refPitch = 0;
      this._targetYaw = 0;
      this._targetPitch = 0;
      this._smoothYaw = 0;
      this._smoothPitch = 0;
      this._hasSmooth = false;
      this._onOrientation = this._onOrientation.bind(this);
    }

    isEnabled() {
      return this._enabled;
    }

    static isSupported() {
      if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false;
      const ua = navigator.userAgent || '';
      const isMobileOS = /Android|iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return isMobileOS;
    }

    async enable() {
      if (this._enabled) return true;
      if (typeof DeviceOrientationEvent === 'undefined') return false;

      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const state = await DeviceOrientationEvent.requestPermission();
          if (state !== 'granted') return false;
        } catch (e) {
          return false;
        }
      }

      const v = this._viewer.view();
      this._baseYaw = v ? v.yaw() : 0;
      this._basePitch = v ? v.pitch() : 0;
      this._calibrated = false;
      this._refYaw = 0;
      this._refPitch = 0;
      this._hasSmooth = false;
      this._enabled = true;

      this._onScreenRotate = () => {
        const curV = this._viewer.view();
        this._baseYaw = curV ? curV.yaw() : this._baseYaw;
        this._basePitch = curV ? curV.pitch() : this._basePitch;
        this._calibrated = false;
        this._hasSmooth = false;
      };
      window.addEventListener('deviceorientation', this._onOrientation, true);
      window.addEventListener('orientationchange', this._onScreenRotate);
      this.emit('change', true);
      return true;
    }

    disable() {
      if (!this._enabled) return;
      this._enabled = false;
      window.removeEventListener('deviceorientation', this._onOrientation, true);
      if (this._onScreenRotate) window.removeEventListener('orientationchange', this._onScreenRotate);
      this.emit('change', false);
    }

    toggle() {
      if (this._enabled) {
        this.disable();
        return Promise.resolve(true);
      }
      return this.enable();
    }

    offsetManual(dYaw, dPitch) {
      if (!this._enabled) return;
      this._baseYaw += dYaw;
      this._basePitch = clamp(this._basePitch + dPitch, -Math.PI / 2, Math.PI / 2);
      if (this._hasSmooth) {
        this._targetYaw += dYaw;
        this._targetPitch = clamp(this._targetPitch + dPitch, -Math.PI / 2, Math.PI / 2);
        this._smoothYaw += dYaw;
        this._smoothPitch = clamp(this._smoothPitch + dPitch, -Math.PI / 2, Math.PI / 2);
      }
    }

    _getWorldAngles(alphaDeg, betaDeg, gammaDeg, screenAngleDeg) {
      const a = alphaDeg * DEG2RAD;
      const b = betaDeg * DEG2RAD;
      const g = gammaDeg * DEG2RAD;
      const s = screenAngleDeg * DEG2RAD;

      const cA = Math.cos(a), sA = Math.sin(a);
      const cB = Math.cos(b), sB = Math.sin(b);
      const cG = Math.cos(g), sG = Math.sin(g);

      // Вектор взгляда задней камеры (0, 0, -1) в мировых координатах (East, North, Up)
      const lookE = -cA * sG - sA * sB * cG;
      const lookN = -sA * sG + cA * sB * cG;
      const lookU = -cB * cG;

      // Вектор верхнего торца телефона (0, 1, 0) и правого края (1, 0, 0)
      const devUpE = -sA * cB;
      const devUpN = cA * cB;

      const devRightE = cA * cG - sA * sB * sG;
      const devRightN = sA * cG + cA * sB * sG;

      // Реальный «верх» экрана с учётом портретной/альбомной ориентации
      const cS = Math.cos(s), sS = Math.sin(s);
      const scrUpE = devUpE * cS + devRightE * sS;
      const scrUpN = devUpN * cS + devRightN * sS;

      // В вертикали и альбоме в надире (lookU < 0) верх экрана смотрит вперёд (+scrUp),
      // а в зените (lookU > 0) — назад (-scrUp), но применяем это только при наклоне > 45°
      const poleSign = lookU > 0 ? -1 : 1;
      const absU = Math.abs(lookU);
      const horizE = lookE + poleSign * absU * scrUpE;
      const horizN = lookN + poleSign * absU * scrUpN;

      const worldYaw = Math.atan2(horizE, horizN);
      const worldPitch = Math.asin(clamp(-lookU, -1, 1));
      return { yaw: worldYaw, pitch: worldPitch };
    }

    _onOrientation(e) {
      if (!this._enabled || e.alpha == null || e.beta == null || e.gamma == null) return;
      const v = this._viewer.view();
      if (!v) return;

      let screenAngle = 0;
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number') {
        screenAngle = window.screen.orientation.angle;
      } else if (typeof window.orientation === 'number') {
        screenAngle = window.orientation;
      }

      const cur = this._getWorldAngles(e.alpha, e.beta, e.gamma, screenAngle);

      if (!this._calibrated) {
        this._refYaw = cur.yaw;
        this._refPitch = cur.pitch;
        this._calibrated = true;
        return;
      }

      let relYaw = cur.yaw - this._refYaw;
      while (relYaw > Math.PI) relYaw -= 2 * Math.PI;
      while (relYaw < -Math.PI) relYaw += 2 * Math.PI;

      const relPitch = cur.pitch - this._refPitch;

      this._targetYaw = this._baseYaw + relYaw;
      this._targetPitch = clamp(this._basePitch + relPitch, -Math.PI * 0.48, Math.PI * 0.48);

      if (!this._hasSmooth) {
        this._smoothYaw = this._targetYaw;
        this._smoothPitch = this._targetPitch;
        this._hasSmooth = true;
      }
    }

    update(dt) {
      if (!this._enabled || !this._hasSmooth) return;
      const v = this._viewer.view();
      if (!v) return;

      let diffYaw = this._targetYaw - this._smoothYaw;
      while (diffYaw > Math.PI) diffYaw -= 2 * Math.PI;
      while (diffYaw < -Math.PI) diffYaw += 2 * Math.PI;
      const diffPitch = this._targetPitch - this._smoothPitch;

      if (Math.abs(diffYaw) < 1e-5 && Math.abs(diffPitch) < 1e-5) return;

      const alpha = 1 - Math.exp(-32 * dt);
      this._smoothYaw += diffYaw * alpha;
      this._smoothPitch += diffPitch * alpha;

      if (!isNaN(this._smoothYaw) && !isNaN(this._smoothPitch)) {
        v.setYaw(this._smoothYaw);
        v.setPitch(this._smoothPitch);
        this._viewer._dirty = true;
        this._viewer.emit('viewChange');
      }
    }
  }

  let SCENE_UID_COUNTER = 1;

  class Scene {
    constructor(viewer, opts) {
      this._uid = SCENE_UID_COUNTER++;
      this._viewer = viewer;
      this._source = opts.source;
      this._geometry = opts.geometry;
      this._view = opts.view;
      this._hotspots = new HotspotContainer(viewer._overlayEl, this._view);
      this._hotspots.hide();
      if (opts.pinFirstLevel && this._geometry && this._source) {
        const z0 = this._geometry.levelTiles(0);
        for (let i = 0; i < z0.length; i++) viewer._texMgr.get(this._uid, this._source, z0[i]);
      }
    }
    view() { return this._view; }
    hotspotContainer() { return this._hotspots; }
    switchTo(opts) { this._viewer.switchScene(this, opts); }
  }

  class Viewer extends EventEmitter {
    constructor(domElement, opts) {
      super();
      this._dom = domElement;
      this._opts = opts || {};
      this._canvas = document.createElement('canvas');
      this._canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;touch-action:none;';
      this._dom.appendChild(this._canvas);

      this._overlayEl = document.createElement('div');
      this._overlayEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;';
      this._dom.appendChild(this._overlayEl);

      const glOpts = { alpha: false, antialias: true, depth: true, preserveDrawingBuffer: false };
      this._gl = this._canvas.getContext('webgl', glOpts) || this._canvas.getContext('experimental-webgl', glOpts);
      this._dirty = true;
      this._texMgr = new TextureManager(this._gl, () => { this._dirty = true; });
      this._cubeRenderer = this._gl ? new CubeRenderer(this._gl) : null;

      this._scenes = [];
      this._currentScene = null;
      this._prevScene = null;
      this._compareScene = null;
      this._splitRatio = 0.5;
      this._fadeAlpha = 1;
      this._fadeStart = 0;
      this._fadeDuration = 450;

      const ctrl = (this._opts && this._opts.controls) || {};
      this._dragSpeed = ctrl.dragSpeed != null ? ctrl.dragSpeed : 0.75;
      this._inertiaDamping = ctrl.inertiaDamping != null ? ctrl.inertiaDamping : 4.5;
      this._scrollLocked = Boolean(ctrl.scrollLocked);
      this._velYaw = 0;
      this._velPitch = 0;
      this._lastTime = performance.now();
      this._gyro = new GyroscopeController(this);

      this.updateSize();
      window.addEventListener('resize', () => this.updateSize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.updateSize(), 150));
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => this.updateSize()).observe(this._dom);
      }
      this._bindControls();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    scene() { return this._currentScene; }
    view() { return this._currentScene ? this._currentScene.view() : null; }
    gyroscope() { return this._gyro; }
    setScrollLocked(locked) { this._scrollLocked = Boolean(locked); }
    setCompareScene(scene, ratio) {
      this._compareScene = scene || null;
      if (ratio != null) this._splitRatio = clamp(ratio, 0, 1);
      this._dirty = true;
    }
    setSplitRatio(ratio) {
      this._splitRatio = clamp(ratio, 0, 1);
      this._dirty = true;
    }

    updateSize() {
      const w = this._dom.clientWidth || 1;
      const h = this._dom.clientHeight || 1;
      const dpr = pixelRatio();
      this._canvas.width = Math.round(w * dpr);
      this._canvas.height = Math.round(h * dpr);
      if (this._currentScene) this._currentScene.view().setSize({ width: w, height: h });
      if (this._prevScene) this._prevScene.view().setSize({ width: w, height: h });
      this._dirty = true;
    }

    createScene(opts) {
      const sc = new Scene(this, opts);
      sc.view().setSize({ width: this._dom.clientWidth || 1, height: this._dom.clientHeight || 1 });
      this._scenes.push(sc);
      return sc;
    }

    switchScene(scene, opts) {
      if (this._currentScene === scene) return;
      if (this._currentScene) {
        this._prevScene = this._currentScene;
        this._prevScene.hotspotContainer().hide();
        this._fadeAlpha = 0;
        this._fadeStart = performance.now();
        this._fadeDuration = (opts && opts.transitionDuration != null) ? opts.transitionDuration : 450;
      } else {
        this._fadeAlpha = 1;
      }
      this._currentScene = scene;
      scene.view().setSize({ width: this._dom.clientWidth || 1, height: this._dom.clientHeight || 1 });
      scene.hotspotContainer().show();
      this._dirty = true;
      this.emit('sceneChange');
      this.emit('viewChange');
    }
    _bindControls() {
      const el = this._canvas;
      const pointers = new Map();
      let lastCenter = null, lastDist = 0, isDragging = false;

      const getCenter = () => {
        let x = 0, y = 0;
        pointers.forEach(p => { x += p.clientX; y += p.clientY; });
        return { x: x / pointers.size, y: y / pointers.size };
      };
      const getDist = () => {
        const arr = Array.from(pointers.values());
        if (arr.length < 2) return 0;
        return Math.hypot(arr[0].clientX - arr[1].clientX, arr[0].clientY - arr[1].clientY);
      };

      el.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
      }, { passive: false });

      el.addEventListener('pointerdown', (e) => {
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        pointers.set(e.pointerId, e);
        lastCenter = getCenter();
        lastDist = getDist();
        isDragging = true;
        this._velYaw = 0;
        this._velPitch = 0;
        el.style.cursor = 'grabbing';
      });

      el.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, e);
        const v = this.view();
        if (!v || !isDragging) return;

        const center = getCenter();
        const dx = center.x - lastCenter.x;
        const dy = center.y - lastCenter.y;
        lastCenter = center;

        const w = this._dom.clientWidth || 1;
        const h = this._dom.clientHeight || 1;
        const vfov = v.fov();
        const hfov = vtoh(vfov, w, h);

        const dYaw = -(dx / w) * hfov * this._dragSpeed;
        const dPitch = -(dy / h) * vfov * this._dragSpeed;
        v.offsetYaw(dYaw);
        v.offsetPitch(dPitch);
        if (this._gyro && this._gyro.isEnabled()) {
          this._gyro.offsetManual(dYaw, dPitch);
        }
        this._velYaw = this._velYaw * 0.45 + (dYaw * 55) * 0.55;
        this._velPitch = this._velPitch * 0.45 + (dPitch * 55) * 0.55;

        if (pointers.size >= 2) {
          const dist = getDist();
          if (lastDist > 0 && dist > 0) {
            v.offsetFov(-(dist / lastDist - 1) * vfov);
          }
          lastDist = dist;
        }
        this._dirty = true;
        this.emit('viewChange');
      });

      const endPointer = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size === 0) {
          isDragging = false;
          el.style.cursor = 'grab';
        } else {
          lastCenter = getCenter();
          lastDist = getDist();
        }
      };
      el.addEventListener('pointerup', endPointer);
      el.addEventListener('pointercancel', endPointer);
      el.style.cursor = 'grab';

      el.addEventListener('wheel', (e) => {
        if (this._scrollLocked && !e.ctrlKey && !e.metaKey) {
          this.emit('scrollBlocked');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const v = this.view();
        if (!v) return;
        const delta = (e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY) * 0.001;
        v.offsetFov(delta * v.fov());
        this._dirty = true;
        this.emit('viewChange');
      }, { passive: false });
    }

    _loop(now) {
      const dt = Math.min((now - this._lastTime) / 1000, 0.1);
      this._lastTime = now;

      const curW = this._dom.clientWidth || 0;
      const curH = this._dom.clientHeight || 0;
      if (curW > 0 && curH > 0 && (curW !== this._lastDomW || curH !== this._lastDomH)) {
        this._lastDomW = curW;
        this._lastDomH = curH;
        this.updateSize();
      }

      if (this._gyro && this._gyro.isEnabled()) {
        this._gyro.update(dt);
      }

      if (Math.abs(this._velYaw) > 1e-4 || Math.abs(this._velPitch) > 1e-4) {
        const v = this.view();
        if (v) {
          v.offsetYaw(this._velYaw * dt);
          v.offsetPitch(this._velPitch * dt);
          const damping = Math.exp(-this._inertiaDamping * dt);
          this._velYaw *= damping;
          this._velPitch *= damping;
          this._dirty = true;
          this.emit('viewChange');
        }
      }

      if (this._prevScene && this._fadeAlpha < 1) {
        this._fadeAlpha = this._fadeDuration > 0
          ? clamp((now - this._fadeStart) / this._fadeDuration, 0, 1)
          : 1;
        if (this._fadeAlpha >= 1) this._prevScene = null;
        this._dirty = true;
      }

      if (this._dirty && this._gl && this._currentScene) {
        const gl = this._gl;
        const cw = this._canvas.width;
        const ch = this._canvas.height;
        gl.viewport(0, 0, cw, ch);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        if (this._compareScene) {
          const splitPx = Math.round(cw * this._splitRatio);
          const curV = this._currentScene.view();
          const cmpV = this._compareScene.view();
          cmpV.setSize({ width: this._dom.clientWidth || 1, height: this._dom.clientHeight || 1 });
          cmpV.setParameters({ yaw: curV.yaw(), pitch: curV.pitch(), roll: curV.roll(), fov: curV.fov() });

          gl.enable(gl.SCISSOR_TEST);
          if (splitPx > 0) {
            gl.scissor(0, 0, splitPx, ch);
            this._cubeRenderer.renderScene(this._currentScene, this._texMgr, 1, 0);
          }
          if (splitPx < cw) {
            gl.scissor(splitPx, 0, cw - splitPx, ch);
            this._cubeRenderer.renderScene(this._compareScene, this._texMgr, 1, 0);
          }
          gl.disable(gl.SCISSOR_TEST);
        } else {
          if (this._prevScene) {
            this._cubeRenderer.renderScene(this._prevScene, this._texMgr, 1, 1);
          }
          this._cubeRenderer.renderScene(this._currentScene, this._texMgr, this._fadeAlpha, 0);
        }
        this._currentScene.hotspotContainer()._update();
        this._dirty = false;
      }

      requestAnimationFrame(this._loop);
    }
  }

  global.WolfTour = {
    Viewer,
    Scene,
    RectilinearView,
    CubeGeometry,
    ImageUrlSource,
    Hotspot,
    HotspotContainer,
    GyroscopeController
  };
})(typeof window !== 'undefined' ? window : this);
