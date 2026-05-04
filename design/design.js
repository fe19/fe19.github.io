import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);

const params = {
  shape: 'rectangle', width: 12, depth: 9,
  notchWidth: 5, notchDepth: 4,
  floors: 3, floorHeight: 3,
  roof: 'flat', roofPitch: 3,
  windowCount: 10, windowWidth: 1.2, windowHeight: 1.4, doorPos: 0,
  style: 'clean', wallColor: '#e8dfcc', roofColor: '#5d4a3a', glassColor: '#36506e',
};

function readInputs() {
  for (const k of Object.keys(params)) {
    const el = $(k); if (!el) continue;
    params[k] = (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) : el.value;
  }
}
function writeInputs() {
  for (const k of Object.keys(params)) {
    const el = $(k); if (!el) continue;
    el.value = params[k];
  }
}

function getFootprint(p) {
  const w = p.width / 2, d = p.depth / 2;
  if (p.shape === 'rectangle') {
    return [[-w,-d],[w,-d],[w,d],[-w,d]];
  }
  if (p.shape === 'L') {
    const nw = Math.max(0.5, Math.min(p.notchWidth, p.width - 1));
    const nd = Math.max(0.5, Math.min(p.notchDepth, p.depth - 1));
    return [[-w,-d],[w,-d],[w,d-nd],[w-nw,d-nd],[w-nw,d],[-w,d]];
  }
  if (p.shape === 'U') {
    const nw = Math.max(0.5, Math.min(p.notchWidth, p.width - 2));
    const nd = Math.max(0.5, Math.min(p.notchDepth, p.depth - 1));
    return [[-w,-d],[w,-d],[w,d],[nw/2,d],[nw/2,d-nd],[-nw/2,d-nd],[-nw/2,d],[-w,d]];
  }
  if (p.shape === 'T') {
    const sw = Math.max(0.5, Math.min(p.notchWidth, p.width - 1));
    const bd = Math.max(0.5, Math.min(p.notchDepth, p.depth - 1));
    return [
      [-sw/2,-d],[sw/2,-d],[sw/2,d-bd],[w,d-bd],[w,d],[-w,d],[-w,d-bd],[-sw/2,d-bd]
    ];
  }
  return [[-w,-d],[w,-d],[w,d],[-w,d]];
}

function triangulate(fp) {
  const pts = fp.map(([x,z]) => new THREE.Vector2(x, z));
  return THREE.ShapeUtils.triangulateShape(pts, []);
}

