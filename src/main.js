import './style.css';
import { 
    Engine, Scene, Vector3, HemisphericLight, DirectionalLight, MeshBuilder, UniversalCamera, 
    PBRMaterial, Color3, ActionManager, ExecuteCodeAction, Animation, 
    CubicEase, EasingFunction, ShadowGenerator, DefaultRenderingPipeline, SceneLoader, PointerEventTypes,
    CubeTexture, SSAO2RenderingPipeline, GizmoManager
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true);

// UI Elements
const uiOverlay = document.getElementById('uiOverlay');
const closeBtn = document.getElementById('closeBtn');
const productBrand = document.getElementById('productBrand');
const productName = document.getElementById('productName');
const productDesc = document.getElementById('productDesc');
const productPrice = document.getElementById('productPrice');

// Editor UI
const editorToggleBtn = document.getElementById('editorToggleBtn');
const editorControls = document.getElementById('editorControls');
const buildModeHint = document.getElementById('buildModeHint');
const addProductBtn = document.getElementById('addProductBtn');
const paintModeBtn = document.getElementById('paintModeBtn');

// Assign UI
const assignFormOverlay = document.getElementById('assignFormOverlay');
const newBrandInput = document.getElementById('newBrand');
const newNameInput = document.getElementById('newName');
const newPriceInput = document.getElementById('newPrice');
const newDescInput = document.getElementById('newDesc');
const saveBoxBtn = document.getElementById('saveBoxBtn');
const cancelBoxBtn = document.getElementById('cancelBoxBtn');
const deleteBoxBtn = document.getElementById('deleteBoxBtn');

// Color Editor UI
const colorEditorOverlay = document.getElementById('colorEditorOverlay');
const colorEditorTargetName = document.getElementById('colorEditorTargetName');
const meshColorInput = document.getElementById('meshColorInput');
const saveColorBtn = document.getElementById('saveColorBtn');
const cancelColorBtn = document.getElementById('cancelColorBtn');
const resetColorBtn = document.getElementById('resetColorBtn');

// State
let isEditorMode = false;
let isPaintMode = false;
let currentPlacementType = null; 
let ghostMesh = null;
let activeProduct = null;
let activeEntityId = null; 
let activeColorMesh = null;
let originalColorHex = null;
let camera = null;
let scene = null;
let shadowGenerator = null;
let pipeline = null;
let gizmoManager = null;

let originalPosition = null;
let originalRotation = null;
let entityIdCounter = 1;

// Entities Array for memory
let entities = []; 

// --- IndexedDB Setup ---
const DB_NAME = "UzunCarsiDB_v3";
const STORE_NAME = "entities";
const COLOR_STORE = "sceneColors";

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(COLOR_STORE)) {
                db.createObjectStore(COLOR_STORE, { keyPath: "meshId" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveEntityToDB = async (entityData) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entityData);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
};

const deleteEntityFromDB = async (id) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
};

const loadEntitiesFromDB = async () => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
    });
};

const saveColorToDB = async (meshId, hexColor) => {
    const db = await initDB();
    const tx = db.transaction(COLOR_STORE, "readwrite");
    tx.objectStore(COLOR_STORE).put({ meshId, hexColor });
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
};

const loadColorsFromDB = async () => {
    const db = await initDB();
    const tx = db.transaction(COLOR_STORE, "readonly");
    const store = tx.objectStore(COLOR_STORE);
    const request = store.getAll();
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
    });
};

