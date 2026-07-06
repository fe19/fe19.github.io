import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Slingshot — orbital gravity golf.
// Drag from the resting ball to aim; the shot is bent by every planet's
// inverse-square gravity. Land in the goal ring in as few launches as possible.
// ---------------------------------------------------------------------------

const ACCENT = 0x0dcaf0;
const BALL_R = 1.3;
const DT = 1 / 120;            // fixed physics timestep (s)
const POWER = 0.85;            // drag distance (world units) -> launch speed
const MAX_SPEED = 60;
const MIN_LAUNCH_SPEED = 3;    // releases below this cancel the shot
const PREVIEW_STEPS = 540;
const PREVIEW_STRIDE = 3;      // record every Nth step of the preview
const TRAIL_MAX = 320;
const MAX_FLIGHT_TIME = 20;    // seconds before an orbiting ball is parked in place
const GOAL_RING_R = 6;
const GOAL_CAPTURE_R = 4.6;    // must cross the ring plane within this radius

const PLANET_COLORS = [0xff6b4a, 0x9b6bff, 0x4ade80, 0xffd166, 0x60a5fa, 0xf472b6];

// Levels live in the XZ plane (y = 0). mu is the gravitational parameter G*m.
const LEVELS = [
    {
        name: 'Maiden Flight', par: 1, bounds: 170,
        start: [-60, 0], goal: [60, 0], goalNormal: [1, 0],
        planets: [{ p: [0, 26], r: 7, mu: 9000 }],
    },
    {
        name: 'Slingshot 101', par: 2, bounds: 170,
        start: [-65, 0], goal: [65, 8], goalNormal: [1, 0],
        planets: [{ p: [0, 0], r: 9, mu: 14000 }],
    },
    {
        name: 'Binary Dance', par: 2, bounds: 180,
        start: [-65, 25], goal: [60, -30], goalNormal: [1, -0.3],
        planets: [
            { p: [-18, -18], r: 7, mu: 10000 },
            { p: [22, 16], r: 8, mu: 12000 },
        ],
    },
    {
        name: 'The Gauntlet', par: 3, bounds: 180,
        start: [-65, -5], goal: [65, 0], goalNormal: [1, 0],
        planets: [
            { p: [-15, -26], r: 6, mu: 8000 },
            { p: [2, 2], r: 7, mu: 9000 },
            { p: [20, 30], r: 6, mu: 8000 },
        ],
    },
    {
        name: 'Heavyweight', par: 3, bounds: 190,
        start: [-70, 0], goal: [70, 6], goalNormal: [1, 0],
        planets: [{ p: [8, 0], r: 14, mu: 30000 }],
    },
    {
        name: 'Grand Tour', par: 4, bounds: 200,
        start: [-68, -15], goal: [62, -8], goalNormal: [1, 0],
        planets: [
            { p: [-30, 20], r: 6, mu: 9000 },
            { p: [5, -27], r: 8, mu: 13000 },
            { p: [36, 20], r: 7, mu: 11000 },
            { p: [0, 42], r: 4, mu: 4000 },
        ],
    },
];

const $ = (id) => document.getElementById(id);
const wrap = $('game-wrap');

// --- renderer / scene / camera ---------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060f);
scene.fog = new THREE.FogExp2(0x04060f, 0.0009);

const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 3000);
camera.position.set(0, 115, 95);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 30;
controls.maxDistance = 420;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.AmbientLight(0x556677, 1.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(60, 120, 40);
scene.add(keyLight);

// star field
{
    const n = 2000;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(700 + Math.random() * 500);
        pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({
        color: 0xbfd4e6, size: 1.7, sizeAttenuation: false, fog: false,
    }));
    scene.add(stars);
}

// --- level objects ----------------------------------------------------------

const levelGroup = new THREE.Group();
scene.add(levelGroup);

const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x99eeff, emissiveIntensity: 0.6 })
);
scene.add(ballMesh);

const trailGeo = new THREE.BufferGeometry();
const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
}));
trailLine.frustumCulled = false;
scene.add(trailLine);

const previewGeo = new THREE.BufferGeometry();
const previewLine = new THREE.Line(previewGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.95,
}));
previewLine.frustumCulled = false;
previewLine.visible = false;
scene.add(previewLine);

const bandGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const bandLine = new THREE.Line(bandGeo, new THREE.LineBasicMaterial({ color: 0xff5566 }));
bandLine.frustumCulled = false;
bandLine.visible = false;
scene.add(bandLine);

let goalMesh = null;
let goalDisc = null;
let padMesh = null;

// --- game state --------------------------------------------------------------

