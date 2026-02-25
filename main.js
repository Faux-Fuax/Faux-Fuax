import * as THREE from "three";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import TWEEN from "@tweenjs/tween.js";

const sfx = { hover: new Audio('assets/audio/hover.mp3'), open: new Audio('assets/audio/open.mp3'), close: new Audio('assets/audio/close.mp3') };
let neuralLinkEstablished = false;

// --- 1. DYNAMIC CAMERA SETTINGS ---
const isMobile = window.innerWidth < window.innerHeight;
const initialCameraPos = { x: 0, y: 0, z: isMobile ? 18 : 10 }; // Pushes camera back on mobile

// --- 2. NSA HUD LOGIC ---
function startNsaHUD() {
    const columns = document.querySelectorAll('.matrix-col');
    const geo = document.getElementById('location-data');
    const fuaxChars = ["F", "U", "A", "X", "1", "0", "$", "#", "!", "█"];

    columns.forEach((col) => {
        const direction = col.getAttribute('data-dir');
        const speed = 40 + (Math.random() * 120);
        setInterval(() => {
            let stream = "";
            for (let i = 0; i < 70; i++) {
                const char = Math.random() > 0.92 ? fuaxChars[Math.floor(Math.random() * fuaxChars.length)] : Math.round(Math.random());
                stream += char + "\n";
            }
            col.innerText = stream;
            const drift = direction === "up" ? -1 : 1;
            col.style.transform = `translateY(${Math.sin(Date.now() * 0.001) * (10 * drift)}px)`;
        }, speed);
    });

    const sectors = ["SITE-6", "NEO-TOKYO", "BERLIN-VOID", "ORBITAL-STATION", "DEEP-NET"];
    setInterval(() => {
        const sector = sectors[Math.floor(Math.random() * sectors.length)];
        const lat = (Math.random() * 180 - 90).toFixed(4);
        const lon = (Math.random() * 360 - 180).toFixed(4);
        if (geo) geo.innerText = `SCANNING ${sector}: [ ${lat}°, ${lon}° ]`;
    }, 1200);
}
startNsaHUD();

// --- 3. THREE.JS ENGINE ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.05);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(initialCameraPos.x, initialCameraPos.y, initialCameraPos.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.3, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function createTextLabel(text, color, isTier2 = false) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512; canvas.height = 128;
    context.font = 'Bold 70px Rajdhani';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeStyle = 'black';
    context.lineWidth = 10;
    context.strokeText(text.toUpperCase(), 256, 64);
    context.fillStyle = color;
    context.fillText(text.toUpperCase(), 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(isTier2 ? 2.5 : 3.5, isTier2 ? 0.6 : 0.8, 1);
    return sprite;
}

const cubeData = [
    { id: 0, name: "Shop", theme: 0xff8800, pos: isMobile ? [-2, 4, 0] : [-4, 2, 0], links: [{t:"Prints", u:"#"}, {t:"1980HD Pack", u:"#"}] },
    { id: 1, name: "Music", theme: 0xff00ff, pos: isMobile ? [2, 4, 0] : [0, 2, 0], links: [{t:"SoundCloud", u:"#"}] },
    { id: 2, name: "Dev", theme: 0x00ff00, pos: isMobile ? [-2, 0, 0] : [4, 2, 0], links: [{t:"Paradigm", u:"https://perculiar-pardigm.vercel.app/"}, {t:"RetroCam", u:"https://retro-camera-rust.vercel.app"}] },
    { id: 3, name: "NFTs", theme: 0x00eaff, pos: isMobile ? [2, 0, 0] : [-4, -2, 0], links: [{t:"CyberPugz", u:"#"}] },
    { id: 4, name: "About", theme: 0xffffff, pos: isMobile ? [-2, -4, 0] : [0, -2, 0], links: [] },
    { id: 5, name: "Log", theme: 0xeaff00, pos: isMobile ? [2, -4, 0] : [4, -2, 0], links: [{t:"Blogger", u:"#"}] }
];

const cubes = [];
const childCubes = [];
const boxGeo = new THREE.BoxGeometry(2, 2, 2);
const childGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);

cubeData.forEach(data => {
    const cube = new THREE.Mesh(boxGeo, new THREE.MeshPhysicalMaterial({ color: 0x000000, transmission: 0.9, transparent: true, opacity: 0.5 }));
    cube.position.set(...data.pos);
    cube.userData = data;
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: 0x00fff7 }));
    cube.add(line); 
    const label = createTextLabel(data.name, '#00fff7');
    label.material.opacity = 0; label.name = "hoverLabel";
    cube.add(label);
    scene.add(cube);
    cubes.push(cube);
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null, active = null;

document.getElementById('neural-link-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('neural-overlay').classList.add('hidden');
    setTimeout(() => { neuralLinkEstablished = true; }, 200);
    sfx.open.play().catch(() => {});
});

