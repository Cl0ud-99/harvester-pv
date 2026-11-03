import * as THREE from 'three';
import { panelSet, groundSet, rockSet, deckSet, hazardTex, hLogoTex, textTex } from './textures.js';

export const PAL = {
  white: '#dcd6c8',
  whiteDirty: '#cfc7b6',
  blue: '#2f6a96',
  blueDeep: '#1d4a6b',
  steel: '#3a3c3d',
  dark: '#24262a',
  rust: '#7c4423',
  copper: '#a85c2c',
  yellow: '#d9a521',
  orange: '#e0722a',
  lava: '#ff5a12',
  grass: '#6c7a30',
  rock: '#6b6257',
};

export function createMaterials() {
  const white = panelSet('armourWhite', { base: PAL.white, seam: 'rgba(30,32,30,0.42)', dirt: 0.5, rust: 0.28, rows: 4, cols: 4, roughBase: '#7d7d7d', repeat: [1, 1] });
  const whiteDirty = panelSet('armourDirty', { base: PAL.whiteDirty, seam: 'rgba(26,26,24,0.55)', dirt: 0.85, rust: 0.6, rows: 3, cols: 3, roughBase: '#9a9a9a', seed: 12 });
  const bluePanel = panelSet('bluePanel', { base: PAL.blue, seam: 'rgba(10,22,32,0.55)', accent: 'rgba(220,225,230,0.75)', dirt: 0.5, rust: 0.15, rows: 2, cols: 3, seed: 3 });
  const deck = deckSet();
  const ground = groundSet({ repeat: [52, 52], size: 2048 });
  const rock = rockSet({ repeat: [3, 3] });

  const M = {};

  M.armour = new THREE.MeshPhysicalMaterial({
    map: white.map, normalMap: white.normalMap, roughnessMap: white.roughnessMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    color: 0xffffff, metalness: 0.22, roughness: 0.62,
    clearcoat: 0.22, clearcoatRoughness: 0.55, envMapIntensity: 0.5,
  });

  M.armourDirty = new THREE.MeshPhysicalMaterial({
    map: whiteDirty.map, normalMap: whiteDirty.normalMap, roughnessMap: whiteDirty.roughnessMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    color: 0xffffff, metalness: 0.26, roughness: 0.72,
    clearcoat: 0.34, clearcoatRoughness: 0.5, envMapIntensity: 0.26,
  });

  M.armourBlue = new THREE.MeshPhysicalMaterial({
    map: bluePanel.map, normalMap: bluePanel.normalMap, roughnessMap: bluePanel.roughnessMap,
    color: 0xffffff, metalness: 0.3, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
  });

  M.steel = new THREE.MeshStandardMaterial({ color: 0x4a4b4c, metalness: 0.92, roughness: 0.44, envMapIntensity: 1.0 });
  M.darkSteel = new THREE.MeshStandardMaterial({ color: 0x44484f, metalness: 0.55, roughness: 0.46, envMapIntensity: 1.25 });
  M.rust = new THREE.MeshStandardMaterial({ color: 0x6d3d1f, metalness: 0.72, roughness: 0.82, envMapIntensity: 0.6 });
  M.copper = new THREE.MeshStandardMaterial({ color: 0xb4693a, metalness: 0.7, roughness: 0.40, envMapIntensity: 1.3, emissive: 0x1a0800, emissiveIntensity: 0.35 });
  M.copperDark = new THREE.MeshStandardMaterial({ color: 0x9a5330, metalness: 0.62, roughness: 0.48, envMapIntensity: 1.15, emissive: 0x200a02, emissiveIntensity: 0.5 });

  M.yellowPipe = new THREE.MeshPhysicalMaterial({
    color: 0xd9a521, metalness: 0.55, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.28, envMapIntensity: 0.95,
  });
  M.yellowTrim = new THREE.MeshStandardMaterial({ color: 0xc9992a, metalness: 0.5, roughness: 0.55 });

  M.glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a1218, metalness: 0.98, roughness: 0.08, envMapIntensity: 1.6,
    clearcoat: 1.0, clearcoatRoughness: 0.04,
  });
  M.glassBlue = new THREE.MeshPhysicalMaterial({
    color: 0x123246, metalness: 0.9, roughness: 0.12, envMapIntensity: 1.4, clearcoat: 1.0,
  });

  M.deck = new THREE.MeshPhysicalMaterial({
    map: deck.map, normalMap: deck.normalMap, roughnessMap: deck.roughnessMap,
    color: 0xffffff, metalness: 0.42, roughness: 0.68, clearcoat: 0.25, clearcoatRoughness: 0.5,
    envMapIntensity: 0.8,
  });

  M.deckVC = new THREE.MeshPhysicalMaterial({
    map: deck.map, normalMap: deck.normalMap, roughnessMap: deck.roughnessMap,
    color: 0xffffff, vertexColors: true, metalness: 0.22, roughness: 0.80, envMapIntensity: 0.42,
    clearcoat: 0.25, clearcoatRoughness: 0.5, envMapIntensity: 0.55,
  });

  M.deckWet = new THREE.MeshPhysicalMaterial({
    map: deck.map, normalMap: deck.normalMap, roughnessMap: deck.roughnessMap,
    color: 0xbfbcb4, metalness: 0.55, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.12,
    envMapIntensity: 1.1,
  });

  M.ground = new THREE.MeshStandardMaterial({
    map: ground.map, normalMap: ground.normalMap, roughnessMap: ground.roughnessMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    color: 0xffffff, metalness: 0.0, roughness: 1.0, envMapIntensity: 0.28,
  });

  M.rock = new THREE.MeshStandardMaterial({
    map: rock.map, normalMap: rock.normalMap, normalScale: new THREE.Vector2(2.3, 2.3),
    color: 0x6f675e, metalness: 0.03, roughness: 0.93, envMapIntensity: 0.20, flatShading: false,
  });

  M.rockVC = new THREE.MeshStandardMaterial({
    map: rock.map, normalMap: rock.normalMap, normalScale: new THREE.Vector2(2.3, 2.3),
    color: 0xffffff, vertexColors: true, metalness: 0.03, roughness: 0.93, envMapIntensity: 0.20,
  });

  M.foliage = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.55, emissive: 0x0a1206, emissiveIntensity: 0.35, flatShading: false,
  });

  M.moss = new THREE.MeshStandardMaterial({
    color: 0x6b7a33, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.2, flatShading: true,
  });

  M.rockDark = new THREE.MeshStandardMaterial({
    map: rock.map, normalMap: rock.normalMap, normalScale: new THREE.Vector2(1.6, 1.6),
    color: 0x9a9086, metalness: 0.03, roughness: 0.95, envMapIntensity: 0.4,
  });

  M.hazard = new THREE.MeshStandardMaterial({ map: hazardTex(), color: 0xffffff, metalness: 0.2, roughness: 0.85 });
  M.paint = new THREE.MeshStandardMaterial({ color: 0xb9a05c, metalness: 0.1, roughness: 0.9 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.05, roughness: 0.95 });

  M.teal = new THREE.MeshPhysicalMaterial({ color: 0x2f6f74, metalness: 0.35, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  M.red = new THREE.MeshPhysicalMaterial({ color: 0x9c2a20, metalness: 0.3, roughness: 0.5, clearcoat: 0.4 });
  M.orange = new THREE.MeshPhysicalMaterial({ color: 0xb8561f, metalness: 0.35, roughness: 0.45, clearcoat: 0.45 });
  M.cream = new THREE.MeshPhysicalMaterial({ color: 0xc8bda6, metalness: 0.2, roughness: 0.6 });

  M.logo = new THREE.MeshStandardMaterial({
    map: hLogoTex(), transparent: true, alphaTest: 0.35, metalness: 0.1, roughness: 0.7,
    color: 0xffffff, side: THREE.DoubleSide, depthWrite: false,
  });

  M.emitBlue = new THREE.MeshBasicMaterial({ color: 0x63c8ff, toneMapped: true });
  M.emitOrange = new THREE.MeshBasicMaterial({ color: 0xff7a26, toneMapped: true });
  M.emitWhite = new THREE.MeshBasicMaterial({ color: 0xfff0d8, toneMapped: true });
  M.emitRed = new THREE.MeshBasicMaterial({ color: 0xff2a18, toneMapped: true });

  M.text = (str, color) => new THREE.MeshStandardMaterial({
    map: textTex(str, { color: color || '#2b3136' }), transparent: true, alphaTest: 0.28,
    metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide, depthWrite: false,
  });

  return M;
}
