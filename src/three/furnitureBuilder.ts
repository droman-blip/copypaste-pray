import * as THREE from 'three';
import type { InteractableId, RoleId, RoomId } from '../types/mission';
import {
  buildFloatingLimbAstronaut,
  type FloatingLimbAstronautRig,
} from './characterBuilder';
import type { ScreenTheme, SpaceMaterialLibrary } from './materials';

export function makeRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw * 0.45, hh * 0.45);

  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

export function makeCurvedArcDeskShape(
  innerR: number,
  outerR: number,
  arcAngle: number,
): THREE.Shape {
  const s = new THREE.Shape();
  const half = arcAngle / 2;
  const segs = 18;

  for (let i = 0; i <= segs; i++) {
    const a = -half + (i / segs) * arcAngle;
    const x = Math.sin(a) * outerR;
    const y = Math.cos(a) * outerR - innerR;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = -half + (i / segs) * arcAngle;
    const x = Math.sin(a) * innerR;
    const y = Math.cos(a) * innerR - innerR;
    s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export function makeAccentMat(hex: string | number, intensity = 0.55): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: intensity,
    roughness: 0.28,
    metalness: 0.45,
  });
}

export function buildErgonomicChair(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const chair = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.25);

  // 5-star wheel base
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 10), mats.brushedSteel);
  hub.position.y = 0.12;
  chair.add(hub);

  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(Math.cos(a) * 0.22, 0.09, Math.sin(a) * 0.22),
      new THREE.Vector3(Math.cos(a) * 0.34, 0.05, Math.sin(a) * 0.34),
    ]);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(legCurve, 6, 0.025, 6, false), mats.brushedSteel);
    chair.add(leg);

    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.032, 10),
      mats.hullDark,
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.rotation.y = a;
    wheel.position.set(Math.cos(a) * 0.34, 0.038, Math.sin(a) * 0.34);
    chair.add(wheel);
  }

  // Pneumatic column
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.36, 10), mats.hullDark);
  piston.position.y = 0.3;
  chair.add(piston);

  // Sculpted seat cushion
  const seatShape = makeRoundedRectShape(0.56, 0.54, 0.14);
  const seatGeo = new THREE.ExtrudeGeometry(seatShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  seatGeo.rotateX(Math.PI / 2);
  seatGeo.center();
  const seat = new THREE.Mesh(seatGeo, mats.fabricCharcoal);
  seat.position.y = 0.52;
  seat.castShadow = true;
  chair.add(seat);

  // Curved ergonomic backrest
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.48, 0.05),
    new THREE.Vector3(0, 0.54, 0.28),
    new THREE.Vector3(0, 0.85, 0.31),
  ]);
  const spine = new THREE.Mesh(new THREE.TubeGeometry(spineCurve, 8, 0.03, 8, false), mats.brushedSteel);
  chair.add(spine);

  const backShape = makeRoundedRectShape(0.48, 0.62, 0.16);
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  backGeo.center();
  const back = new THREE.Mesh(backGeo, mats.fabricCharcoal);
  back.position.set(0, 0.94, 0.26);
  back.rotation.x = -0.14;
  back.castShadow = true;
  chair.add(back);

  // Accent headrest strip
  const headrest = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.24, 4, 8), accentMat);
  headrest.rotation.z = Math.PI / 2;
  headrest.position.set(0, 1.24, 0.23);
  chair.add(headrest);

  // Curved armrests
  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.26, 0.52, 0.05),
      new THREE.Vector3(side * 0.31, 0.72, 0.06),
      new THREE.Vector3(side * 0.31, 0.73, -0.14),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 8, 0.028, 8, false), mats.hullDark);
    chair.add(arm);
  }

  return chair;
}

export function buildCoffeeMug(mats: SpaceMaterialLibrary): THREE.Group {
  const mug = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.055, 0.0),
    new THREE.Vector2(0.06, 0.11),
    new THREE.Vector2(0.052, 0.115),
    new THREE.Vector2(0.045, 0.02),
    new THREE.Vector2(0.0, 0.02),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), mats.hullWhite);
  mug.add(body);

  const coffee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 0.01, 10),
    mats.trunkBrown,
  );
  coffee.position.y = 0.095;
  mug.add(coffee);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.009, 6, 10, Math.PI), mats.hullWhite);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.055, 0.06, 0);
  mug.add(handle);

  return mug;
}

export function buildKeyboardAndMouse(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();

  const kbShape = makeRoundedRectShape(0.56, 0.2, 0.04);
  const kbGeo = new THREE.ExtrudeGeometry(kbShape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  kbGeo.rotateX(Math.PI / 2);
  kbGeo.center();
  const kb = new THREE.Mesh(kbGeo, mats.hullDark);
  kb.rotation.x = 0.08;
  group.add(kb);

  const keyGlow = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.012, 0.44, 3, 6),
    makeAccentMat(accentHex, 0.7),
  );
  keyGlow.rotation.z = Math.PI / 2;
  keyGlow.position.set(0, 0.016, 0.01);
  group.add(keyGlow);

  const mouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.045, 4, 8), mats.titanium);
  mouse.rotation.x = Math.PI / 2;
  mouse.scale.set(1, 1, 0.55);
  mouse.position.set(0.4, 0.012, 0.02);
  group.add(mouse);

  return group;
}

export function buildBeveledFolder(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const folder = new THREE.Group();
  const shape = makeRoundedRectShape(0.32, 0.42, 0.03);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  const cover = new THREE.Mesh(geo, makeAccentMat(accentHex, 0.15));
  folder.add(cover);

  const paperShape = makeRoundedRectShape(0.28, 0.38, 0.02);
  const paperGeo = new THREE.ExtrudeGeometry(paperShape, { depth: 0.014, bevelEnabled: false });
  paperGeo.rotateX(Math.PI / 2);
  const pages = new THREE.Mesh(paperGeo, mats.hullWhite);
  pages.position.set(0.01, 0.004, 0);
  folder.add(pages);

  return folder;
}

export function buildPanoramicMonitor(
  width: number,
  height: number,
  theme: ScreenTheme,
  accentHex: string,
  title: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const monitor = new THREE.Group();

  // Turned pedestal base
  const basePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.18, 0),
    new THREE.Vector2(0.14, 0.03),
    new THREE.Vector2(0.04, 0.05),
    new THREE.Vector2(0.035, 0.28),
    new THREE.Vector2(0, 0.28),
  ];
  const stand = new THREE.Mesh(new THREE.LatheGeometry(basePts, 12), mats.brushedSteel);
  monitor.add(stand);

  // Beveled monitor housing
  const frameShape = makeRoundedRectShape(width + 0.08, height + 0.08, 0.04);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  frameGeo.center();
  const bezel = new THREE.Mesh(frameGeo, mats.hullDark);
  bezel.position.set(0, 0.28 + height * 0.5, 0);
  bezel.rotation.x = -0.14;
  bezel.castShadow = true;
  monitor.add(bezel);

  const screenMat = mats.createScreenMaterial(theme, accentHex, title);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMat);
  screen.position.set(0, 0.28 + height * 0.5, 0.039);
  screen.rotation.x = -0.14;
  monitor.add(screen);

  return monitor;
}