// --- Scene Setup ---
const createScene = async () => {
    scene = new Scene(engine);
    scene.clearColor = new Color3(0.05, 0.05, 0.06);
    scene.collisionsEnabled = true;
    scene.gravity = new Vector3(0, -0.9, 0); 
    
    // Yansimalar (IBL)
    const envTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.env", scene);
    scene.environmentTexture = envTexture;
    
    camera = new UniversalCamera('vrCamera', new Vector3(0, 5, -4), scene);
    camera.setTarget(new Vector3(0, 1.7, 0));
    camera.attachControl(canvas, true);

    // Default: flying enabled for testing
    camera.applyGravity = false;
    camera.checkCollisions = false;
    camera.ellipsoid = new Vector3(0.5, 1.7, 0.5); 
    camera.keysUp.push(87);
    camera.keysDown.push(83);
    camera.keysLeft.push(65);
    camera.keysRight.push(68);
    camera.speed = 0.15;
    camera.inertia = 0.8;
    camera.minZ = 0.1;

    // Lighting
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.2; 
    ambientLight.groundColor = new Color3(0.05, 0.05, 0.05);

    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -0.5, -1), scene);
    dirLight.position = new Vector3(20, 10, 20);
    dirLight.intensity = 1.7; 
    dirLight.diffuse = new Color3(1.0, 0.6, 0.3); 
    
    shadowGenerator = new ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 16; 

    pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    pipeline.samples = 1; 
    pipeline.fxaaEnabled = true; 
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.95; 
    pipeline.bloomWeight = 0.15; 
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = 1; 
    pipeline.imageProcessing.exposure = 0.8; 
    pipeline.imageProcessing.contrast = 1.1;
    pipeline.depthOfFieldEnabled = false; 

    // Remove SSAO for massive FPS boost on heavy scenes
    // const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    
    // Add IBL (HDRI Environment) for PBR materials
    scene.createDefaultEnvironment({ createSkybox: false, createGround: false });

    // GizmoManager Init
    gizmoManager = new GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.usePointerToAttach = false;
    gizmoManager.clearGizmoOnEmptyPointerEvent = false;

    // Load Main Scene
    engine.displayLoadingUI();
    try {
        await SceneLoader.AppendAsync("/models/", "binaaktıf2.glb", scene);
        const savedColors = await loadColorsFromDB();
        
        scene.meshes.forEach(mesh => {
            mesh.checkCollisions = true;
            mesh.receiveShadows = true;
            
            // FREEZE STATIC MESHES FOR MASSIVE FPS GAIN
            if (mesh.name !== "ghost" && mesh.name !== "skyBox" && !mesh.name.startsWith("ent_")) {
                mesh.doNotSyncBoundingInfo = true;
                mesh.freezeWorldMatrix();
            }
            
            if (savedColors) {
                const colorData = savedColors.find(c => c.meshId === mesh.name);
                if (colorData && mesh.material) {
                    if (mesh.material.albedoColor) {
                        mesh.material.albedoColor = Color3.FromHexString(colorData.hexColor);
                    }
                }
            }
        });
    } catch (err) {
        console.error("Ana sahne yuklenirken hata:", err);
    }
    engine.hideLoadingUI();

    // Load Entities
    try {
        entities = await loadEntitiesFromDB();
        if (entities && entities.length > 0) {
            let maxId = 0;
            for (const ent of entities) {
                const numericId = parseInt(ent.id.replace('ent_', ''));
                if (numericId > maxId) maxId = numericId;
                
                await instantiateEntity(ent);
            }
            entityIdCounter = maxId + 1;
        }
    } catch(e) {
        console.error("Failed to load entities from DB:", e);
    }

    // Pointer Events for Placement and Editing
    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
            if (isEditorMode && ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.checkCollisions && mesh.name !== 'ghost');
                if (pickResult.hit) {
                    ghostMesh.position = pickResult.pickedPoint.clone();
                }
            }
        }
        else if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.event.button !== 0) return; 

            // Paint mode click
            if (isEditorMode && isPaintMode) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit && pickResult.pickedMesh) {
                    if (pickResult.pickedMesh.name !== 'ghost') {
                        openColorEditor(pickResult.pickedMesh);
                    }
                }
                return;
            }

            // Placing a new item
            if (isEditorMode && ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.checkCollisions && mesh.name !== 'ghost');
                if (pickResult.hit) {
                    createNewEntity(currentPlacementType, pickResult.pickedPoint.clone());
                    cancelPlacement();
                }
            } 
            // Clicking an existing product in Editor Mode (Left Click)
            else if (isEditorMode && !ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit && pickResult.pickedMesh) {
                    if (pickResult.pickedMesh.name.toLowerCase().includes("gizmo")) {
                        return; // Let GizmoManager handle this
                    }
                    if (pickResult.pickedMesh.metadata && pickResult.pickedMesh.metadata.isProduct) {
                        gizmoManager.attachToMesh(pickResult.pickedMesh);
                        openAssignForm(pickResult.pickedMesh.metadata.entityId);
                    } else {
                        gizmoManager.attachToMesh(null);
                        closeAssignForm();
                    }
                } else {
                    gizmoManager.attachToMesh(null);
                    closeAssignForm();
                }
            }
        }
        else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
            if (isEditorMode && gizmoManager && gizmoManager.attachedMesh) {
                const mesh = gizmoManager.attachedMesh;
                if (mesh.metadata && mesh.metadata.entityId) {
                    const ent = entities.find(e => e.id === mesh.metadata.entityId);
                    if (ent) {
                        ent.x = mesh.position.x;
                        ent.y = mesh.position.y - 0.4; // offset from rootBox
                        ent.z = mesh.position.z;
                        if (mesh.rotationQuaternion) {
                            ent.rotY = mesh.rotationQuaternion.toEulerAngles().y;
                        } else {
                            ent.rotY = mesh.rotation.y;
                        }
                        saveEntityToDB(ent);
                    }
                }
            }
        }
        else if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 2) {
            // Right click for Color Picker in Editor Mode (Backup)
            if (isEditorMode && !ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit && pickResult.pickedMesh) {
                    // Ignore UI or ghost meshes
                    if (pickResult.pickedMesh.name !== 'ghost') {
                        openColorEditor(pickResult.pickedMesh);
                    }
                }
            }
        }
    });

    // Disable context menu so right click works smoothly
    window.addEventListener('contextmenu', (e) => {
        if (isEditorMode) e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (ghostMesh) cancelPlacement();
            else if (!assignFormOverlay.classList.contains('hidden')) closeAssignForm();
            else if (!uiOverlay.classList.contains('hidden')) closeProductView();
        }
    });

    return scene;
};

