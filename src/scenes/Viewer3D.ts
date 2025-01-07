import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Wall, Opening, ProjectStore } from '../store/ProjectStore';

export class Viewer3D {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private wallMeshes: Map<string, THREE.Mesh> = new Map();
    private openingMeshes: Map<string, THREE.Mesh> = new Map();
    private gridHelper: THREE.GridHelper;

    constructor(containerId: string, private store: ProjectStore) {
        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // Setup camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            2000
        );
        // Position camera for better initial view
        this.camera.position.set(0, 500, 500);
        this.camera.lookAt(0, 0, 0);

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Container not found');
        
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 100;
        this.controls.maxDistance = 1000;

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 100);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Add ground plane
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add grid helper
        this.gridHelper = new THREE.GridHelper(1000, 100, 0x888888, 0xcccccc);
        this.scene.add(this.gridHelper);

        // Add axes helper
        const axesHelper = new THREE.AxesHelper(50);
        this.scene.add(axesHelper);

        // Subscribe to store changes
        this.store.subscribe(() => this.updateScene());

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private createWallMesh(wall: Wall): THREE.Mesh {
        // Calculate wall direction and length
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        // Create wall geometry
        const wallGeometry = new THREE.BoxGeometry(length, wall.height, 10);
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xcccccc,
            roughness: 0.7,
            metalness: 0.1
        });
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        // Position wall
        // Move geometry so length is along X axis
        wallGeometry.translate(length / 2, 0, 0);
        
        // Position at start point
        wallMesh.position.set(wall.start.x, wall.height / 2, wall.start.y);

        // Calculate and apply rotation
        const angle = Math.atan2(dy, dx);
        wallMesh.rotation.y = -angle; // Negative angle to match 2D view

        return wallMesh;
    }

    private createOpeningMesh(opening: Opening): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(
            opening.width,
            opening.height,
            12 // Slightly thicker than walls to prevent z-fighting
        );
        const material = new THREE.MeshStandardMaterial({
            color: opening.type === 'door' ? 0xe67e22 : 0x3498db,
            transparent: opening.type === 'window',
            opacity: opening.type === 'window' ? 0.5 : 1,
            roughness: 0.3,
            metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        mesh.position.set(
            opening.position.x,
            opening.height / 2,
            opening.position.y
        );
        
        return mesh;
    }

    private updateScene(): void {
        // Clear existing meshes
        this.wallMeshes.forEach(mesh => this.scene.remove(mesh));
        this.openingMeshes.forEach(mesh => this.scene.remove(mesh));
        this.wallMeshes.clear();
        this.openingMeshes.clear();

        // Add walls
        this.store.getWalls().forEach(wall => {
            const mesh = this.createWallMesh(wall);
            this.scene.add(mesh);
            this.wallMeshes.set(wall.id, mesh);
        });

        // Add openings
        this.store.getOpenings().forEach(opening => {
            const mesh = this.createOpeningMesh(opening);
            this.scene.add(mesh);
            this.openingMeshes.set(opening.id, mesh);
        });
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    private onWindowResize(): void {
        const container = this.renderer.domElement.parentElement;
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
} 