export function buildCurvedDeskWorkstation(
  accentHex: string,
  screenTheme: ScreenTheme,
  title: string,
  mats: SpaceMaterialLibrary,
  withChair = true,
): THREE.Group {
  const group = new THREE.Group();

  // Curved tabletop: rotateX(+PI/2) then rotateY(PI) so the concave user bay opens toward +Z
  // and the deep outer tabletop arc spans toward -Z under the monitors.
  const deskShape = makeCurvedArcDeskShape(1.3, 2.25, Math.PI * 0.52);
  const deskGeo = new THREE.ExtrudeGeometry(deskShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
  });
  deskGeo.rotateX(Math.PI / 2);
  deskGeo.rotateY(Math.PI);
  const tabletop = new THREE.Mesh(deskGeo, mats.titanium);
  tabletop.position.set(0, 0.82, 0.08);
  tabletop.castShadow = true;
  tabletop.receiveShadow = true;
  group.add(tabletop);

  // Turned pedestal legs aligned cleanly beneath the curved tabletop arc
  const legPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.15, 0),
    new THREE.Vector2(0.07, 0.08),
    new THREE.Vector2(0.06, 0.74),
    new THREE.Vector2(0.12, 0.76),
    new THREE.Vector2(0, 0.76),
  ];
  const legGeo = new THREE.LatheGeometry(legPts, 10);
  for (const angle of [-0.65, 0, 0.65]) {
    const leg = new THREE.Mesh(legGeo, mats.hullDark);
    leg.position.set(Math.sin(angle) * 1.78, 0, 1.38 - Math.cos(angle) * 1.78);
    leg.castShadow = true;
    group.add(leg);
  }

  // Panoramic curved dual monitors seated solidly along the -Z desk perimeter facing +Z
  const leftMon = buildPanoramicMonitor(0.85, 0.48, screenTheme, accentHex, title, mats);
  leftMon.position.set(-0.56, 0.84, -0.52);
  leftMon.rotation.y = 0.28;
  group.add(leftMon);

  const rightMon = buildPanoramicMonitor(0.85, 0.48, screenTheme, accentHex, 'TELEMETRY', mats);
  rightMon.position.set(0.56, 0.84, -0.52);
  rightMon.rotation.y = -0.28;
  group.add(rightMon);

  // Keyboard, mug & folder seated on the desk surface
  const kb = buildKeyboardAndMouse(accentHex, mats);
  kb.position.set(0, 0.85, -0.14);
  group.add(kb);

  const mug = buildCoffeeMug(mats);
  mug.position.set(0.84, 0.84, -0.02);
  group.add(mug);

  const folder = buildBeveledFolder(accentHex, mats);
  folder.position.set(-0.84, 0.84, -0.02);
  folder.rotation.y = 0.24;
  group.add(folder);

  // Rolling ergonomic chair tucked neatly on the user side (+Z), facing -Z toward monitors with zero clipping
  if (withChair) {
    const chair = buildErgonomicChair(accentHex, mats);
    chair.position.set(0, 0, 0.78);
    chair.rotation.y = 0;
    group.add(chair);
  }

  return group;
}

export function buildFloorCable(
  points: [number, number, number][],
  colorHex: string | number,
): THREE.Group {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.045, 6, false),
    new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.48,
      metalness: 0.2,
    }),
  );
  tube.castShadow = true;
  group.add(tube);
  return group;
}

export function buildPottedPlant(mats: SpaceMaterialLibrary): THREE.Group {
  const plant = new THREE.Group();

  const potPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.24, 0),
    new THREE.Vector2(0.32, 0.48),
    new THREE.Vector2(0.34, 0.52),
    new THREE.Vector2(0.28, 0.52),
    new THREE.Vector2(0, 0.46),
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts, 12), mats.hullWhite);
  pot.castShadow = true;
  plant.add(pot);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 10), mats.trunkBrown);
  soil.position.y = 0.47;
  plant.add(soil);

  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7;
    const tilt = 0.38 + (i % 3) * 0.18;
    const leaf = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.075, 0.42, 4, 8),
      mats.foliageGreen,
    );
    leaf.scale.set(1.2, 1.0, 0.35);
    leaf.position.set(Math.cos(a) * 0.18, 0.72 + (i % 2) * 0.1, Math.sin(a) * 0.18);
    leaf.rotation.y = -a;
    leaf.rotation.z = -tilt;
    leaf.castShadow = true;
    plant.add(leaf);
  }

  return plant;
}

export function buildWhiteboard(
  width: number,
  height: number,
  title: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const board = new THREE.Group();
  const frameShape = makeRoundedRectShape(width + 0.14, height + 0.14, 0.06);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  frameGeo.center();
  const frame = new THREE.Mesh(frameGeo, mats.brushedSteel);
  frame.castShadow = true;
  board.add(frame);

  const boardMat = mats.createScreenMaterial('whiteboard', '#2563eb', title);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), boardMat);
  face.position.z = 0.048;
  board.add(face);

  const tray = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.025, width * 0.7, 4, 8),
    mats.titanium,
  );
  tray.rotation.z = Math.PI / 2;
  tray.position.set(0, -height / 2 - 0.02, 0.07);
  board.add(tray);

  return board;
}

export function buildToolOrFileRack(
  accentHex: string,
  mats: SpaceMaterialLibrary,
  kind: 'tools' | 'files',
): THREE.Group {
  const rack = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.3);

  // Curved tubular outer frame
  const frameCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.75, 0, 0),
    new THREE.Vector3(-0.75, 1.95, 0),
    new THREE.Vector3(0.75, 1.95, 0),
    new THREE.Vector3(0.75, 0, 0),
  ]);
  const frame = new THREE.Mesh(
    new THREE.TubeGeometry(frameCurve, 24, 0.045, 8, false),
    mats.brushedSteel,
  );
  frame.castShadow = true;
  rack.add(frame);

  for (let tier = 0; tier < 3; tier++) {
    const y = 0.38 + tier * 0.58;
    const shelfShape = makeRoundedRectShape(1.42, 0.56, 0.08);
    const shelfGeo = new THREE.ExtrudeGeometry(shelfShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    shelfGeo.rotateX(Math.PI / 2);
    shelfGeo.center();
    const shelf = new THREE.Mesh(shelfGeo, mats.hullDark);
    shelf.position.y = y;
    shelf.castShadow = true;
    rack.add(shelf);

    if (kind === 'tools') {
      for (let k = -1; k <= 1; k++) {
        const canister = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.34, 10),
          k === 0 ? accentMat : mats.titanium,
        );
        canister.position.set(k * 0.38, y + 0.21, 0);
        canister.castShadow = true;
        rack.add(canister);
      }
    } else {
      const drawerShape = makeRoundedRectShape(1.26, 0.38, 0.05);
      const drawerGeo = new THREE.ExtrudeGeometry(drawerShape, {
        depth: 0.44,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
      });
      drawerGeo.center();
      const drawer = new THREE.Mesh(drawerGeo, mats.hullWhite);
      drawer.position.set(0, y + 0.22, 0.02);
      drawer.castShadow = true;
      rack.add(drawer);

      const handle = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.018, 0.36, 4, 8),
        accentMat,
      );
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, y + 0.24, 0.26);
      rack.add(handle);
    }
  }

  return rack;
}

export function buildMezzanineRailing(
  length: number,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const rail = new THREE.Group();

  const postCount = Math.max(2, Math.round(length / 2.4) + 1);
  for (let i = 0; i < postCount; i++) {
    const x = -length / 2 + (i / (postCount - 1)) * length;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 1.06, 8),
      mats.brushedSteel,
    );
    post.position.set(x, 0.53, 0);
    rail.add(post);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mats.titanium);
    cap.position.set(x, 1.08, 0);
    rail.add(cap);
  }

  // Triple opaque tubular steel horizontal safety rails (no glass!)
  for (const ry of [0.35, 0.7, 1.06]) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(ry === 1.06 ? 0.048 : 0.028, ry === 1.06 ? 0.048 : 0.028, length, 8),
      mats.brushedSteel,
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.y = ry;
    rail.add(bar);
  }

  // Kickplate trim along floor edge
  const kickShape = makeRoundedRectShape(length - 0.1, 0.14, 0.03);
  const kickGeo = new THREE.ExtrudeGeometry(kickShape, { depth: 0.04, bevelEnabled: false });
  kickGeo.center();
  const kick = new THREE.Mesh(kickGeo, mats.wallTrim);
  kick.position.y = 0.08;
  rail.add(kick);

  return rail;
}

export function buildCurvedCornerRailing(
  arcRadius: number,
  angleStart: number,
  angleEnd: number,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const rail = new THREE.Group();
  const segments = 8;

  for (const ry of [0.35, 0.7, 1.06]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = angleStart + (angleEnd - angleStart) * t;
      pts.push(new THREE.Vector3(Math.cos(a) * arcRadius, ry, Math.sin(a) * arcRadius));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const barRadius = ry === 1.06 ? 0.048 : 0.028;
    const bar = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 12, barRadius, 8, false),
      mats.brushedSteel,
    );
    rail.add(bar);
  }

  // Kickplate curved band at base
  const kickPts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = angleStart + (angleEnd - angleStart) * t;
    kickPts.push(new THREE.Vector3(Math.cos(a) * arcRadius, 0.08, Math.sin(a) * arcRadius));
  }
  const kickCurve = new THREE.CatmullRomCurve3(kickPts);
  rail.add(
    new THREE.Mesh(new THREE.TubeGeometry(kickCurve, 12, 0.045, 6, false), mats.wallTrim),
  );

  // Corner midpoint post
  const midA = (angleStart + angleEnd) * 0.5;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 1.06, 8),
    mats.brushedSteel,
  );
  post.position.set(Math.cos(midA) * arcRadius, 0.53, Math.sin(midA) * arcRadius);
  rail.add(post);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mats.titanium);
  cap.position.set(Math.cos(midA) * arcRadius, 1.08, Math.sin(midA) * arcRadius);
  rail.add(cap);

  return rail;
}