// --- Entity Instantiation & Layout Algorithms ---
const instantiateEntity = async (ent) => {
    if (ent.type === 'product') {
        const rootBox = MeshBuilder.CreateBox(ent.id, { width: 0.6, height: 0.8, depth: 0.6 }, scene);
        rootBox.position = new Vector3(ent.x, ent.y + 0.4, ent.z);
        if (ent.rotY) {
            rootBox.rotation = new Vector3(0, ent.rotY, 0);
        }
        rootBox.visibility = 0;
        rootBox.isPickable = true;
        
        try {
            const result = await SceneLoader.ImportMeshAsync("", "/products/", "valiz.glb", scene);
            const prodModel = result.meshes[0];
            prodModel.setParent(rootBox);
            prodModel.position = Vector3.Zero();
            prodModel.scaling = new Vector3(0.8, 0.8, 0.8);
            result.meshes.forEach(m => {
                m.isPickable = false;
                shadowGenerator.getShadowMap().renderList.push(m);
            });
        } catch (e) {
            console.warn("Valiz modeli bulunamadi.");
            const fallback = MeshBuilder.CreateBox(ent.id + "_fallback", { width: 0.6, height: 0.8, depth: 0.6 }, scene);
            fallback.setParent(rootBox);
            fallback.position = Vector3.Zero();
            const mat = new PBRMaterial(ent.id + "_mat", scene);
            mat.albedoColor = new Color3(Math.random(), Math.random(), Math.random());
            fallback.material = mat;
        }
        
        rootBox.metadata = { 
            isProduct: true,
            entityId: ent.id,
            brand: ent.brand, 
            name: ent.name, 
            desc: ent.desc, 
            price: ent.price 
        };
        
        rootBox.actionManager = new ActionManager(scene);
        
        rootBox.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
            if(!activeProduct && !isEditorMode) {
                document.getElementById('renderCanvas').style.cursor = 'pointer';
                rootBox.getChildMeshes().forEach(child => {
                    if(child.material) {
                        if(!child.material.emissiveColor) child.material.emissiveColor = new Color3(0,0,0);
                        child.material.emissiveColor = new Color3(0.2, 0.2, 0.2); 
                    }
                });
            }
        }));
        
        rootBox.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
            document.getElementById('renderCanvas').style.cursor = 'default';
            rootBox.getChildMeshes().forEach(child => {
                if(child.material && child.material.emissiveColor) {
                    child.material.emissiveColor = new Color3(0, 0, 0); 
                }
            });
        }));
        
        rootBox.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
            if(!activeProduct && !isEditorMode) {
                openProductView(rootBox);
            }
        }));
    }
};

// (Removed createInteractiveProduct since instantiateEntity handles it now)

// --- Entities & Logic ---
const createNewEntity = (type, position) => {
    const newEntity = {
        id: "ent_" + Date.now(),
        type: type,
        x: position.x,
        y: position.y,
        z: position.z,
        rotY: 0,
        brand: "Marka",
        name: "Ürün Adı",
        desc: "Açıklama",
        price: "0 TL"
    };
    entities.push(newEntity);
    saveEntityToDB(newEntity).then(() => {
        instantiateEntity(newEntity);
        openAssignForm(newEntity.id);
    });
};

