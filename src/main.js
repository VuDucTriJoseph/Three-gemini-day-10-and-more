import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const canvas = document.querySelector("#app");
const scene = new THREE.Scene();
const intersectableObjects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100,
);
camera.position.set(2, 3, 4);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x111111);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Create loading manager
const loadingOverlay = document.querySelector("#loading-overlay");
const loadingManager = new THREE.LoadingManager();
loadingManager.onStart = () => {
  console.log("Loading started");
  if (loadingOverlay) loadingOverlay.style.display = "flex";
};
loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  console.log(`Loading: ${itemsLoaded}/${itemsTotal}`);
};
loadingManager.onLoad = () => {
  console.log("Loading complete");
  if (loadingOverlay) loadingOverlay.style.display = "none";
};
loadingManager.onError = (url) => {
  console.error(`Error loading: ${url}`);
  if (loadingOverlay) loadingOverlay.style.display = "none";
};

// Load HDR environment map
const rgbeLoader = new RGBELoader(loadingManager);
rgbeLoader.load("/christmas_photo_studio_04_1k.hdr", (texture) => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  pmremGenerator.dispose();

  scene.environment = envMap;
});

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// GLTF Loader
const gltfLoader = new GLTFLoader(loadingManager);

// load and traverse

gltfLoader.load("/lubricant_spray_1k.gltf/lubricant_spray_1k.gltf", (gltf) => {
  const model = gltf.scene;

  //scan all parts of model
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      // intersectableObjects.push(child);
      // console.log("Finded part: ", child.name, "- Type:", child.type);
    }
  });

  // create a proxy as children of model , proxy is the present of model on intersectableObject. it will help the raycaster use less memory
  // 1. caculte size and position of proxy
  const bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());

  const nozzleLocalPos = new THREE.Vector3(
    center.x,
    bbox.max.y - size.y * 0.05,
    bbox.max.z - size.z * 0.05,
  );

  const nozzleAnchor = new THREE.Object3D();
  nozzleAnchor.position.copy(nozzleLocalPos);
  model.add(nozzleAnchor);

  model.userData.nozzle = nozzleAnchor;

  // const debugNozzleMesh = new THREE.Mesh(
  //   new THREE.SphereGeometry(0.02, 8, 8),
  //   new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  // );

  // nozzleAnchor.add(debugNozzleMesh);

  //2. create proxy mesh
  const proxyGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
  // console.log(proxyGeo);
  const proxyMat = new THREE.MeshBasicMaterial({
    wireframe: true,
    visible: false,
  });
  // console.log(proxyMat);

  const proxy = new THREE.Mesh(proxyGeo, proxyMat);

  //3. IMPORTANT : Get proxy as a child of model
  // change position of proxy to position of model
  proxy.position.copy(model.worldToLocal(center));

  model.add(proxy);

  model.scale.set(10, 10, 10);
  model.position.y = 0.1;
  scene.add(model);

  // 4. add info to ident on Raycaster
  proxy.userData.isProxy = true;
  proxy.userData.parentModel = model;

  // 5. push proxy into intersectableObject list
  intersectableObjects.push(proxy);

  console.log("present guy is ready");
});

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x44aaff });
const cube = new THREE.Mesh(geometry, material);
cube.position.y = 0.6;
cube.position.x = 3;
cube.castShadow = true;
scene.add(cube);
intersectableObjects.push(cube);

const planeGeometry = new THREE.PlaneGeometry(10, 10);
const planeMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222,
  side: THREE.DoubleSide,
});
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = 0;
plane.receiveShadow = true;
scene.add(plane);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1, 20, 2);
pointLight.position.set(4, 4, 4);
pointLight.castShadow = true;
pointLight.shadow.mapSize.set(1024, 1024);
pointLight.shadow.radius = 3;
scene.add(pointLight);

const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.2, 0xff0000);
scene.add(pointLightHelper);