export function buildInteractiveConsole(
  roomId: RoomId,
  accentHex: string,
  screenTheme: ScreenTheme,
  title: string,
  mats: SpaceMaterialLibrary,
  consoleTargets: THREE.Object3D[],
  consoleRings: Record<string, THREE.Mesh>,
): THREE.Group {
  const consoleGroup = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.85);

  // Sculpted cylindrical pedestal column
  const pedPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.88, 0),
    new THREE.Vector2(0.75, 0.12),
    new THREE.Vector2(0.55, 0.78),
    new THREE.Vector2(0.8, 0.86),
    new THREE.Vector2(0, 0.86),
  ];
  const pedestal = new THREE.Mesh(new THREE.LatheGeometry(pedPts, 16), mats.hullDark);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  consoleGroup.add(pedestal);

  // Curved arc tabletop
  const deskShape = makeCurvedArcDeskShape(1.15, 2.25, Math.PI * 0.56);
  const deskGeo = new THREE.ExtrudeGeometry(deskShape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  deskGeo.rotateX(Math.PI / 2);
  const desk = new THREE.Mesh(deskGeo, mats.titanium);
  desk.position.set(0, 0.94, 0.35);
  desk.castShadow = true;
  consoleGroup.add(desk);

  // Capacitive glowing touchpad bar
  const pad = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 1.15, 4, 8),
    accentMat,
  );
  pad.rotation.z = Math.PI / 2;
  pad.scale.set(1, 1, 0.35);
  pad.position.set(0, 0.97, 0.16);
  consoleGroup.add(pad);

  // Triple wraparound monitors
  const centerMon = buildPanoramicMonitor(1.25, 0.66, screenTheme, accentHex, title, mats);
  centerMon.position.set(0, 0.94, -0.34);
  consoleGroup.add(centerMon);

  for (const side of [-1, 1]) {
    const sideMon = buildPanoramicMonitor(
      0.86,
      0.54,
      screenTheme,
      accentHex,
      side < 0 ? 'SYSTEMS' : 'MODULES',
      mats,
    );
    sideMon.position.set(side * 1.18, 0.94, -0.14);
    sideMon.rotation.y = -side * 0.42;
    consoleGroup.add(sideMon);
  }

  // Curved overhead status arch (TubeGeometry)
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.45, 0.94, -0.3),
    new THREE.Vector3(-1.35, 2.15, -0.3),
    new THREE.Vector3(0, 2.38, -0.3),
    new THREE.Vector3(1.35, 2.15, -0.3),
    new THREE.Vector3(1.45, 0.94, -0.3),
  ]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 24, 0.055, 8, false), accentMat);
  consoleGroup.add(arch);

  // Coffee mug + keyboard on console
  const kb = buildKeyboardAndMouse(accentHex, mats);
  kb.position.set(0, 0.96, 0.36);
  consoleGroup.add(kb);

  const mug = buildCoffeeMug(mats);
  mug.position.set(0.95, 0.94, 0.25);
  consoleGroup.add(mug);

  // Interactive floor ring
  const proxRing = new THREE.Mesh(
    new THREE.RingGeometry(1.75, 2.0, 28),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    }),
  );
  proxRing.rotation.x = -Math.PI / 2;
  proxRing.position.set(0, 0.04, 0.25);
  consoleGroup.add(proxRing);
  consoleRings[roomId] = proxRing;

  // Raycast click proxy
  const clickProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.75, 2.4, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  clickProxy.position.set(0, 1.2, 0);
  clickProxy.layers.set(1);
  clickProxy.userData.consoleRoomId = roomId;
  consoleGroup.add(clickProxy);
  consoleTargets.push(clickProxy);

  return consoleGroup;
}

export interface AuraMaterialEntry {
  mat: THREE.MeshStandardMaterial;
  baseEmissive: THREE.Color;
  baseIntensity: number;
}

export interface InteractableRegistryItem {
  id: InteractableId;
  roomId: Exclude<RoomId, 'overview'>;
  label: string;
  group: THREE.Group;
  anchorOffsetY: number;
  ringMesh: THREE.Mesh;
  proxyMesh: THREE.Mesh;
  auraHaloMesh: THREE.Mesh;
  auraEntries: AuraMaterialEntry[];
  cameraLocalPos: [number, number, number];
  cameraLocalLookAt: [number, number, number];
  drawerSlideGroup?: THREE.Group;
  paperSheet?: THREE.Mesh;
}

export function registerInteractableObject(
  group: THREE.Group,
  id: InteractableId,
  roomId: Exclude<RoomId, 'overview'>,
  label: string,
  accentHex: string,
  proxyRadius: number,
  proxyHeight: number,
  anchorOffsetY: number,
  interactableTargets: THREE.Object3D[],
  interactableRegistry: Record<string, InteractableRegistryItem>,
  options?: {
    cameraLocalPos?: [number, number, number];
    cameraLocalLookAt?: [number, number, number];
    proxyCenterY?: number;
    ringY?: number;
    hideRing?: boolean;
    drawerSlideGroup?: THREE.Group;
    paperSheet?: THREE.Mesh;
    highlightRoots?: THREE.Object3D[];
    auraRadius?: number;
    auraHeight?: number;
  },
): void {
  const ringY = options?.ringY ?? 0.035;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(proxyRadius * 0.72, proxyRadius * 0.86, 28),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: options?.hideRing ? 0 : 0.28,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = ringY;
  ring.visible = !options?.hideRing;
  group.add(ring);

  const centerY = options?.proxyCenterY ?? proxyHeight / 2;
  const proxy = new THREE.Mesh(
    new THREE.CylinderGeometry(proxyRadius, proxyRadius, proxyHeight, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  proxy.position.y = centerY;
  proxy.layers.set(1);
  proxy.userData.interactableId = id;
  proxy.userData.interactableRoom = roomId;
  proxy.userData.interactableLabel = label;
  group.add(proxy);

  // Soft electric light-blue (#38bdf8) luminous aura shell revealed on hover
  const haloR = options?.auraRadius ?? proxyRadius * 0.96;
  const haloH = options?.auraHeight ?? proxyHeight * 0.94;
  const auraHaloMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(haloR, haloR * 1.04, haloH, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  auraHaloMesh.position.y = centerY;
  auraHaloMesh.visible = false;
  group.add(auraHaloMesh);

  // Clone MeshStandardMaterials on highlightRoots so hovering one object never tints shared materials
  const auraEntries: AuraMaterialEntry[] = [];
  const rootsToScan = options?.highlightRoots ?? [group];
  const seenMeshes = new Set<THREE.Object3D>();
  for (const rootObj of rootsToScan) {
    if (!rootObj) continue;
    rootObj.traverse((child) => {
      if (seenMeshes.has(child)) return;
      seenMeshes.add(child);
      if (child === proxy || child === ring || child === auraHaloMesh) return;
      if (!(child instanceof THREE.Mesh)) return;
      if (Array.isArray(child.material)) {
        const clonedArr = child.material.map((m) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            const cm = m.clone();
            auraEntries.push({
              mat: cm,
              baseEmissive: cm.emissive.clone(),
              baseIntensity: cm.emissiveIntensity,
            });
            return cm;
          }
          return m;
        });
        child.material = clonedArr;
      } else if (child.material instanceof THREE.MeshStandardMaterial) {
        const cm = child.material.clone();
        child.material = cm;
        auraEntries.push({
          mat: cm,
          baseEmissive: cm.emissive.clone(),
          baseIntensity: cm.emissiveIntensity,
        });
      }
    });
  }

  interactableTargets.push(proxy);
  interactableRegistry[id] = {
    id,
    roomId,
    label,
    group,
    anchorOffsetY,
    ringMesh: ring,
    proxyMesh: proxy,
    auraHaloMesh,
    auraEntries,
    cameraLocalPos: options?.cameraLocalPos ?? [0, 1.65, 2.25],
    cameraLocalLookAt: options?.cameraLocalLookAt ?? [0, 1.35, 0],
    drawerSlideGroup: options?.drawerSlideGroup,
    paperSheet: options?.paperSheet,
  };
}

export function buildDraftingTableWithBlueprints(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const table = new THREE.Group();

  // Tubular A-frame legs
  for (const sx of [-0.95, 0.95]) {
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0, 0.52),
      new THREE.Vector3(sx, 0.88, 0.0),
      new THREE.Vector3(sx, 0, -0.52),
    ]);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(legCurve, 12, 0.042, 8, false), mats.brushedSteel);
    leg.castShadow = true;
    table.add(leg);
  }

  // Tilted drafting board
  const boardShape = makeRoundedRectShape(2.35, 1.35, 0.08);
  const boardGeo = new THREE.ExtrudeGeometry(boardShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  boardGeo.rotateX(Math.PI / 2);
  boardGeo.center();
  const board = new THREE.Mesh(boardGeo, mats.hullDark);
  board.position.set(0, 0.94, 0);
  board.rotation.x = 0.28;
  board.castShadow = true;
  table.add(board);

  // CanvasTexture technical blueprints taped to board
  const bpMat = mats.createScreenMaterial('blueprint', accentHex, 'ROCKET STRUCTURAL BLUEPRINT');
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.12), bpMat);
  sheet.position.set(0, 0.985, 0.01);
  sheet.rotation.x = -Math.PI / 2 + 0.28;
  table.add(sheet);

  // Rolled blueprint tubes on side
  for (let i = 0; i < 2; i++) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 10), mats.hullWhite);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(-0.55 + i * 0.25, 0.85, 0.56);
    table.add(roll);
  }

  return table;
}