// --- Editor Mode UI ---
editorToggleBtn.addEventListener('click', () => {
    isEditorMode = !isEditorMode;

    if (isEditorMode) {
        editorToggleBtn.innerText = "Editörden Çık";
        editorToggleBtn.style.background = "#ff5555";
        editorControls.classList.remove('hidden');
    } else {
        editorToggleBtn.innerText = "Editör Modu";
        editorToggleBtn.style.background = "";
        editorControls.classList.add('hidden');
        cancelPlacement();
        if (gizmoManager) gizmoManager.attachToMesh(null);
        
        if (isPaintMode) {
            isPaintMode = false;
            paintModeBtn.style.background = "";
            paintModeBtn.innerText = "Boya (Renk Değiştir)";
        }
    }
});

paintModeBtn.addEventListener('click', () => {
    isPaintMode = !isPaintMode;
    if (isPaintMode) {
        paintModeBtn.style.background = "#ff5555";
        paintModeBtn.innerText = "Boya Modu (Aktif)";
        cancelPlacement(); // clear ghost if any
    } else {
        paintModeBtn.style.background = "";
        paintModeBtn.innerText = "Boya (Renk Değiştir)";
    }
});

const startPlacement = (type) => {
    cancelPlacement();
    currentPlacementType = type;
    buildModeHint.classList.remove('hidden');
    
    // Ghost mesh
    if (type === 'deco') ghostMesh = MeshBuilder.CreateBox('ghost', {width: 0.6, height: 0.8, depth: 0.6}, scene);
    else ghostMesh = MeshBuilder.CreateBox('ghost', {width: 2, height: 1, depth: 1}, scene);
    
    const ghostMat = new PBRMaterial('ghostMat', scene);
    ghostMat.albedoColor = new Color3(0.2, 0.8, 0.2);
    ghostMat.alpha = 0.5;
    ghostMat.emissiveColor = new Color3(0.1, 0.4, 0.1);
    ghostMesh.material = ghostMat;
    ghostMesh.isPickable = false;
};

const cancelPlacement = () => {
    currentPlacementType = null;
    buildModeHint.classList.add('hidden');
    if (ghostMesh) {
        ghostMesh.dispose();
        ghostMesh = null;
    }
};

addProductBtn.addEventListener('click', () => startPlacement('product'));

// --- Assign Products UI ---
const openAssignForm = (entityId) => {
    activeEntityId = entityId;
    const ent = entities.find(e => e.id === entityId);
    if (!ent) return;
    
    newBrandInput.value = ent.brand || "";
    newNameInput.value = ent.name || "";
    newPriceInput.value = ent.price || "";
    newDescInput.value = ent.desc || "";
    
    assignFormOverlay.classList.remove('hidden');
    camera.detachControl();
};

const closeAssignForm = () => {
    assignFormOverlay.classList.add('hidden');
    activeEntityId = null;
    camera.attachControl(canvas, true);
};

saveBoxBtn.addEventListener('click', async () => {
    if (!activeEntityId) return;
    
    const ent = entities.find(e => e.id === activeEntityId);
    if (ent) {
        ent.brand = newBrandInput.value;
        ent.name = newNameInput.value;
        ent.price = newPriceInput.value;
        ent.desc = newDescInput.value;
        
        await saveEntityToDB(ent);
        
        const oldMesh = scene.getMeshByName(ent.id);
        if(oldMesh) {
            oldMesh.metadata.brand = ent.brand;
            oldMesh.metadata.name = ent.name;
            oldMesh.metadata.price = ent.price;
            oldMesh.metadata.desc = ent.desc;
        }
    }
    
    closeAssignForm();
});

cancelBoxBtn.addEventListener('click', closeAssignForm);

deleteBoxBtn.addEventListener('click', async () => {
    if (activeEntityId) {
        await deleteEntityFromDB(activeEntityId);
        entities = entities.filter(e => e.id !== activeEntityId);
        const mesh = scene.getMeshByName(activeEntityId);
        if (mesh) mesh.dispose();
    }
    closeAssignForm();
});

// --- Product Inspection Logic (Animation) ---
const animateValue = (target, property, startValue, endValue, onEnd) => {
    const frameRate = 60;
    const anim = new Animation("anim", property, frameRate, 
        typeof startValue === "number" ? Animation.ANIMATIONTYPE_FLOAT : Animation.ANIMATIONTYPE_VECTOR3, 
        Animation.ANIMATIONLOOPMODE_CONSTANT);
        
    anim.setKeys([ { frame: 0, value: startValue }, { frame: frameRate, value: endValue } ]);
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    anim.setEasingFunction(easing);
    
    target.animations = [anim];
    scene.beginAnimation(target, 0, frameRate, false, 1.0, onEnd);
};