window.addEventListener('pointermove', e => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Touch support for mobile
window.addEventListener('touchstart', e => {
    pointer.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
}, {passive: false});

window.addEventListener('click', () => {
    if (!neuralLinkEstablished) return;
    raycaster.setFromCamera(pointer, camera);
    const childHits = raycaster.intersectObjects(childCubes, true);
    if (childHits.length > 0) {
        let target = childHits[0].object;
        while(!target.userData.url && target.parent) target = target.parent;
        if(target.userData.url && target.userData.url !== "#") window.open(target.userData.url, '_blank');
        return;
    }
    const hits = raycaster.intersectObjects(cubes, true);
    if (hits.length > 0 && !active) {
        let obj = hits[0].object;
        while (obj.type !== "Mesh" && obj.parent) obj = obj.parent;
        if (obj.userData.name === "About") { showDossier(); return; }
        active = obj;
        sfx.open.play().catch(() => {});
        new TWEEN.Tween(camera.position).to({ x: active.position.x, y: active.position.y, z: 5 }, 800).easing(TWEEN.Easing.Cubic.Out).start();
        document.getElementById('return-btn').style.display = "block";
    }
});

function showDossier() {
    const container = document.getElementById('dossier-container');
    const textField = document.getElementById('dossier-text');
    container.style.display = 'block';
    const bio = `> DECRYPTING PERSONNEL HISTORY...\n> SUBJECT: REMINGTON BRANINBURG\n\nWhile experiencing homelessness, I weaponized my time. I taught myself HTML5, CSS, and JS to build this interface.\n\nFUAX represents the transition from metallurgy to the digital frontier. Now mastering LLM dev, Web3, and game design.\n\n> STATUS: FOREVER UNFINISHED.`;
    let i = 0; textField.innerHTML = "";
    const typing = setInterval(() => {
        if (i < bio.length) { textField.innerHTML += bio.charAt(i) === "\n" ? "<br>" : bio.charAt(i); i++; }
        else { clearInterval(typing); }
    }, 25);
}

document.getElementById('close-dossier').addEventListener('click', () => { document.getElementById('dossier-container').style.display = 'none'; });

function spawnChildren(parent) {
    parent.userData.links.forEach((link, i) => {
        const angle = (i / parent.userData.links.length) * Math.PI * 2;
        const child = new THREE.Mesh(childGeo, new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.8 }));
        child.position.set(parent.position.x + Math.cos(angle) * 2.5, parent.position.y + Math.sin(angle) * 2.5, parent.position.z);
        child.add(new THREE.LineSegments(new THREE.EdgesGeometry(childGeo), new THREE.LineBasicMaterial({ color: parent.userData.theme })));
        const label = createTextLabel(link.t, `#${parent.userData.theme.toString(16).padStart(6, '0')}`, true);
        label.position.set(0, 1.2, 0); child.add(label);
        child.userData = { url: link.u }; scene.add(child); childCubes.push(child);
    });
}

document.getElementById('return-btn').addEventListener('click', (e) => {
    e.stopPropagation(); 
    sfx.close.play().catch(() => {});
    childCubes.forEach(c => scene.remove(c)); 
    childCubes.length = 0;
    
    TWEEN.removeAll(); // Clear active tweens
    new TWEEN.Tween(camera.position)
        .to({ x: initialCameraPos.x, y: initialCameraPos.y, z: initialCameraPos.z }, 800)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onComplete(() => { active = null; })
        .start();
        
    document.getElementById('return-btn').style.display = "none";
});

function animate(time) {
    requestAnimationFrame(animate); 
    TWEEN.update(time);
    if (neuralLinkEstablished) {
        cubes.forEach(c => { c.rotation.x += 0.005; c.rotation.y += 0.005; });
        childCubes.forEach(cc => { cc.rotation.x += 0.01; cc.rotation.y += 0.01; });
        if (!active) {
            camera.lookAt(0,0,0);
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(cubes, true);
            if (hits.length > 0) {
                let obj = hits[0].object; while (obj.type !== "Mesh" && obj.parent) obj = obj.parent;
                if (hovered !== obj) {
                    if (hovered) { const oldLine = hovered.children.find(c => c.type === "LineSegments"); if (oldLine) oldLine.material.color.setHex(0x00fff7); hovered.getObjectByName("hoverLabel").material.opacity = 0; }
                    hovered = obj; sfx.hover.play().catch(() => {});
                    const lbl = hovered.getObjectByName("hoverLabel"); lbl.material.opacity = 1; lbl.material.color.setHex(hovered.userData.theme);
                }
                const currentLine = hovered.children.find(c => c.type === "LineSegments");
                if (currentLine) currentLine.material.color.setHex(Math.random() > 0.85 ? 0x008888 : hovered.userData.theme);
                document.getElementById('instructions').innerText = `[ ${hovered.userData.name.toUpperCase()} ]`;
            } else if (hovered) {
                const oldLine = hovered.children.find(c => c.type === "LineSegments"); if (oldLine) oldLine.material.color.setHex(0x00fff7);
                hovered.getObjectByName("hoverLabel").material.opacity = 0; hovered = null;
                document.getElementById('instructions').innerText = `[ CLICK A CUBE TO INTERFACE ]`;
            }
        } else { 
            camera.lookAt(active.position); 
        }
    }
    composer.render();
}
animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