export function buildMicroscopeAndCentrifugeBench(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const bench = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.55);

  // Clean sterile white rounded lab workbench
  const topShape = makeRoundedRectShape(2.6, 1.15, 0.14);
  const topGeo = new THREE.ExtrudeGeometry(topShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  topGeo.rotateX(Math.PI / 2);
  topGeo.center();
  const top = new THREE.Mesh(topGeo, mats.hullWhite);
  top.position.y = 0.88;
  top.castShadow = true;
  top.receiveShadow = true;
  bench.add(top);

  for (const lx of [-1.05, 1.05]) {
    for (const lz of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.86, 8), mats.brushedSteel);
      leg.position.set(lx, 0.43, lz);
      leg.castShadow = true;
      bench.add(leg);
    }
  }

  // Left: Detailed Optical Microscope (Lathe base + curved arm + objective tubes)
  const scope = new THREE.Group();
  scope.position.set(-0.58, 0.92, 0.02);
  const scopeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.07, 14), mats.hullDark);
  scopeBase.position.y = 0.035;
  scope.add(scopeBase);

  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.06, -0.14),
    new THREE.Vector3(0, 0.36, -0.18),
    new THREE.Vector3(0, 0.56, -0.02),
  ]);
  scope.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.035, 8, false), mats.brushedSteel));

  const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 12), accentMat);
  stage.position.set(0, 0.22, 0.02);
  scope.add(stage);

  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.24, 10), mats.titanium);
  turret.position.set(0, 0.46, 0.02);
  scope.add(turret);

  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.18, 10), mats.hullDark);
  eyepiece.position.set(0, 0.62, 0.08);
  eyepiece.rotation.x = 0.55;
  scope.add(eyepiece);
  bench.add(scope);

  // Right: Cylindrical Domed Centrifuge
  const cent = new THREE.Group();
  cent.position.set(0.58, 0.92, 0);
  const centPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.32, 0),
    new THREE.Vector2(0.34, 0.32),
    new THREE.Vector2(0.28, 0.44),
    new THREE.Vector2(0.12, 0.52),
    new THREE.Vector2(0, 0.53),
  ];
  const centBody = new THREE.Mesh(new THREE.LatheGeometry(centPts, 18), mats.hullWhite);
  centBody.castShadow = true;
  cent.add(centBody);

  const rotorRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 18), accentMat);
  rotorRing.rotation.x = Math.PI / 2;
  rotorRing.position.y = 0.34;
  cent.add(rotorRing);
  bench.add(cent);

  return bench;
}

export function buildSampleTubeRack(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const rack = new THREE.Group();
  const glowMat = makeAccentMat(accentHex, 0.8);

  const frameCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, 0, 0),
    new THREE.Vector3(-0.85, 2.0, 0),
    new THREE.Vector3(0.85, 2.0, 0),
    new THREE.Vector3(0.85, 0, 0),
  ]);
  rack.add(new THREE.Mesh(new THREE.TubeGeometry(frameCurve, 20, 0.045, 8, false), mats.brushedSteel));

  for (let tier = 0; tier < 3; tier++) {
    const y = 0.4 + tier * 0.6;
    const shelfShape = makeRoundedRectShape(1.6, 0.52, 0.08);
    const shelfGeo = new THREE.ExtrudeGeometry(shelfShape, { depth: 0.04, bevelEnabled: false });
    shelfGeo.rotateX(Math.PI / 2);
    shelfGeo.center();
    const shelf = new THREE.Mesh(shelfGeo, mats.hullWhite);
    shelf.position.y = y;
    rack.add(shelf);

    // Glowing specimen vials & containment capsules on each tier
    for (let k = -2; k <= 2; k++) {
      const vial = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.055, 0.22, 4, 8),
        k % 2 === 0 ? glowMat : mats.holoGlow,
      );
      vial.position.set(k * 0.28, y + 0.18, 0);
      rack.add(vial);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 10), mats.hullDark);
      cap.position.set(k * 0.28, y + 0.32, 0);
      rack.add(cap);
    }
  }

  return rack;
}

export function buildServerTelemetryRack(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const rack = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.7);

  // Rounded dark cabinet body
  const bodyShape = makeRoundedRectShape(1.25, 0.75, 0.1);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 2.25,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mats.hullDark);
  body.position.y = 2.25;
  body.castShadow = true;
  rack.add(body);

  // LED telemetry faceplate
  const faceMat = mats.createScreenMaterial('servers', accentHex, 'TELEMETRY');
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.95), faceMat);
  face.position.set(0, 1.16, 0.39);
  rack.add(face);

  // Top telemetry beacon & curved fiber optic conduit
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.14, 12), accentMat);
  topCap.position.y = 2.34;
  rack.add(topCap);

  const fiberCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.45, 2.28, -0.15),
    new THREE.Vector3(-0.65, 2.65, -0.35),
    new THREE.Vector3(0.45, 2.65, -0.35),
    new THREE.Vector3(0.45, 2.28, -0.15),
  ]);
  rack.add(new THREE.Mesh(new THREE.TubeGeometry(fiberCurve, 14, 0.04, 8, false), accentMat));

  return rack;
}

export function buildWallPoster(
  width: number,
  height: number,
  theme: ScreenTheme,
  accentHex: string,
  title: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const panel = new THREE.Group();
  const frameShape = makeRoundedRectShape(width + 0.14, height + 0.14, 0.06);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  frameGeo.center();
  const frame = new THREE.Mesh(frameGeo, mats.brushedSteel);
  frame.castShadow = true;
  panel.add(frame);

  const faceMat = mats.createScreenMaterial(theme, accentHex, title);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  face.position.z = 0.048;
  panel.add(face);

  return panel;
}

export function buildScaleRocketModel(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const model = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.3);

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.05, 14), mats.goldKapton);
  stand.position.y = 0.025;
  model.add(stand);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.42, 12), mats.hullWhite);
  body.position.y = 0.28;
  model.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, 12), accentMat);
  nose.position.y = 0.56;
  model.add(nose);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.07, 10), mats.copperNozzle);
  nozzle.position.y = 0.055;
  model.add(nozzle);

  return model;
}