const state = {
    levelIndex: 0,
    phase: 'resting',          // resting | aiming | flying | won | finished
    strokes: 0,
    total: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    prev: new THREE.Vector3(),
    lastRest: new THREE.Vector3(),
    trail: [],
    flightTime: 0,
};

let level = null;              // built level: { planets: [{pos, r, mu, mesh}], goalPos, goalNormal, bounds, ... }

function disposeGroup(group) {
    group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    group.clear();
}

function buildLevel(i) {
    disposeGroup(levelGroup);
    const def = LEVELS[i];

    level = {
        def,
        bounds: def.bounds,
        startPos: new THREE.Vector3(def.start[0], 0, def.start[1]),
        goalPos: new THREE.Vector3(def.goal[0], 0, def.goal[1]),
        goalNormal: new THREE.Vector3(def.goalNormal[0], 0, def.goalNormal[1]).normalize(),
        planets: [],
    };

    def.planets.forEach((pl, k) => {
        const color = PLANET_COLORS[k % PLANET_COLORS.length];
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(pl.r, 40, 24),
            new THREE.MeshStandardMaterial({
                color, roughness: 0.55, metalness: 0.1,
                emissive: color, emissiveIntensity: 0.35,
            })
        );
        mesh.position.set(pl.p[0], 0, pl.p[1]);
        levelGroup.add(mesh);

        // soft additive glow shell
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(pl.r * 1.25, 32, 20),
            new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: 0.14,
                blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
            })
        );
        mesh.add(glow);

        const light = new THREE.PointLight(color, 0.8, pl.r * 12);
        mesh.add(light);

        level.planets.push({ pos: mesh.position, r: pl.r, mu: pl.mu, mesh });
    });

    // faint polar grid on the play plane for depth/aim reference
    const grid = new THREE.PolarGridHelper(def.bounds * 0.75, 12, 8, 48, 0x1c3a5e, 0x122740);
    grid.position.y = -BALL_R - 0.6;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    levelGroup.add(grid);

    // launch pad
    padMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.2, 0.5, 32),
        new THREE.MeshStandardMaterial({ color: 0x355c7d, emissive: 0x4a7fae, emissiveIntensity: 0.9 })
    );
    padMesh.position.copy(level.startPos).y = -BALL_R - 0.3;
    levelGroup.add(padMesh);

    // goal: rotating torus "wormhole" + faint capture disc
    goalMesh = new THREE.Mesh(
        new THREE.TorusGeometry(GOAL_RING_R, 0.55, 16, 64),
        new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.2 })
    );
    goalMesh.position.copy(level.goalPos);
    goalMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), level.goalNormal);
    levelGroup.add(goalMesh);

    goalDisc = new THREE.Mesh(
        new THREE.CircleGeometry(GOAL_CAPTURE_R, 48),
        new THREE.MeshBasicMaterial({
            color: ACCENT, transparent: true, opacity: 0.18,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        })
    );
    goalDisc.position.copy(level.goalPos);
    goalDisc.quaternion.copy(goalMesh.quaternion);
    levelGroup.add(goalDisc);

    const goalLight = new THREE.PointLight(ACCENT, 1.2, 70);
    goalLight.position.copy(level.goalPos);
    levelGroup.add(goalLight);

    // reset ball
    state.pos.copy(level.startPos);
    state.vel.set(0, 0, 0);
    state.lastRest.copy(level.startPos);
    state.trail.length = 0;
    state.phase = 'resting';
    state.strokes = 0;
    ballMesh.position.copy(state.pos);
    trailLine.visible = false;
    previewLine.visible = false;
    bandLine.visible = false;

    updateHud();
}

// --- physics -----------------------------------------------------------------

const _acc = new THREE.Vector3();
const _tmp = new THREE.Vector3();

function accelAt(p, out) {
    out.set(0, 0, 0);
    for (const pl of level.planets) {
        _tmp.subVectors(pl.pos, p);
        const d2 = Math.max(_tmp.lengthSq(), 4);
        out.addScaledVector(_tmp.normalize(), pl.mu / d2);
    }
    return out;
}

// Advances sim {pos, vel, prev} by one DT. Returns null or an event
// { type: 'planet'|'goal'|'oob', planet? }. Shared by flight and aim preview.
function stepSim(sim) {
    accelAt(sim.pos, _acc);
    sim.vel.addScaledVector(_acc, DT);
    sim.prev.copy(sim.pos);
    sim.pos.addScaledVector(sim.vel, DT);

    for (const pl of level.planets) {
        if (sim.pos.distanceTo(pl.pos) <= pl.r + BALL_R) return { type: 'planet', planet: pl };
    }
    if (goalCrossed(sim.prev, sim.pos)) return { type: 'goal' };
    if (sim.pos.length() > level.bounds) return { type: 'oob' };
    return null;
}