function buildWalls(fp, height) {
  const verts = [];
  const indices = [];
  for (let i = 0; i < fp.length; i++) {
    const [x1, z1] = fp[i];
    const [x2, z2] = fp[(i+1) % fp.length];
    const base = verts.length / 3;
    verts.push(x1, 0, z1, x2, 0, z2, x2, height, z2, x1, height, z1);
    indices.push(base, base+3, base+2, base, base+2, base+1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildRoofFlat(fp, height) {
  const tris = triangulate(fp);
  const verts = [];
  fp.forEach(([x,z]) => verts.push(x, height, z));
  const indices = [];
  tris.forEach(t => indices.push(t[0], t[1], t[2]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildRoofGable(p) {
  const w = p.width / 2, d = p.depth / 2;
  const h = p.floors * p.floorHeight;
  const ry = h + p.roofPitch;
  const verts = [
    -w, h, -d,
     w, h, -d,
     w, h,  d,
    -w, h,  d,
    -w, ry, 0,
     w, ry, 0,
  ];
  const indices = [
    0, 4, 5,  0, 5, 1,
    3, 2, 5,  3, 5, 4,
    0, 3, 4,
    1, 5, 2,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildRoofHip(p, fp) {
  const h = p.floors * p.floorHeight;
  let cx = 0, cz = 0;
  fp.forEach(([x,z]) => { cx += x; cz += z; });
  cx /= fp.length; cz /= fp.length;
  const verts = [];
  fp.forEach(([x,z]) => verts.push(x, h, z));
  verts.push(cx, h + p.roofPitch, cz);
  const apex = fp.length;
  const indices = [];
  for (let i = 0; i < fp.length; i++) {
    const j = (i + 1) % fp.length;
    indices.push(i, apex, j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildFloor(fp) {
  const tris = triangulate(fp);
  const verts = [];
  fp.forEach(([x,z]) => verts.push(x, 0, z));
  const indices = [];
  tris.forEach(t => indices.push(t[0], t[2], t[1]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function makeMaterials(p) {
  const wallC = new THREE.Color(p.wallColor);
  const roofC = new THREE.Color(p.roofColor);
  const isClean = p.style === 'clean';
  const wall = isClean
    ? new THREE.MeshLambertMaterial({ color: wallC })
    : new THREE.MeshStandardMaterial({ color: wallC, roughness: 0.85, metalness: 0 });
  const roof = isClean
    ? new THREE.MeshLambertMaterial({ color: roofC })
    : new THREE.MeshStandardMaterial({ color: roofC, roughness: 0.7, metalness: 0 });
  const glassC = new THREE.Color(p.glassColor);
  const win = isClean
    ? new THREE.MeshBasicMaterial({ color: glassC })
    : new THREE.MeshStandardMaterial({ color: glassC, roughness: 0.12, metalness: 0.5 });
  return { wall, roof, win, door: win };
}

function buildBuilding(p, group) {
  const fp = getFootprint(p);
  const totalH = p.floors * p.floorHeight;
  const mats = makeMaterials(p);
  const isClean = p.style === 'clean';

  const wallGeom = buildWalls(fp, totalH);
  const wallMesh = new THREE.Mesh(wallGeom, mats.wall);
  wallMesh.castShadow = true; wallMesh.receiveShadow = true;
  group.add(wallMesh);

  const floorGeom = buildFloor(fp);
  const floorMesh = new THREE.Mesh(floorGeom, mats.wall);
  group.add(floorMesh);

  let roofGeom;
  if (p.roof === 'gable' && p.shape === 'rectangle') roofGeom = buildRoofGable(p);
  else if (p.roof === 'hip') roofGeom = buildRoofHip(p, fp);
  else roofGeom = buildRoofFlat(fp, totalH);

  const roofMesh = new THREE.Mesh(roofGeom, mats.roof);
  roofMesh.castShadow = true; roofMesh.receiveShadow = true;
  group.add(roofMesh);

  if (isClean) {
    const lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(wallGeom, 1), lineMat));
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(roofGeom, 1), lineMat));
  }

  const edges = [];
  for (let i = 0; i < fp.length; i++) {
    const [x1, z1] = fp[i];
    const [x2, z2] = fp[(i+1) % fp.length];
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    edges.push({ x1, z1, x2, z2, dx: dx/len, dz: dz/len, nx: dz/len, nz: -dx/len, len });
  }

  const front = edges[0];
  const dw = 0.95, dh = 2.1;
  const ddist = front.len/2 + p.doorPos * front.len;
  const dcx = front.x1 + front.dx*ddist + front.nx*0.025;
  const dcz = front.z1 + front.dz*ddist + front.nz*0.025;
  const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), mats.door);
  doorMesh.position.set(dcx, dh/2, dcz);
  doorMesh.rotation.y = Math.atan2(front.nx, front.nz);
  group.add(doorMesh);

  const N = p.windowCount;
  if (N > 0) {
    const perim = edges.reduce((s, e) => s + e.len, 0);
    const spacing = perim / N;
    const margin = p.windowWidth/2 + 0.35;
    for (let f = 0; f < p.floors; f++) {
      const wy = f * p.floorHeight + p.floorHeight / 2;
      for (let i = 0; i < N; i++) {
        let dist = (i + 0.5) * spacing;
        let ei = 0;
        while (ei < edges.length - 1 && dist > edges[ei].len) {
          dist -= edges[ei].len;
          ei++;
        }
        const e = edges[ei];
        if (dist < margin || dist > e.len - margin) continue;
        if (f === 0 && ei === 0) {
          const dCenter = front.len/2 + p.doorPos * front.len;
          if (Math.abs(dist - dCenter) < (p.windowWidth + dw)/2 + 0.25) continue;
        }
        const wx = e.x1 + e.dx*dist + e.nx*0.025;
        const wz = e.z1 + e.dz*dist + e.nz*0.025;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(p.windowWidth, p.windowHeight), mats.win);
        m.position.set(wx, wy, wz);
        m.rotation.y = Math.atan2(e.nx, e.nz);
        group.add(m);
      }
    }
  }

  if (isClean && p.floors > 1) {
    const lineMat2 = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.35 });
    for (let f = 1; f < p.floors; f++) {
      const y = f * p.floorHeight;
      const pts = [];
      for (let i = 0; i < fp.length; i++) {
        const [x1, z1] = fp[i];
        const [x2, z2] = fp[(i+1) % fp.length];
        pts.push(new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y, z2));
      }
      const lg = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.LineSegments(lg, lineMat2));
    }
  }
}

const scene = new THREE.Scene();
let buildingGroup = new THREE.Group();
scene.add(buildingGroup);
let groundMesh = null, sunLight = null, hemiLight = null, ambLight = null, dirLight = null;

function setupLighting(p) {
  [sunLight, hemiLight, ambLight, dirLight].forEach(l => l && scene.remove(l));
  sunLight = hemiLight = ambLight = dirLight = null;
  if (groundMesh) {
    scene.remove(groundMesh);
    groundMesh.geometry.dispose(); groundMesh.material.dispose();
    groundMesh = null;
  }

  if (p.style === 'clean') {
    scene.background = new THREE.Color(0xf7f7f7);
    ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambLight);
    dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
    dirLight.position.set(15, 25, 18);
    scene.add(dirLight);
  } else {
    scene.background = new THREE.Color(0xc8dcef);
    hemiLight = new THREE.HemisphereLight(0xc8dcef, 0x6a5e4a, 0.55);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff2dd, 1.7);
    sunLight.position.set(22, 38, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const ss = 40;
    sunLight.shadow.camera.left = -ss; sunLight.shadow.camera.right = ss;
    sunLight.shadow.camera.top = ss; sunLight.shadow.camera.bottom = -ss;
    sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 140;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const g = new THREE.PlaneGeometry(300, 300);
    g.rotateX(-Math.PI/2);
    groundMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x7b8a5a, roughness: 1 }));
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
  }
}