let idleRotationObserver = null;

const openProductView = (mesh) => {
    activeProduct = mesh;
    // Get absolute position instead of local because it's parented now
    originalPosition = mesh.getAbsolutePosition().clone();
    originalRotation = mesh.rotationQuaternion ? mesh.rotationQuaternion.toEulerAngles() : mesh.rotation.clone();
    
    // Detach parent for inspection
    mesh.setParent(null);
    mesh.position = originalPosition.clone();
    mesh.rotation = originalRotation.clone();

    camera.detachControl();
    document.getElementById('renderCanvas').style.cursor = 'default';
    
    const cameraForward = camera.getDirection(Vector3.Forward());
    const cameraRight = camera.getDirection(Vector3.Right());
    const targetPos = camera.position.add(cameraForward.scale(1.2)).subtract(cameraRight.scale(0.35));
    targetPos.y -= 0.05;
    
    productBrand.innerText = mesh.metadata.brand;
    productName.innerText = mesh.metadata.name;
    productDesc.innerText = mesh.metadata.desc;
    productPrice.innerText = mesh.metadata.price;
    
    pipeline.depthOfFieldEnabled = true;
    
    animateValue(mesh, "position", mesh.position, targetPos);
    animateValue(mesh, "rotation", mesh.rotation, new Vector3(0, camera.rotation.y, 0), () => {
        uiOverlay.classList.remove('hidden');
        uiOverlay.classList.add('active');
        idleRotationObserver = scene.onBeforeRenderObservable.add(() => activeProduct.rotation.y += 0.01);
    });
};

const closeProductView = () => {
    if (!activeProduct) return;
    uiOverlay.classList.remove('active');
    
    setTimeout(() => {
        uiOverlay.classList.add('hidden');
        if(idleRotationObserver) {
            scene.onBeforeRenderObservable.remove(idleRotationObserver);
            idleRotationObserver = null;
        }
        pipeline.depthOfFieldEnabled = false;
        
        animateValue(activeProduct, "position", activeProduct.position, originalPosition);
        animateValue(activeProduct, "rotation", activeProduct.rotation, originalRotation, () => {
            // Re-parent is tricky, but we can just snap it back by disposing and refreshing or keeping absolute
            // Let's just leave it unparented in exactly the same spot
            activeProduct.getChildMeshes().forEach(child => {
                if (child.material) child.material.emissiveColor = new Color3(0,0,0);
            });
            activeProduct = null;
            camera.attachControl(canvas, true);
        });
    }, 500); 
};

closeBtn.addEventListener('click', closeProductView);

// --- Color Editor Logic ---
const openColorEditor = (mesh) => {
    if (!mesh.material || !mesh.material.albedoColor) return;
    
    activeColorMesh = mesh;
    originalColorHex = mesh.material.albedoColor.toHexString();
    
    colorEditorTargetName.innerText = "Hedef: " + mesh.name;
    meshColorInput.value = originalColorHex;
    
    colorEditorOverlay.classList.remove('hidden');
    camera.detachControl();
};

const closeColorEditor = () => {
    colorEditorOverlay.classList.add('hidden');
    activeColorMesh = null;
    camera.attachControl(canvas, true);
};

meshColorInput.addEventListener('input', (e) => {
    if (activeColorMesh && activeColorMesh.material) {
        activeColorMesh.material.albedoColor = Color3.FromHexString(e.target.value);
    }
});

saveColorBtn.addEventListener('click', async () => {
    if (activeColorMesh) {
        const hex = meshColorInput.value;
        await saveColorToDB(activeColorMesh.name, hex);
    }
    closeColorEditor();
});

cancelColorBtn.addEventListener('click', () => {
    if (activeColorMesh && activeColorMesh.material && originalColorHex) {
        activeColorMesh.material.albedoColor = Color3.FromHexString(originalColorHex);
    }
    closeColorEditor();
});

resetColorBtn.addEventListener('click', async () => {
    if (activeColorMesh && activeColorMesh.material) {
        activeColorMesh.material.albedoColor = new Color3(1, 1, 1);
        await saveColorToDB(activeColorMesh.name, "#ffffff"); // Default white/base
    }
    closeColorEditor();
});

createScene().then(() => {
    engine.runRenderLoop(() => { if(scene) scene.render(); });
});
window.addEventListener('resize', () => engine.resize());