export function buildDeskLamp(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const lamp = new THREE.Group();
  const basePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.09, 0.025),
    new THREE.Vector2(0.03, 0.04),
    new THREE.Vector2(0, 0.04),
  ];
  lamp.add(new THREE.Mesh(new THREE.LatheGeometry(basePts, 12), mats.hullDark));

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.03, -0.02),
    new THREE.Vector3(0, 0.28, -0.06),
    new THREE.Vector3(0, 0.44, 0.08),
  ]);
  lamp.add(new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 10, 0.014, 6, false), mats.brushedSteel));

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.13, 14, 1, false),
    makeAccentMat(accentHex, 0.25),
  );
  shade.position.set(0, 0.41, 0.12);
  shade.rotation.x = 0.55;
  lamp.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfef3c7 }),
  );
  bulb.position.set(0, 0.37, 0.13);
  lamp.add(bulb);

  return lamp;
}

export function buildAnimatedFilingDrawer(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): {
  group: THREE.Group;
  drawerSlideGroup: THREE.Group;
  paperSheet: THREE.Mesh;
} {
  const group = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.45);

  // Sculpted cylindrical legs
  for (const lx of [-0.52, 0.52]) {
    for (const lz of [-0.32, 0.32]) {
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.055, 0.12, 10),
        mats.brushedSteel,
      );
      foot.position.set(lx, 0.06, lz);
      group.add(foot);
    }
  }

  // Main rounded cabinet shell (back/sides/top/bottom)
  const bodyShape = makeRoundedRectShape(1.28, 0.84, 0.08);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 1.24,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mats.hullDark);
  body.position.set(0, 1.36, -0.02);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Lower 2 static drawer fronts
  const faceShape = makeRoundedRectShape(1.12, 0.32, 0.04);
  const faceGeo = new THREE.ExtrudeGeometry(faceShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  faceGeo.center();

  for (let i = 0; i < 2; i++) {
    const fy = 0.32 + i * 0.37;
    const face = new THREE.Mesh(faceGeo, mats.titanium);
    face.position.set(0, fy, 0.42);
    group.add(face);

    const handle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.28, 4, 8),
      mats.brushedSteel,
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, fy + 0.02, 0.46);
    group.add(handle);
  }

  // Animated top drawer group (slides out along +Z when focused!)
  const drawerSlideGroup = new THREE.Group();
  drawerSlideGroup.position.set(0, 1.08, 0);

  const trayShape = makeRoundedRectShape(1.06, 0.72, 0.04);
  const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  trayGeo.rotateX(Math.PI / 2);
  trayGeo.center();
  const tray = new THREE.Mesh(trayGeo, mats.hullWhite);
  tray.position.set(0, -0.02, 0.06);
  drawerSlideGroup.add(tray);

  const topFace = new THREE.Mesh(faceGeo, mats.titanium);
  topFace.position.set(0, 0, 0.43);
  drawerSlideGroup.add(topFace);

  const topHandle = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.018, 0.32, 4, 8),
    accentMat,
  );
  topHandle.rotation.z = Math.PI / 2;
  topHandle.position.set(0, 0.02, 0.47);
  drawerSlideGroup.add(topHandle);

  // Colored index folders sitting inside the drawer
  for (let f = -1; f <= 1; f++) {
    const tab = buildBeveledFolder(accentHex, mats);
    tab.rotation.x = Math.PI / 2;
    tab.scale.set(0.9, 0.9, 0.9);
    tab.position.set(0, 0.04, 0.14 + f * 0.08);
    drawerSlideGroup.add(tab);
  }

  // Technical paper document that rises upward out of the drawer when opened
  const paperSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.58),
    mats.paperReport,
  );
  paperSheet.position.set(0, 0.06, 0.24);
  paperSheet.rotation.x = -0.22;
  drawerSlideGroup.add(paperSheet);

  group.add(drawerSlideGroup);

  // Folder & desk lamp resting on top of the filing cabinet
  const topFolder = buildBeveledFolder(accentHex, mats);
  topFolder.position.set(-0.25, 1.4, 0.06);
  topFolder.rotation.y = 0.22;
  group.add(topFolder);

  const lamp = buildDeskLamp(accentHex, mats);
  lamp.position.set(0.36, 1.4, -0.14);
  lamp.rotation.y = -0.35;
  group.add(lamp);

  return { group, drawerSlideGroup, paperSheet };
}

export function buildStandingWhiteboard(
  width: number,
  height: number,
  title: string,
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.35);

  for (const sx of [-width * 0.44, width * 0.44]) {
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.04, 0.42),
      new THREE.Vector3(sx, 0.28, 0),
      new THREE.Vector3(sx, 2.45, 0),
    ]);
    const leg = new THREE.Mesh(
      new THREE.TubeGeometry(legCurve, 12, 0.045, 8, false),
      mats.brushedSteel,
    );
    leg.castShadow = true;
    group.add(leg);

    const backFoot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.84, 8),
      mats.brushedSteel,
    );
    backFoot.rotation.x = Math.PI / 2;
    backFoot.position.set(sx, 0.04, 0);
    group.add(backFoot);
  }

  const board = buildWhiteboard(width, height, title, mats);
  board.position.set(0, 1.62, 0.03);
  group.add(board);

  // Colored magnetic markers on tray
  for (let m = 0; m < 3; m++) {
    const marker = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.12, 3, 6),
      m === 0 ? accentMat : mats.hullDark,
    );
    marker.rotation.z = Math.PI / 2;
    marker.position.set(-0.45 + m * 0.25, 1.62 - height / 2 + 0.02, 0.11);
    group.add(marker);
  }

  return group;
}

export function buildCommsTerminal(
  accentHex: string,
  title: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const comms = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.75);

  const pedPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.62, 0),
    new THREE.Vector2(0.42, 0.18),
    new THREE.Vector2(0.28, 0.95),
    new THREE.Vector2(0.48, 1.05),
    new THREE.Vector2(0, 1.05),
  ];
  const ped = new THREE.Mesh(new THREE.LatheGeometry(pedPts, 14), mats.hullDark);
  ped.castShadow = true;
  comms.add(ped);

  const consoleShape = makeRoundedRectShape(1.45, 0.72, 0.12);
  const consoleGeo = new THREE.ExtrudeGeometry(consoleShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  consoleGeo.rotateX(Math.PI / 2);
  consoleGeo.center();
  const shelf = new THREE.Mesh(consoleGeo, mats.titanium);
  shelf.position.set(0, 1.06, 0.12);
  comms.add(shelf);

  const mainMon = buildPanoramicMonitor(1.18, 0.64, 'comms', accentHex, title, mats);
  mainMon.position.set(0, 1.08, -0.06);
  comms.add(mainMon);

  // Communications antenna mast + glowing beacon
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.85, 8),
    mats.brushedSteel,
  );
  mast.position.set(0.58, 1.48, -0.18);
  comms.add(mast);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), accentMat);
  tip.position.set(0.58, 1.94, -0.18);
  comms.add(tip);

  const kb = buildKeyboardAndMouse(accentHex, mats);
  kb.position.set(0, 1.1, 0.25);
  comms.add(kb);

  return comms;
}

