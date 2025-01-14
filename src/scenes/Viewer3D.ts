import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CanvasStore } from '../store/CanvasStore';
import { WallObject } from '../plugins/wall-tool/objects/WallObject';
import { DoorObject } from '../plugins/door-tool/objects/DoorObject';
import { WindowObject } from '../plugins/window-tool/objects/WindowObject';
import { IEventManager } from '../core/interfaces/IEventManager';

export class Viewer3D {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private gridHelper: THREE.GridHelper = new THREE.GridHelper(1000, 100);
    private groundPlane: THREE.Mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshBasicMaterial({ color: 0xcccccc })
    );
    private wallMeshes: Map<string, THREE.Mesh> = new Map();
    private doorMeshes: Map<string, THREE.Mesh> = new Map();
    private windowMeshes: Map<string, THREE.Mesh> = new Map();
    private isExpanded: boolean = false;
    private cameraControls: HTMLElement;
    private skybox: THREE.Mesh | null = null;

    constructor(
        private readonly container: HTMLElement,
        private readonly store: CanvasStore,
        private readonly eventManager: IEventManager
    ) {
        // Add expand button
        const expandButton = document.createElement('button');
        expandButton.className = 'expand-button';
        expandButton.innerHTML = '⛶';
        expandButton.title = 'Expand/Collapse';
        expandButton.onclick = this.toggleExpand.bind(this);
        container.appendChild(expandButton);

        // Add camera controls panel
        this.cameraControls = document.createElement('div');
        this.cameraControls.className = 'camera-controls';
        this.cameraControls.innerHTML = `
            <h3>Camera Controls</h3>
            <div class="control-group">
                <div class="control-row">
                    <span class="control-label">Min Distance</span>
                    <div class="control-value">
                        <input type="range" id="minDistance" min="10" max="1000" value="100" />
                        <input type="number" value="100" min="10" max="1000" />
                    </div>
                </div>
                <div class="control-row">
                    <span class="control-label">Max Distance</span>
                    <div class="control-value">
                        <input type="range" id="maxDistance" min="1000" max="10000" value="3000" />
                        <input type="number" value="3000" min="1000" max="10000" />
                    </div>
                </div>
                <div class="control-row">
                    <span class="control-label">Damping Factor</span>
                    <div class="control-value">
                        <input type="range" id="dampingFactor" min="0" max="1" step="0.01" value="0.05" />
                        <input type="number" value="0.05" min="0" max="1" step="0.01" />
                    </div>
                </div>
            </div>
        `;
        container.appendChild(this.cameraControls);

        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            15000  // Increased far plane to accommodate larger max distance
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        // Set initial camera position
        this.camera.position.set(500, 500, 500);
        this.camera.lookAt(0, 0, 0);

        // Initialize controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 100;
        this.controls.maxDistance = 3000;
        this.controls.maxPolarAngle = Math.PI / 2;

        // Now that controls are initialized, setup camera controls
        this.setupCameraControls();

        // Setup scene
        this.setupScene();
        this.setupLights();

        // Subscribe to wall changes
        this.eventManager.on('wall:created', () => this.updateScene());
        this.eventManager.on('wall:updated', () => this.updateScene());
        this.eventManager.on('wall:deleted', () => this.updateScene());

        // Subscribe to door changes
        this.eventManager.on('door:added', () => this.updateScene());
        this.eventManager.on('door:removed', () => this.updateScene());
        this.eventManager.on('door:changed', () => this.updateScene());

        // Subscribe to window changes
        this.eventManager.on('window:added', () => this.updateScene());
        this.eventManager.on('window:removed', () => this.updateScene());
        this.eventManager.on('window:changed', () => this.updateScene());

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private toggleExpand(): void {
        this.isExpanded = !this.isExpanded;
        this.container.classList.toggle('expanded', this.isExpanded);
        
        // Force a resize after the transition completes
        setTimeout(() => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height, true);
            
            // Adjust controls if needed
            this.controls.update();
        }, 300); // Match the CSS transition duration
    }

    private createWallMesh(wall: WallObject): THREE.Mesh {
        const wallData = wall.getData();
        const direction = {
            x: -(wallData.endPoint.x - wallData.startPoint.x),
            z: -(wallData.endPoint.y - wallData.startPoint.y)
        };
        const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        
        // Create wall geometry
        const geometry = new THREE.BoxGeometry(
            length,
            wallData.height || 280, // Default height if not specified
            wallData.thickness || 10 // Default thickness if not specified
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.2,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Center the geometry at start point
        geometry.translate(length / 2, (wallData.height || 280) / 2, 0);

        // Position at start point
        mesh.position.set(
            -wallData.startPoint.x,
            0,
            -wallData.startPoint.y
        );

        // Rotate to align with wall direction
        const angle = Math.atan2(direction.z, direction.x);
        mesh.rotation.y = -angle;

        return mesh;
    }

    private createDoorMesh(door: DoorObject): THREE.Mesh | null {
        const doorData = door.getData();
        const wall = this.store.getWallGraph().getWall(doorData.wallId);
        if (!wall) return null;

        const wallData = wall.getData();
        const thickness = wallData.thickness || 10; // Default thickness if not specified

        const geometry = new THREE.BoxGeometry(
            doorData.properties.width,
            doorData.properties.width, // Using width for height since it's a square in 2D
            thickness + 2 // Slightly thicker to prevent z-fighting
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0xe67e22, // Brown
            metalness: 0.3,
            roughness: 0.7
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Position along the wall
        const wallDir = {
            x: wallData.endPoint.x - wallData.startPoint.x,
            y: wallData.endPoint.y - wallData.startPoint.y
        };
        const wallLength = Math.sqrt(wallDir.x * wallDir.x + wallDir.y * wallDir.y);
        const normalizedDir = {
            x: wallDir.x / wallLength,
            y: wallDir.y / wallLength
        };

        // Use the actual position from the door data
        mesh.position.set(
            -doorData.position.x,
            doorData.properties.width / 2,
            -doorData.position.y
        );

        // Rotate to match wall orientation
        const angle = Math.atan2(-wallDir.y, -wallDir.x);
        mesh.rotation.y = -angle;

        return mesh;
    }

    private createWindowMesh(window: WindowObject): THREE.Mesh | null {
        const windowData = window.getData();
        const wall = this.store.getWallGraph().getWall(windowData.wallId);
        if (!wall) return null;

        const wallData = wall.getData();
        const thickness = wallData.thickness || 10; // Default thickness if not specified
        const defaultSillHeight = 100; // Default sill height in cm

        const geometry = new THREE.BoxGeometry(
            windowData.properties.width,
            windowData.properties.height,
            thickness + 2 // Slightly thicker to prevent z-fighting
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0xffc0cb, // Pink
            metalness: 0.3,
            roughness: 0.7,
            transparent: true,
            opacity: 0.8
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Calculate wall direction for rotation
        const wallDir = {
            x: wallData.endPoint.x - wallData.startPoint.x,
            y: wallData.endPoint.y - wallData.startPoint.y
        };

        // Use the actual position from the window data
        mesh.position.set(
            -windowData.position.x,
            windowData.properties.height / 2 + defaultSillHeight,
            -windowData.position.y
        );

        // Rotate to match wall orientation
        const angle = Math.atan2(-wallDir.y, -wallDir.x);
        mesh.rotation.y = -angle;

        return mesh;
    }

    private updateScene(): void {
        // Clear existing meshes
        this.wallMeshes.forEach(mesh => this.scene.remove(mesh));
        this.doorMeshes.forEach(mesh => this.scene.remove(mesh));
        this.windowMeshes.forEach(mesh => this.scene.remove(mesh));
        
        this.wallMeshes.clear();
        this.doorMeshes.clear();
        this.windowMeshes.clear();

        // Add walls
        const wallGraph = this.store.getWallGraph();
        wallGraph.getAllWalls().forEach(wall => {
            const mesh = this.createWallMesh(wall);
            this.scene.add(mesh);
            this.wallMeshes.set(wall.id, mesh);
        });

        // Add doors
        const doorStore = this.store.getDoorStore();
        doorStore.getAllDoors().forEach(door => {
            const mesh = this.createDoorMesh(door);
            if (mesh) {
                this.scene.add(mesh);
                this.doorMeshes.set(door.id, mesh);
            }
        });

        // Add windows
        const windowStore = this.store.getWindowStore();
        windowStore.getAllWindows().forEach(window => {
            const mesh = this.createWindowMesh(window);
            if (mesh) {
                this.scene.add(mesh);
                this.windowMeshes.set(window.id, mesh);
            }
        });
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    private onWindowResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, true);
    }

    private setupLights(): void {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.5);
        mainLight.position.set(1000, 1000, 1000);
        mainLight.castShadow = true;
        
        // Improve shadows
        mainLight.shadow.camera.near = 100;
        mainLight.shadow.camera.far = 5000;
        mainLight.shadow.camera.left = -1000;
        mainLight.shadow.camera.right = 1000;
        mainLight.shadow.camera.top = 1000;
        mainLight.shadow.camera.bottom = -1000;
        
        this.scene.add(mainLight);
    }

    private setupScene(): void {
        // Enable shadow mapping
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        var cubeMapFile = '/cube-map-2.jpg';
        // Load skybox texture
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(cubeMapFile, (texture) => {
            // Create skybox geometry
            const geometry = new THREE.BoxGeometry(10000, 10000, 10000);
            
            // Create materials for each face of the cube
            const materials = [
                new THREE.MeshBasicMaterial({ map: this.createFaceTexture(texture, 2, 1), side: THREE.BackSide }), // right
                new THREE.MeshBasicMaterial({ map: this.createFaceTexture(texture, 0, 1), side: THREE.BackSide }), // left
                new THREE.MeshBasicMaterial({ map: this.createFaceTexture(texture, 1, 0), side: THREE.BackSide }), // top
                new THREE.MeshBasicMaterial({ map: this.createFaceTexture(texture, 1, 2), side: THREE.BackSide }), // bottom
                new THREE.MeshBasicMaterial({ map: this.createFaceTexture(texture, 1, 1), side: THREE.BackSide }), // front
                new THREE.MeshBasicMaterial({ map: this.createFaceTexture(texture, 3, 1), side: THREE.BackSide }), // back
            ];

            // Create and add skybox
            this.skybox = new THREE.Mesh(geometry, materials);
            this.scene.add(this.skybox);
        });

        // Create grid helper (1 unit = 1cm)
        const size = 10000; // 100m
        const divisions = 100; // 1m divisions
        this.gridHelper = new THREE.GridHelper(size, divisions, 0x888888, 0xcccccc);
        this.gridHelper.position.y = 0.1; // Slightly above ground
        this.gridHelper.visible = false; // Hide the grid
        this.scene.add(this.gridHelper);

        // Create ground plane with grass-like appearance
        const groundGeometry = new THREE.PlaneGeometry(size, size);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x4CAF50, // Nice green color
            roughness: 1.0,   // Very rough for a natural look
            metalness: 0.0,   // No metallic properties
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1.0
        });

        this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.y = 0; // At ground level
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);

        // Add axes helper
        const axesHelper = new THREE.AxesHelper(500);
        this.scene.add(axesHelper);

        // Set initial camera position
        this.camera.position.set(500, 500, 500);
        this.camera.lookAt(0, 0, 0);

        // Configure controls
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 100;
        this.controls.maxDistance = 3000;
        this.controls.maxPolarAngle = Math.PI / 2;
    }

    private setupCameraControls(): void {
        const minDistanceRange = this.cameraControls.querySelector('#minDistance') as HTMLInputElement;
        const minDistanceNumber = minDistanceRange.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
        const maxDistanceRange = this.cameraControls.querySelector('#maxDistance') as HTMLInputElement;
        const maxDistanceNumber = maxDistanceRange.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
        const dampingFactorRange = this.cameraControls.querySelector('#dampingFactor') as HTMLInputElement;
        const dampingFactorNumber = dampingFactorRange.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;

        // Set initial values from controls
        this.controls.minDistance = Number(minDistanceRange.value);
        this.controls.maxDistance = Number(maxDistanceRange.value);
        this.controls.dampingFactor = Number(dampingFactorRange.value);
        this.controls.enableDamping = true;

        // Min Distance
        const updateMinDistance = (value: string) => {
            const numValue = Number(value);
            minDistanceNumber.value = value;
            minDistanceRange.value = value;
            this.controls.minDistance = numValue;
            this.controls.update();
        };

        minDistanceRange.addEventListener('input', (e) => {
            updateMinDistance((e.target as HTMLInputElement).value);
        });

        minDistanceNumber.addEventListener('change', (e) => {
            updateMinDistance((e.target as HTMLInputElement).value);
        });

        // Max Distance
        const updateMaxDistance = (value: string) => {
            const numValue = Number(value);
            maxDistanceNumber.value = value;
            maxDistanceRange.value = value;
            this.controls.maxDistance = numValue;
            this.controls.update();
        };

        maxDistanceRange.addEventListener('input', (e) => {
            updateMaxDistance((e.target as HTMLInputElement).value);
        });

        maxDistanceNumber.addEventListener('change', (e) => {
            updateMaxDistance((e.target as HTMLInputElement).value);
        });

        // Damping Factor
        const updateDampingFactor = (value: string) => {
            const numValue = Number(value);
            dampingFactorNumber.value = value;
            dampingFactorRange.value = value;
            this.controls.dampingFactor = numValue;
            this.controls.update();
        };

        dampingFactorRange.addEventListener('input', (e) => {
            updateDampingFactor((e.target as HTMLInputElement).value);
        });

        dampingFactorNumber.addEventListener('change', (e) => {
            updateDampingFactor((e.target as HTMLInputElement).value);
        });
    }

    private createFaceTexture(texture: THREE.Texture, x: number, y: number): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = texture.image.width / 4;
        canvas.height = texture.image.height / 3;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
            ctx.drawImage(
                texture.image,
                x * canvas.width, y * canvas.height,
                canvas.width, canvas.height,
                0, 0,
                canvas.width, canvas.height
            );
        }
        
        const faceTexture = new THREE.CanvasTexture(canvas);
        faceTexture.needsUpdate = true;
        return faceTexture;
    }

    public dispose(): void {
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        
        // Remove camera controls
        this.cameraControls.remove();

        // Dispose skybox if it exists
        if (this.skybox) {
            this.skybox.geometry.dispose();
            if (Array.isArray(this.skybox.material)) {
                this.skybox.material.forEach(material => material.dispose());
            }
            this.scene.remove(this.skybox);
        }

        // Dispose geometries and materials
        this.wallMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
        });

        this.doorMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
        });

        this.windowMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
        });

        // Dispose ground plane
        this.groundPlane.geometry.dispose();
        if (this.groundPlane.material instanceof THREE.Material) {
            this.groundPlane.material.dispose();
        }

        // Clear scene
        while(this.scene.children.length > 0) { 
            this.scene.remove(this.scene.children[0]); 
        }

        // Dispose renderer
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
    }
} 