// Create GUI
const gui = new GUI();
// Cube controls
const cubeFolder = gui.addFolder("Cube");
cubeFolder.add(cube.position, "x", -10, 10, 0.1);
cubeFolder.add(cube.position, "y", -10, 10, 0.1);
cubeFolder.add(cube.position, "z", -10, 10, 0.1);
cubeFolder.add(cube.rotation, "x", 0, Math.PI * 2, 0.01);
cubeFolder.add(cube.rotation, "y", 0, Math.PI * 2, 0.01);
cubeFolder.add(cube.rotation, "z", 0, Math.PI * 2, 0.01);

// PointLight controls
const lightFolder = gui.addFolder("PointLight");
lightFolder.add(pointLight.position, "x", -10, 10, 0.1);
lightFolder.add(pointLight.position, "y", -10, 10, 0.1);
lightFolder.add(pointLight.position, "z", -10, 10, 0.1);
lightFolder.add(pointLight, "intensity", 0, 3, 0.1);
lightFolder
  .addColor({ color: pointLight.color.getHex() }, "color")
  .onChange((value) => {
    pointLight.color.setHex(value);
  });

intersectableObjects.forEach((obj) => {
  obj.userData.isHovered = false;
});

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

window.addEventListener("pointermove", (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// cau hinh so luong hat
const particleCount = 200;
const particleGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const velocities = [];

//Khoi tao vi tri ban dau mac dinh(bang 0 het) va tao luc day ngau nhien
for (let i; i < particleCount; i++) {
  positions[i * 3] = 0;
  positions[i * 3 + 1] = 0;
  positions[i * 3 + 2] = 0;

  // tao huong bay ngau nhien
  velocities.push(
    new THREE.Vector3(
      0.5 + Math.random() * 1,
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.3,
    ),
  );
}

particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3),
);

const particleMaterial = new THREE.PointsMaterial({
  color: 0xcccccc,
  size: 0.05,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particleSystem);

let isSpraying = false;
let sprayTimer = 0;

window.addEventListener("click", () => {
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(intersectableObjects);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;

    console.log(clickedObject);

    if (clickedObject.userData.isProxy) {
      pointLight.color.set("#f43535");

      isSpraying = true;
      sprayTimer = 0;

      particleMaterial.opacity = 0.8;

      const positionAttribute = particleGeometry.attributes.position;

      for (let i; i < particleCount; i++) {
        positionAttribute.setXYZ(
          i,
          model.position.x,
          model.position.y + 0.8,
          model.position.z,
        );
      }
      positionAttribute.needsUpdate = true;
    }
  }
});

const animate = () => {
  raycaster.setFromCamera(pointer, camera);

  intersectableObjects.forEach((obj) => {
    obj.userData.isHovered = false;
  });
  const intersects = raycaster.intersectObjects(intersectableObjects);

  if (intersects.length > 0) {
    // Example: log the first hit object
    // console.log("Ray hit:", intersects[0].object);
    const hit = intersects[0].object;
    hit.userData.isHovered = true;

    const parent = hit.userData.parentModel ? hit.userData.parentModel : hit;
    parent.rotation.y += 0.05;
  }

  intersectableObjects.forEach((obj) => {
    const realObj = obj.userData.parentModel ? obj.userData.parentModel : obj;
    if (!obj.userData.isHovered) {
      realObj.rotation.y += (0 - realObj.rotation.y) * 0.1;
    }
  });

  if (isSpraying) {
    const positionAttribute = particleGeometry.attributes.position;
    sprayTimer += 0.016;

    for (let i = 0; i < particleCount; i++) {
      let x = positionAttribute.getX(i);
      let y = positionAttribute.getY(i);
      let z = positionAttribute.getZ(i);

      x += velocities[i].x * 0.1;
      y += velocities[i].y * 0.1;
      z += velocities[i].z * 0.1;

      positionAttribute.setXYZ(i, x, y, z);
    }
    positionAttribute.needsUpdate = true;

    particleMaterial.opacity -= 0.015;
    if (particleMaterial.opacity <= 0) {
      isSpraying = false;
    }
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();