export function buildBookshelfWithBooks(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const shelfUnit = new THREE.Group();
  const binderColors = [accentHex, '#38BDF8', '#22C55E', '#EAB308', '#F97316', '#94A3B8'];

  for (const sx of [-1.02, 1.02]) {
    for (const sz of [-0.24, 0.24]) {
      const upright = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.04, 2.08, 8),
        mats.brushedSteel,
      );
      upright.position.set(sx, 1.04, sz);
      upright.castShadow = true;
      shelfUnit.add(upright);
    }
  }

  const shelfShape = makeRoundedRectShape(2.14, 0.56, 0.06);
  const shelfGeo = new THREE.ExtrudeGeometry(shelfShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  shelfGeo.rotateX(Math.PI / 2);
  shelfGeo.center();

  const bookShape = makeRoundedRectShape(0.07, 0.34, 0.012);
  const bookGeo = new THREE.ExtrudeGeometry(bookShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 1,
  });
  bookGeo.center();

  for (let tier = 0; tier < 4; tier++) {
    const sy = 0.22 + tier * 0.54;
    const shelf = new THREE.Mesh(shelfGeo, mats.hullDark);
    shelf.position.y = sy;
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    shelfUnit.add(shelf);

    if (tier < 3) {
      for (let b = 0; b < 11; b++) {
        const bx = -0.82 + b * 0.16;
        if ((tier === 1 && b === 6) || (tier === 2 && b === 3)) continue;
        const book = new THREE.Mesh(
          bookGeo,
          makeAccentMat(binderColors[(tier * 5 + b) % binderColors.length], 0.12),
        );
        const hScale = 0.78 + ((tier + b) % 4) * 0.12;
        book.scale.set(1, hScale, 1);
        book.position.set(bx, sy + 0.025 + 0.17 * hScale, 0.02);
        if (b === 10 && tier === 0) {
          book.rotation.z = 0.24;
          book.position.x -= 0.04;
        }
        shelfUnit.add(book);
      }
    } else {
      // Top shelf holds decorative scale model + folders
      const miniRocket = buildScaleRocketModel(accentHex, mats);
      miniRocket.scale.setScalar(0.75);
      miniRocket.position.set(0.45, sy + 0.03, 0);
      shelfUnit.add(miniRocket);

      const folderStack = buildBeveledFolder(accentHex, mats);
      folderStack.position.set(-0.45, sy + 0.04, 0);
      shelfUnit.add(folderStack);
    }
  }

  return shelfUnit;
}

export function buildLockerBank(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const lockers = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.3);

  const bodyShape = makeRoundedRectShape(1.92, 0.64, 0.07);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 2.02,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mats.hullDark);
  body.position.y = 2.05;
  body.castShadow = true;
  body.receiveShadow = true;
  lockers.add(body);

  const doorShape = makeRoundedRectShape(0.54, 1.82, 0.03);
  const doorGeo = new THREE.ExtrudeGeometry(doorShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  doorGeo.center();

  for (let i = -1; i <= 1; i++) {
    const dx = i * 0.6;
    const door = new THREE.Mesh(doorGeo, mats.titanium);
    door.position.set(dx, 1.04, 0.34);
    lockers.add(door);

    const handle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.16, 3, 6),
      accentMat,
    );
    handle.position.set(dx + 0.18, 1.06, 0.37);
    lockers.add(handle);
  }

  return lockers;
}

export function buildRollingToolCart(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const cart = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.45);
  const redDrawerMat = makeAccentMat('#DC2626', 0.18);

  // 4 caster wheels
  for (const wx of [-0.48, 0.48]) {
    for (const wz of [-0.24, 0.24]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.045, 12),
        mats.hullDark,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.065, wz);
      cart.add(wheel);
    }
  }

  // Beveled steel tool chest body
  const bodyShape = makeRoundedRectShape(1.18, 0.64, 0.07);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.78,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mats.hullDark);
  body.position.y = 0.92;
  body.castShadow = true;
  body.receiveShadow = true;
  cart.add(body);

  // 4 colored industrial tool drawers
  const drawerShape = makeRoundedRectShape(0.96, 0.13, 0.025);
  const drawerGeo = new THREE.ExtrudeGeometry(drawerShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  drawerGeo.center();
  for (let i = 0; i < 4; i++) {
    const dy = 0.25 + i * 0.165;
    const dr = new THREE.Mesh(drawerGeo, i % 2 === 0 ? redDrawerMat : mats.titanium);
    dr.position.set(0, dy, 0.33);
    cart.add(dr);

    const pull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.012, 0.42, 3, 6),
      mats.brushedSteel,
    );
    pull.rotation.z = Math.PI / 2;
    pull.position.set(0, dy, 0.36);
    cart.add(pull);
  }

  // Tubular push handle on right side
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.58, 0.85, -0.24),
    new THREE.Vector3(0.76, 0.95, -0.24),
    new THREE.Vector3(0.76, 0.95, 0.24),
    new THREE.Vector3(0.58, 0.85, 0.24),
  ]);
  cart.add(new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 12, 0.022, 8, false), accentMat));

  // Wrenches & cylindrical calibration gauge on top mat
  for (const ix of [-0.26, 0.12]) {
    const wrench = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.018, 0.28, 3, 6),
      mats.brushedSteel,
    );
    wrench.rotation.z = Math.PI / 2;
    wrench.rotation.y = ix * 1.4;
    wrench.position.set(ix, 0.95, 0.05);
    cart.add(wrench);
  }
  const canister = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.22, 12),
    mats.copperNozzle,
  );
  canister.position.set(0.36, 1.05, -0.1);
  cart.add(canister);

  return cart;
}

export function buildTechCrateCluster(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const cluster = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.4);

  const configs = [
    { x: 0, y: 0, z: 0, w: 1.25, d: 0.95, h: 0.82, rot: 0.08, mat: mats.titanium },
    { x: 1.18, y: 0, z: 0.28, w: 0.92, d: 0.85, h: 0.64, rot: -0.35, mat: mats.hazardFloor },
    { x: 0.15, y: 0.82, z: -0.05, w: 0.78, d: 0.68, h: 0.52, rot: 0.24, mat: mats.hullDark },
  ];

  configs.forEach((c) => {
    const shape = makeRoundedRectShape(c.w, c.d, 0.08);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: c.h,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    geo.rotateX(Math.PI / 2);
    const crate = new THREE.Mesh(geo, c.mat);
    crate.position.set(c.x, c.y + c.h + 0.025, c.z);
    crate.rotation.y = c.rot;
    crate.castShadow = true;
    crate.receiveShadow = true;
    cluster.add(crate);

    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(c.w, c.d) * 0.42, 0.022, 6, 16),
      accentMat,
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.set(c.x, c.y + c.h + 0.04, c.z);
    cluster.add(strap);
  });

  return cluster;
}

export function buildGasBottleRack(mats: SpaceMaterialLibrary): THREE.Group {
  const rack = new THREE.Group();
  const baseShape = makeRoundedRectShape(1.55, 0.75, 0.08);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  baseGeo.rotateX(Math.PI / 2);
  const base = new THREE.Mesh(baseGeo, mats.hullDark);
  base.position.y = 0.16;
  base.castShadow = true;
  rack.add(base);

  const tankMatBlue = makeAccentMat('#0284C7', 0.18);
  const tankMatGreen = makeAccentMat('#16A34A', 0.18);
  const frameCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.7, 0.16, -0.25),
    new THREE.Vector3(-0.7, 1.55, -0.25),
    new THREE.Vector3(0.7, 1.55, -0.25),
    new THREE.Vector3(0.7, 0.16, -0.25),
  ]);
  rack.add(new THREE.Mesh(new THREE.TubeGeometry(frameCurve, 16, 0.036, 8, false), mats.craneYellow));

  for (let i = 0; i < 4; i++) {
    const tx = -0.48 + i * 0.32;
    const cyl = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.125, 1.38, 6, 12),
      i % 2 === 0 ? tankMatBlue : tankMatGreen,
    );
    cyl.position.set(tx, 0.96, 0);
    cyl.castShadow = true;
    rack.add(cyl);

    const valve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.14, 10),
      mats.copperNozzle,
    );
    valve.position.set(tx, 1.82, 0);
    rack.add(valve);

    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 6, 12),
      mats.craneYellow,
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(tx, 1.9, 0);
    rack.add(wheel);
  }

  return rack;
}

export function buildCompressorUnit(
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const unit = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.45);

  const skidShape = makeRoundedRectShape(1.85, 0.95, 0.12);
  const skidGeo = new THREE.ExtrudeGeometry(skidShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  skidGeo.rotateX(Math.PI / 2);
  const skid = new THREE.Mesh(skidGeo, mats.hullDark);
  skid.position.y = 0.16;
  skid.castShadow = true;
  unit.add(skid);

  const tank = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.95, 8, 16),
    mats.titanium,
  );
  tank.rotation.z = Math.PI / 2;
  tank.position.set(-0.15, 0.56, 0);
  tank.castShadow = true;
  unit.add(tank);

  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.46, 14),
    mats.copperNozzle,
  );
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0.55, 0.48, 0);
  unit.add(motor);

  const gauge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14),
    accentMat,
  );
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(-0.25, 0.98, 0.18);
  unit.add(gauge);

  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.55, 0.72, 0),
    new THREE.Vector3(0.25, 1.08, -0.08),
    new THREE.Vector3(-0.35, 0.88, 0),
  ]);
  unit.add(new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 12, 0.038, 8, false), mats.brushedSteel));

  return unit;
}