const views = ['top', '3d', 'front', 'side'];
const renderers = {};
const cameras = {};
views.forEach(name => {
  const canvas = $('cv-' + name);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  renderers[name] = r;
});
cameras.top = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 500);
cameras.front = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 500);
cameras.side = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 500);
cameras['3d'] = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
cameras['3d'].position.set(28, 20, 32);

const orbit = new OrbitControls(cameras['3d'], renderers['3d'].domElement);
orbit.target.set(0, 4, 0);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.update();

let bounds = new THREE.Box3();
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
}
function rebuild() {
  scene.remove(buildingGroup);
  disposeGroup(buildingGroup);
  buildingGroup = new THREE.Group();
  buildBuilding(params, buildingGroup);
  scene.add(buildingGroup);
  setupLighting(params);
  bounds.setFromObject(buildingGroup);
  bounds.min.y = Math.min(bounds.min.y, 0);
}

function fitOrthoCamera(cam, view, b, aspect) {
  const center = new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(b.max, b.min);
  const margin = 1.25;
  let cw, ch;
  if (view === 'top') { cw = size.x; ch = size.z; }
  else if (view === 'front') { cw = size.x; ch = size.y; }
  else { cw = size.z; ch = size.y; }
  cw *= margin; ch *= margin;
  if (cw / ch > aspect) ch = cw / aspect;
  else cw = ch * aspect;
  cam.left = -cw/2; cam.right = cw/2;
  cam.top = ch/2; cam.bottom = -ch/2;
  cam.near = 0.1; cam.far = 400;
  if (view === 'top') {
    cam.position.set(center.x, b.max.y + 80, center.z);
    cam.up.set(0, 0, 1);
    cam.lookAt(center.x, 0, center.z);
  } else if (view === 'front') {
    cam.position.set(center.x, center.y, b.min.z - 80);
    cam.up.set(0, 1, 0);
    cam.lookAt(center.x, center.y, 0);
  } else {
    cam.position.set(b.max.x + 80, center.y, center.z);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, center.y, center.z);
  }
  cam.updateProjectionMatrix();
}

function resizeAll() {
  views.forEach(name => {
    const r = renderers[name];
    const c = r.domElement;
    const w = c.clientWidth | 0, h = c.clientHeight | 0;
    if (w === 0 || h === 0) return;
    const pr = r.getPixelRatio();
    if (c.width !== Math.floor(w * pr) || c.height !== Math.floor(h * pr)) {
      r.setSize(w, h, false);
      if (name === '3d') {
        cameras['3d'].aspect = w / h;
        cameras['3d'].updateProjectionMatrix();
      }
    }
  });
}

function render() {
  resizeAll();
  ['top', 'front', 'side'].forEach(view => {
    const c = renderers[view].domElement;
    const aspect = c.clientWidth / Math.max(1, c.clientHeight);
    if (isFinite(aspect) && aspect > 0) fitOrthoCamera(cameras[view], view, bounds, aspect);
  });
  views.forEach(name => renderers[name].render(scene, cameras[name]));
}

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  render();
}

function updateNotchVisibility() {
  const row = $('notch-row');
  if (params.shape === 'rectangle') {
    row.style.display = 'none';
  } else {
    row.style.display = 'flex';
    const labels = row.querySelectorAll('.lbl');
    if (params.shape === 'T') {
      labels[0].textContent = 'Stem W';
      labels[1].textContent = 'Bar D';
    } else {
      labels[0].textContent = 'Notch W';
      labels[1].textContent = 'Notch D';
    }
  }
}

function bindInputs() {
  Object.keys(params).forEach(k => {
    const el = $(k); if (!el) return;
    el.addEventListener('input', () => {
      readInputs();
      updateNotchVisibility();
      rebuild();
    });
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('exportImg').onclick = () => {
  render();
  renderers['3d'].domElement.toBlob(blob => {
    if (blob) downloadBlob(blob, 'building.png');
  });
};
$('exportJson').onclick = () => {
  const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'building.json');
};
$('importJson').onclick = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        for (const k of Object.keys(params)) if (k in data) params[k] = data[k];
        writeInputs();
        updateNotchVisibility();
        rebuild();
      } catch (e) { alert('Invalid JSON: ' + e.message); }
    };
    reader.readAsText(f);
  };
  inp.click();
};

readInputs();
bindInputs();
updateNotchVisibility();
rebuild();
animate();

window.addEventListener('resize', resizeAll);

const menuToggle = document.getElementById('menu-toggle');
const backdrop = document.getElementById('menu-backdrop');
function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  backdrop.hidden = !open;
}
menuToggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
backdrop.addEventListener('click', () => setMenu(false));
