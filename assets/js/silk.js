/* ============================================================
   CLOTHINA — SILK (Three.js)
   قماش حرير متموّج في الخلفية — يُستخدم في التحميل والهيرو
   يعمل حتى لو فتحت الملف مباشرة (file://) بدون سيرفر.
   ============================================================ */
(() => {
  'use strict';
  if (!window.THREE) { console.warn('[CLOTHINA] Three.js غير محمّل'); return; }

  const VERT = `
    uniform float uTime;
    uniform float uAmp;
    varying vec2 vUv;
    varying float vWave;

    void main() {
      vUv = uv;
      vec3 p = position;

      float w1 = sin(p.x * 0.55 + uTime * 0.55) * 0.42;
      float w2 = sin(p.y * 0.85 + uTime * 0.42) * 0.26;
      float w3 = sin((p.x + p.y) * 0.9 - uTime * 0.3) * 0.16;
      float wave = (w1 + w2 + w3);

      p.z += wave * uAmp;
      p.x += sin(p.y * 0.4 + uTime * 0.2) * 0.35 * uAmp;
      vWave = wave;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;

  const FRAG = `
    precision highp float;
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    uniform float uOpacity;
    varying vec2 vUv;
    varying float vWave;

    void main() {
      float g = smoothstep(0.0, 1.0, vUv.y * 0.75 + vUv.x * 0.25);
      vec3 col = mix(uColorA, uColorB, g);

      // لمعة الحرير
      float shine = smoothstep(0.30, 0.0, abs(vWave - 0.30)) * 0.85;
      col = mix(col, uColorC, shine * 0.9);

      // تموّج ضوء ناعم
      float shift = sin(vUv.x * 7.0 + uTime * 0.55) * 0.5 + 0.5;
      col *= 0.965 + shift * 0.045;

      // تلاشي الأطراف
      float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x)
                 * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
      float alpha = uOpacity * mix(0.55, 1.0, edge);

      gl_FragColor = vec4(col, alpha);
    }
  `;

  function initSilk(canvas, opts = {}) {
    if (!canvas) return { destroy() {} };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      console.warn('[CLOTHINA] WebGL غير متاح', e);
      return { destroy() {} };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);
    camera.rotation.z = opts.tilt != null ? opts.tilt : 0.12;

    const geo = new THREE.PlaneGeometry(16, 11, 170, 110);

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: reduce ? 0.25 : (opts.amp != null ? opts.amp : 1) },
      uColorA: { value: new THREE.Color(opts.colorA || '#7C532B') },
      uColorB: { value: new THREE.Color(opts.colorB || '#D4AF37') },
      uColorC: { value: new THREE.Color(opts.colorC || '#F8F5F0') },
      uOpacity: { value: opts.opacity != null ? opts.opacity : 0.95 }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    const resize = () => {
      const w = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || window.innerWidth;
      const h = canvas.clientHeight || (canvas.parentElement && canvas.parentElement.clientHeight) || window.innerHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = camera.aspect < 1 ? 7.4 : 6.2;
      camera.updateProjectionMatrix();
    };
    resize();

    let ro = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(resize);
      ro.observe(canvas.parentElement || canvas);
    }
    window.addEventListener('resize', resize);

    // إيقاف الرسم لو العنصر مش ظاهر
    let visible = true;
    if ('IntersectionObserver' in window && opts.pauseOffscreen !== false) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(canvas);
    }

    // بارالاكس ناعم مع الماوس
    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMove = e => {
      tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
      ty = (e.clientY / window.innerHeight - 0.5) * 0.32;
    };
    if (!reduce && opts.parallax !== false) window.addEventListener('pointermove', onMove, { passive: true });

    const clock = new THREE.Clock();
    let raf = 0, running = true;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!running || !visible) return;
      uniforms.uTime.value = clock.getElapsedTime();
      if (!reduce) {
        mx += (tx - mx) * 0.045;
        my += (ty - my) * 0.045;
        mesh.rotation.y = mx;
        mesh.rotation.x = -my;
      }
      renderer.render(scene, camera);
    };
    loop();

    return {
      destroy() {
        running = false;
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onMove);
        geo.dispose(); mat.dispose(); renderer.dispose();
      },
      uniforms
    };
  }

  window.JLSilk = { initSilk };
})();