export function buildVabWallSegment(
  segLen: number,
  wallHeight: number,
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const seg = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.4);
  const valveRedMat = makeAccentMat('#EF4444', 0.25);

  // Lower yellow/black hazard plinth molding inside wall face (-Z faces room interior)
  const plinthShape = makeRoundedRectShape(segLen * 0.94, 0.72, 0.05);
  const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  plinthGeo.center();
  const plinth = new THREE.Mesh(plinthGeo, mats.hazardFloor);
  plinth.position.set(0, 0.42, -0.26);
  seg.add(plinth);

  // Vertical steel truss ribs
  for (const rx of [-segLen * 0.34, segLen * 0.34]) {
    const rib = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, wallHeight - 0.6, 8),
      mats.brushedSteel,
    );
    rib.position.set(rx, wallHeight / 2, -0.26);
    rib.castShadow = true;
    seg.add(rib);

    for (const ry of [2.8, 6.2, 9.6]) {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.035, 6, 12),
        mats.hullDark,
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.set(rx, ry, -0.26);
      seg.add(collar);
    }
  }

  // Horizontal structural I-beam catwalk brackets along upper wall
  for (const by of [4.2, 8.6]) {
    const girder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, segLen * 0.88, 10),
      mats.hullDark,
    );
    girder.rotation.z = Math.PI / 2;
    girder.position.set(0, by, -0.28);
    seg.add(girder);
  }

  // Thick industrial propellant manifolds + red handwheel valves & pressure gauge
  const pipeOffsets = [-1.45, -1.05];
  pipeOffsets.forEach((px, idx) => {
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, 0.8, -0.34),
      new THREE.Vector3(px, 5.2, -0.34),
      new THREE.Vector3(px + (idx === 0 ? -0.35 : 0.35), 7.8, -0.34),
      new THREE.Vector3(px + (idx === 0 ? -0.35 : 0.35), wallHeight - 1.2, -0.34),
    ]);
    const pipe = new THREE.Mesh(
      new THREE.TubeGeometry(pipeCurve, 16, 0.11, 8, false),
      idx === 0 ? mats.copperNozzle : mats.titanium,
    );
    seg.add(pipe);

    const valveWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.038, 8, 14),
      idx === 0 ? valveRedMat : mats.craneYellow,
    );
    valveWheel.position.set(px, 1.75 + idx * 0.45, -0.48);
    seg.add(valveWheel);
  });

  // Beveled industrial wall control cabinet + telemetry beacon
  const cabShape = makeRoundedRectShape(1.45, 1.85, 0.08);
  const cabGeo = new THREE.ExtrudeGeometry(cabShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  cabGeo.center();
  const cabinet = new THREE.Mesh(cabGeo, mats.hullDark);
  cabinet.position.set(1.25, 1.75, -0.34);
  seg.add(cabinet);

  const gauge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16),
    accentMat,
  );
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(1.25, 2.25, -0.52);
  seg.add(gauge);

  return seg;
}

export function buildStandingScheduleBoard(
  width: number,
  height: number,
  title: string,
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.38);

  for (const sx of [-width * 0.44, width * 0.44]) {
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.04, 0.42),
      new THREE.Vector3(sx, 0.28, 0),
      new THREE.Vector3(sx, 2.55, 0),
    ]);
    const leg = new THREE.Mesh(
      new THREE.TubeGeometry(legCurve, 12, 0.045, 8, false),
      mats.brushedSteel,
    );
    leg.castShadow = true;
    group.add(leg);

    const backFoot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.84, 8),
      mats.brushedSteel,
    );
    backFoot.rotation.x = Math.PI / 2;
    backFoot.position.set(sx, 0.04, 0);
    group.add(backFoot);
  }

  const frameShape = makeRoundedRectShape(width + 0.16, height + 0.16, 0.06);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  frameGeo.center();
  const frame = new THREE.Mesh(frameGeo, mats.brushedSteel);
  frame.position.set(0, 1.65, 0.03);
  frame.castShadow = true;
  group.add(frame);

  const faceMat = mats.createScreenMaterial('schedule', accentHex, title);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  face.position.set(0, 1.65, 0.08);
  group.add(face);

  const tray = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.025, width * 0.72, 4, 8),
    mats.titanium,
  );
  tray.rotation.z = Math.PI / 2;
  tray.position.set(0, 1.65 - height / 2 - 0.02, 0.1);
  group.add(tray);

  const marker = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.12, 3, 6), accentMat);
  marker.rotation.z = Math.PI / 2;
  marker.position.set(-0.35, 1.65 - height / 2 + 0.02, 0.13);
  group.add(marker);

  return group;
}

export interface AerospaceRadarRig {
  group: THREE.Group;
  azimuthGroup: THREE.Group;
  elevationGroup: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
}