const _hit = new THREE.Vector3();

function goalCrossed(a, b) {
    const n = level.goalNormal, c = level.goalPos;
    const da = _tmp.subVectors(a, c).dot(n);
    const db = _hit.subVectors(b, c).dot(n);
    if (da * db > 0) return b.distanceTo(c) < 2.5; // slow tangential graze
    const t = Math.abs(da - db) < 1e-9 ? 0 : da / (da - db);
    _hit.lerpVectors(a, b, t);
    return _hit.distanceTo(c) <= GOAL_CAPTURE_R;
}

function landOnPlanet(planet) {
    _tmp.subVectors(state.prev, planet.pos).normalize();
    state.pos.copy(planet.pos).addScaledVector(_tmp, planet.r + BALL_R + 0.05);
    state.vel.set(0, 0, 0);
    state.lastRest.copy(state.pos);
    state.phase = 'resting';
    showToast('Touched down — launch again from here.');
}

function onGoal() {
    state.phase = 'won';
    state.total += state.strokes;
    updateHud();
    const def = level.def;
    const diff = state.strokes - def.par;
    const grade = diff <= -1 ? 'Under par — stellar!' : diff === 0 ? 'Right on par.' : `${diff} over par.`;
    const last = state.levelIndex === LEVELS.length - 1;
    $('overlay-title').textContent = last ? 'Course complete!' : 'Goal!';
    $('overlay-text').textContent = last
        ? `Final score: ${state.total} strokes vs par ${LEVELS.reduce((s, l) => s + l.par, 0)}.`
        : `${state.strokes} stroke${state.strokes === 1 ? '' : 's'} on “${def.name}”. ${grade}`;
    $('next-btn').textContent = last ? 'Play again' : 'Next level';
    $('overlay').classList.remove('d-none');
}

function doFlightStep() {
    const ev = stepSim(state);
    state.trail.push(state.pos.clone());
    if (state.trail.length > TRAIL_MAX) state.trail.shift();

    state.flightTime += DT;
    if (!ev && state.flightTime >= MAX_FLIGHT_TIME) {
        // stuck in a stable orbit: park the ball where it is, next shot starts here
        state.vel.set(0, 0, 0);
        state.lastRest.copy(state.pos);
        state.phase = 'resting';
        showToast('Stable orbit — ball parked. Launch again from here.');
        updateHud();
        return;
    }
    if (!ev) return;
    if (ev.type === 'planet') landOnPlanet(ev.planet);
    else if (ev.type === 'goal') onGoal();
    else { // out of bounds
        state.pos.copy(state.lastRest);
        state.vel.set(0, 0, 0);
        state.phase = 'resting';
        showToast('Lost in deep space — back to your last position.');
    }
    if (state.phase !== 'flying') updateHud();
}

// --- input: drag-to-aim ------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();
const launchVel = new THREE.Vector3();

function setPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'resting') return;
    setPointer(e);
    const grabRadius = Math.max(5, camera.position.distanceTo(state.pos) * 0.04);
    if (raycaster.ray.distanceToPoint(state.pos) > grabRadius) return;
    state.phase = 'aiming';
    controls.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
    updateAim(e);
});

renderer.domElement.addEventListener('pointermove', (e) => {
    if (state.phase === 'aiming') updateAim(e);
});

renderer.domElement.addEventListener('pointerup', (e) => {
    if (state.phase !== 'aiming') return;
    controls.enabled = true;
    previewLine.visible = false;
    bandLine.visible = false;
    if (launchVel.length() >= MIN_LAUNCH_SPEED) {
        state.vel.copy(launchVel);
        state.prev.copy(state.pos);
        state.trail.length = 0;
        state.flightTime = 0;
        state.strokes += 1;
        state.phase = 'flying';
        trailLine.visible = true;
        $('hint').style.display = 'none';
        updateHud();
    } else {
        state.phase = 'resting';
    }
});

renderer.domElement.addEventListener('pointercancel', () => {
    if (state.phase !== 'aiming') return;
    controls.enabled = true;
    previewLine.visible = false;
    bandLine.visible = false;
    state.phase = 'resting';
});

function updateAim(e) {
    setPointer(e);
    if (!raycaster.ray.intersectPlane(aimPlane, aimPoint)) return;
    launchVel.subVectors(state.pos, aimPoint);
    launchVel.y = 0;
    launchVel.multiplyScalar(POWER);
    if (launchVel.length() > MAX_SPEED) launchVel.setLength(MAX_SPEED);

    // rubber band from ball to drag point
    bandGeo.setFromPoints([state.pos, aimPoint]);
    bandLine.visible = true;

    updatePreview();
}