export function buildAerospaceRadarStation(
  accentHex: string,
  mats: SpaceMaterialLibrary,
  scale = 1,
): AerospaceRadarRig {
  const group = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.55);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 1.9,
    roughness: 0.15,
    metalness: 0.1,
  });

  // 1. Octagonal bolted concrete/steel base with hazard trim
  const concretePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.16, 1.32, 0.34, 8),
    mats.weatheredSteel,
  );
  concretePlinth.rotation.y = Math.PI / 8;
  concretePlinth.position.y = 0.17;
  concretePlinth.castShadow = true;
  concretePlinth.receiveShadow = true;
  group.add(concretePlinth);

  const hazardTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 1.25, 0.12, 8),
    mats.hazardFloor,
  );
  hazardTrim.rotation.y = Math.PI / 8;
  hazardTrim.position.y = 0.08;
  group.add(hazardTrim);

  // 8 perimeter hex anchor bolts
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.09, 6),
      mats.brushedSteel,
    );
    bolt.position.set(Math.cos(a) * 1.02, 0.36, Math.sin(a) * 1.02);
    group.add(bolt);
  }

  // Machined azimuth slewing bearing ring
  const slewRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.075, 8, 24),
    mats.hullDark,
  );
  slewRing.rotation.x = Math.PI / 2;
  slewRing.position.y = 0.37;
  group.add(slewRing);

  // 2. Rotating Azimuth Turntable Housing
  const azimuthGroup = new THREE.Group();
  azimuthGroup.position.y = 0.42;
  group.add(azimuthGroup);

  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.8, 0.34, 16),
    mats.titanium,
  );
  turntable.position.y = 0.17;
  turntable.castShadow = true;
  azimuthGroup.add(turntable);

  // Rear RF electronics cabinet with louvered accent trim
  const cabShape = makeRoundedRectShape(0.86, 0.62, 0.06);
  const cabGeo = new THREE.ExtrudeGeometry(cabShape, {
    depth: 0.46,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  cabGeo.center();
  const rfCab = new THREE.Mesh(cabGeo, mats.hullDark);
  rfCab.position.set(0, 0.42, -0.52);
  rfCab.castShadow = true;
  azimuthGroup.add(rfCab);

  const rfStrip = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.62, 4, 8), accentMat);
  rfStrip.rotation.z = Math.PI / 2;
  rfStrip.position.set(0, 0.56, -0.76);
  azimuthGroup.add(rfStrip);

  // Twin mechanical elevation yoke arms + cylindrical gearboxes
  for (const side of [-1, 1]) {
    const yokeArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 0.88, 10),
      mats.brushedSteel,
    );
    yokeArm.position.set(side * 0.56, 0.64, 0.02);
    yokeArm.rotation.z = side * -0.14;
    yokeArm.castShadow = true;
    azimuthGroup.add(yokeArm);

    const gearbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.22, 14),
      mats.weatheredSteel,
    );
    gearbox.rotation.z = Math.PI / 2;
    gearbox.position.set(side * 0.68, 1.02, 0.02);
    azimuthGroup.add(gearbox);

    const gearCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.25, 12),
      accentMat,
    );
    gearCap.rotation.z = Math.PI / 2;
    gearCap.position.set(side * 0.69, 1.02, 0.02);
    azimuthGroup.add(gearCap);

    // Hydraulic elevation piston struts (lower barrel + chrome piston rod)
    const barrelCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.38, 0.3, -0.34),
      new THREE.Vector3(side * 0.44, 0.56, -0.2),
    ]);
    azimuthGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(barrelCurve, 6, 0.055, 8, false), mats.hullDark),
    );
    const rodCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.44, 0.56, -0.2),
      new THREE.Vector3(side * 0.5, 0.92, -0.02),
    ]);
    azimuthGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(rodCurve, 6, 0.032, 8, false), mats.brushedSteel),
    );

    // Bundled waveguide cables looping from cabinet into trunnion yoke
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.22, 0.34, -0.42),
      new THREE.Vector3(side * 0.48, 0.42, -0.36),
      new THREE.Vector3(side * 0.62, 0.72, -0.16),
      new THREE.Vector3(side * 0.58, 0.98, 0.0),
    ]);
    azimuthGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 12, 0.036, 6, false), mats.heavyCableDark),
    );
  }

  // Elevation axle crossbeam
  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1.32, 12),
    mats.brushedSteel,
  );
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, 1.02, 0.02);
  azimuthGroup.add(axle);

  // 3. Concave Parabolic Dish Assembly with radial ribs, mesh segments & tripod feed-horn
  const elevationGroup = new THREE.Group();
  elevationGroup.position.set(0, 1.02, 0.02);
  elevationGroup.rotation.x = -0.44;
  azimuthGroup.add(elevationGroup);

  // Rear counterweight & sector elevation gear
  const sectorGear = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.16, 16),
    mats.craneYellow,
  );
  sectorGear.rotation.z = Math.PI / 2;
  sectorGear.position.set(0, -0.04, -0.14);
  elevationGroup.add(sectorGear);

  const counterWeight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.34, 12),
    mats.weatheredSteel,
  );
  counterWeight.rotation.x = Math.PI / 2;
  counterWeight.position.set(0, -0.14, -0.36);
  elevationGroup.add(counterWeight);

  // Dish bowl tilted along +Z
  const dishWrap = new THREE.Group();
  dishWrap.rotation.x = Math.PI / 2;
  dishWrap.position.set(0, 0.12, 0.26);
  elevationGroup.add(dishWrap);

  const dishProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.32, 0.04),
    new THREE.Vector2(0.68, 0.16),
    new THREE.Vector2(0.98, 0.33),
    new THREE.Vector2(1.18, 0.49),
    new THREE.Vector2(1.22, 0.48),
    new THREE.Vector2(1.0, 0.29),
    new THREE.Vector2(0.68, 0.12),
    new THREE.Vector2(0.3, 0.01),
    new THREE.Vector2(0.0, -0.02),
  ];
  const dishBowl = new THREE.Mesh(
    new THREE.LatheGeometry(dishProfile, 24),
    mats.hullWhite,
  );
  dishBowl.castShadow = true;
  dishBowl.receiveShadow = true;
  dishWrap.add(dishBowl);

  // Outer perimeter reflector rim & concentric RF mesh segment rings
  const outerRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.19, 0.042, 8, 28),
    mats.titanium,
  );
  outerRim.rotation.x = Math.PI / 2;
  outerRim.position.y = 0.49;
  dishWrap.add(outerRim);

  for (const [ringR, ringY] of [
    [0.42, 0.06],
    [0.78, 0.21],
  ]) {
    const segRing = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, 0.016, 6, 20),
      mats.brushedSteel,
    );
    segRing.rotation.x = Math.PI / 2;
    segRing.position.y = ringY;
    dishWrap.add(segRing);
  }

  // 8 Radial structural backing ribs + circular backing truss ring on convex underside
  const backTruss = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.03, 6, 20),
    mats.weatheredSteel,
  );
  backTruss.rotation.x = Math.PI / 2;
  backTruss.position.y = 0.11;
  dishWrap.add(backTruss);

  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const ribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.18, -0.04, Math.sin(a) * 0.18),
      new THREE.Vector3(Math.cos(a) * 0.68, 0.09, Math.sin(a) * 0.68),
      new THREE.Vector3(Math.cos(a) * 1.15, 0.44, Math.sin(a) * 1.15),
    ]);
    dishWrap.add(
      new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 8, 0.024, 6, false), mats.weatheredSteel),
    );
  }

  // Central RF hub + tripod feed-horn receiver mast + blinking telemetry beacon LED
  const centralHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.24, 12),
    mats.hullDark,
  );
  centralHub.position.y = 0.12;
  dishWrap.add(centralHub);

  const tripodApexY = 1.06;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const strutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.94, 0.32, Math.sin(a) * 0.94),
      new THREE.Vector3(Math.cos(a) * 0.08, tripodApexY, Math.sin(a) * 0.08),
    ]);
    dishWrap.add(
      new THREE.Mesh(new THREE.TubeGeometry(strutCurve, 6, 0.022, 6, false), mats.brushedSteel),
    );
  }

  const receiverCan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, 0.28, 12),
    mats.titanium,
  );
  receiverCan.position.y = tripodApexY;
  dishWrap.add(receiverCan);

  const subReflector = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.16, 12),
    mats.copperNozzle,
  );
  subReflector.rotation.x = Math.PI;
  subReflector.position.y = tripodApexY - 0.18;
  dishWrap.add(subReflector);

  // Bundled waveguide pipe running along lower strut into receiver
  const feedCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.08, 0.16, 0.08),
    new THREE.Vector3(0.42, 0.36, 0.42),
    new THREE.Vector3(0.12, tripodApexY - 0.04, 0.12),
  ]);
  dishWrap.add(
    new THREE.Mesh(new THREE.TubeGeometry(feedCableCurve, 10, 0.02, 6, false), accentMat),
  );

  // Telemetry Beacon LED atop receiver mast
  const beaconLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 10, 8),
    beaconMat,
  );
  beaconLed.position.y = tripodApexY + 0.18;
  dishWrap.add(beaconLed);

  if (scale !== 1) {
    group.scale.setScalar(scale);
  }

  return { group, azimuthGroup, elevationGroup, beaconMat };
}

export interface RepoCrewBotRig {
  group: THREE.Group;
  astronaut: FloatingLimbAstronautRig;
  sparksGroup: THREE.Group;
  isTechnician: boolean;
  accentColorHex: string;
}

export function buildRepoCrewBot(
  mats: SpaceMaterialLibrary,
  options: {
    roleId?: RoleId;
    accentHex?: string;
    suitHex?: number;
    withScannerWand?: boolean;
    scale?: number;
  } = {},
): RepoCrewBotRig {
  const accentHex = options.accentHex ?? '#38BDF8';
  const withScannerWand = options.withScannerWand ?? false;

  const astronaut = buildFloatingLimbAstronaut(mats, {
    roleId: options.roleId,
    accentHex,
    suitHex: options.suitHex,
    scale: options.scale,
  });
  const { group } = astronaut;

  // Sparks & micro-repair tether emitted cleanly in front of reaching floating right hand (no physical arm/wand)
  const sparksGroup = new THREE.Group();
  sparksGroup.position.set(0.22, 0.72, 0.72);

  if (withScannerWand) {
    const emitterDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    emitterDot.position.set(0.22, 0.71, 0.51);
    group.add(emitterDot);

    const beamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.22, 0.71, 0.50),
      new THREE.Vector3(0.24, 0.73, 0.62),
      new THREE.Vector3(0.22, 0.72, 0.72),
    ]);
    const repairBeam = new THREE.Mesh(
      new THREE.TubeGeometry(beamCurve, 8, 0.011, 6, false),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
      }),
    );
    group.add(repairBeam);

    for (let i = 0; i < 6; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 6, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xfbbf24 : 0x38bdf8,
          transparent: true,
          opacity: 0.9,
        }),
      );
      spark.userData.angle = (i * Math.PI * 2) / 6;
      const a = (i * Math.PI * 2) / 6;
      spark.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
      sparksGroup.add(spark);
    }
  } else {
    sparksGroup.visible = false;
  }
  group.add(sparksGroup);

  return {
    group,
    astronaut,
    sparksGroup,
    isTechnician: withScannerWand,
    accentColorHex: accentHex,
  };
}

export function buildStylizedTechnician(mats: SpaceMaterialLibrary): RepoCrewBotRig {
  return buildRepoCrewBot(mats, {
    roleId: 'systems',
    accentHex: '#F97316',
    withScannerWand: true,
  });
}