const previewSim = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), prev: new THREE.Vector3() };

function updatePreview() {
    previewSim.pos.copy(state.pos);
    previewSim.vel.copy(launchVel);
    previewSim.prev.copy(state.pos);

    const pts = [state.pos.clone()];
    for (let i = 0; i < PREVIEW_STEPS; i++) {
        const ev = stepSim(previewSim);
        if (i % PREVIEW_STRIDE === 0 || ev) pts.push(previewSim.pos.clone());
        if (ev) break;
    }
    setFadingLine(previewGeo, pts, new THREE.Color(ACCENT));
    previewLine.visible = true;
}

// Builds a line geometry whose color fades toward the background with distance.
const _bg = new THREE.Color(0x04060f);
function setFadingLine(geo, pts, color, reverse = false) {
    const n = pts.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
        positions.set([pts[i].x, pts[i].y, pts[i].z], i * 3);
        const t = n < 2 ? 0 : i / (n - 1);
        c.copy(color).lerp(_bg, reverse ? 1 - t : t * 0.9);
        colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
}

// --- HUD ----------------------------------------------------------------------

function updateHud() {
    $('level-num').textContent = state.levelIndex + 1;
    $('level-count').textContent = LEVELS.length;
    $('level-name').textContent = LEVELS[state.levelIndex].name;
    $('strokes').textContent = state.strokes;
    $('par').textContent = LEVELS[state.levelIndex].par;
    $('total').textContent = state.total;
}

let toastTimer = 0;
function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

$('reset-btn').addEventListener('click', () => {
    state.pos.copy(level.startPos);
    state.vel.set(0, 0, 0);
    state.lastRest.copy(level.startPos);
    state.trail.length = 0;
    state.strokes = 0;
    state.phase = 'resting';
    trailLine.visible = false;
    updateHud();
});

$('next-btn').addEventListener('click', () => {
    $('overlay').classList.add('d-none');
    if (state.levelIndex === LEVELS.length - 1) {
        state.levelIndex = 0;
        state.total = 0;
    } else {
        state.levelIndex += 1;
    }
    buildLevel(state.levelIndex);
});

// --- layout / resize -----------------------------------------------------------

function layout() {
    const header = document.getElementById('site-header');
    const h = header ? header.offsetHeight : 0;
    wrap.style.height = Math.max(420, window.innerHeight - h) + 'px';
    const w = wrap.clientWidth, hh = wrap.clientHeight;
    renderer.setSize(w, hh);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout);
layout();
setTimeout(layout, 300); // again after the shared header is injected

// --- main loop ------------------------------------------------------------------

let last = performance.now();
let accumulator = 0;

function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (state.phase === 'flying') {
        accumulator += dt;
        while (accumulator >= DT && state.phase === 'flying') {
            doFlightStep();
            accumulator -= DT;
        }
    } else {
        accumulator = 0;
    }

    ballMesh.position.copy(state.pos);

    if (state.trail.length > 1 && state.phase === 'flying') {
        setFadingLine(trailGeo, state.trail, new THREE.Color(0xffffff), true);
        trailLine.visible = true;
    }

    for (const pl of level.planets) pl.mesh.rotation.y += 0.15 * dt;
    if (goalMesh) {
        goalMesh.rotation.z += 0.8 * dt;
        const s = 1 + Math.sin(now * 0.003) * 0.04;
        goalMesh.scale.set(s, s, s);
    }

    controls.update();
    renderer.render(scene, camera);
}

buildLevel(0);
requestAnimationFrame(animate);

// Exposed for scripted smoke tests (see repo verification): lets a test launch
// the ball deterministically without synthesizing pointer events.
window.__slingshot = {
    state, LEVELS,
    loadLevel(i) {
        state.levelIndex = i;
        buildLevel(i);
    },
    // headless flight simulation from the current rest position; returns the
    // terminal event type ('goal' | 'planet' | 'oob' | 'timeout')
    simulate(vx, vz, maxSteps = MAX_FLIGHT_TIME / DT) {
        const sim = {
            pos: state.pos.clone(),
            vel: new THREE.Vector3(vx, 0, vz),
            prev: state.pos.clone(),
        };
        for (let i = 0; i < maxSteps; i++) {
            const ev = stepSim(sim);
            if (ev) return ev.type;
        }
        return 'timeout';
    },
    launch(vx, vz) {
        if (state.phase !== 'resting') return false;
        state.vel.set(vx, 0, vz);
        state.prev.copy(state.pos);
        state.trail.length = 0;
        state.flightTime = 0;
        state.strokes += 1;
        state.phase = 'flying';
        trailLine.visible = true;
        updateHud();
        return true;
    },
};
