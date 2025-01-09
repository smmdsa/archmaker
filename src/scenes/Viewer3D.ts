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
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Container not found');

        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Setup camera with increased far plane
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 10000);
        this.camera.position.set(-1000, 1000, -1000);
        this.camera.lookAt(0, 0, 0);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 5000;
        this.controls.maxPolarAngle = Math.PI / 2.1;

        // Setup scene
        this.setupScene();
        this.setupLights();

        // Subscribe to store changes
        this.store.subscribe(() => this.updateScene());

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private createWallMesh(wall: Wall): THREE.Mesh {
        // Calcular la dirección y longitud de la pared
        const direction = {
            x: -(wall.end.x - wall.start.x),  // Invertimos X para corregir el espejado
            z: -(wall.end.y - wall.start.y)   // Mantenemos Y invertido para la orientación correcta
        };
        const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        
        // Crear la geometría de la pared
        const geometry = new THREE.BoxGeometry(
            length,              // Longitud en X
            wall.height,         // Altura en Y
            wall.thickness       // Grosor en Z
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.2,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Trasladar la geometría para que el punto de rotación sea el inicio
        geometry.translate(length / 2, wall.height / 2, 0);

        // Posicionar en el punto inicial
        mesh.position.set(
            -wall.start.x,       // Invertimos X para corregir el espejado
            0,                   // Y es la base de la pared (altura)
            -wall.start.y        // Mantenemos Y invertido para la orientación correcta
        );

        // Calcular el ángulo correcto para la rotación
        const angle = Math.atan2(direction.z, direction.x);
        mesh.rotation.y = -angle;

        return mesh;
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
            -opening.position.x,  // Invertimos X para mantener consistencia
            opening.height / 2,
            -opening.position.y   // Mantenemos Y invertido
        );
        
        return mesh;
    }

    private updateScene(): void {
        // Limpiar meshes existentes
        this.wallMeshes.forEach(mesh => this.scene.remove(mesh));
        this.openingMeshes.forEach(mesh => this.scene.remove(mesh));
        this.wallMeshes.clear();
        this.openingMeshes.clear();

        // Agregar paredes
        this.store.getWalls().forEach(wall => {
            const mesh = this.createWallMesh(wall);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.wallMeshes.set(wall.id, mesh);
        });

        // Agregar aperturas
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

    private setupLights(): void {
        // Luz ambiental
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Luz direccional principal
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(1000, 1000, 1000);
        mainLight.castShadow = true;
        
        // Mejorar las sombras
        mainLight.shadow.camera.near = 100;
        mainLight.shadow.camera.far = 5000;
        mainLight.shadow.camera.left = -1000;
        mainLight.shadow.camera.right = 1000;
        mainLight.shadow.camera.top = 1000;
        mainLight.shadow.camera.bottom = -1000;
        
        this.scene.add(mainLight);

        // Luz direccional secundaria
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-1000, 500, -1000);
        this.scene.add(fillLight);
    }

    private setupScene(): void {
        // Crear un grid procedural infinito en el plano XZ
        const size = 1000000;
        const divisions = 1000;
        
        // Grid principal en el plano XZ
        const mainGrid = new THREE.GridHelper(size, divisions, 0x888888, 0xcccccc);
        mainGrid.position.y = 0;
        mainGrid.rotation.y = Math.PI; // Rotamos el grid 180 grados para que coincida con el plano 2D
        
        // Hacer el material del grid transparente en los bordes
        if (mainGrid.material instanceof THREE.Material) {
            mainGrid.material.opacity = 0.5;
            mainGrid.material.transparent = true;
            mainGrid.material.blending = THREE.AdditiveBlending;
        } else if (Array.isArray(mainGrid.material)) {
            mainGrid.material.forEach(mat => {
                mat.opacity = 0.5;
                mat.transparent = true;
                mat.blending = THREE.AdditiveBlending;
            });
        }
        
        this.scene.add(mainGrid);

        // Agregar ejes de referencia más grandes y visibles
        const axesHelper = new THREE.AxesHelper(500);
        axesHelper.rotation.y = Math.PI; // Rotamos los ejes 180 grados para que coincidan con el plano 2D
        
        // Personalizar los materiales de los ejes para hacerlos más visibles
        if (Array.isArray(axesHelper.material)) {
            axesHelper.material.forEach((material, index) => {
                if (material instanceof THREE.LineBasicMaterial) {
                    material.linewidth = 3;
                    // Rojo para X, Verde para Y (altura), Azul para Z
                    switch(index) {
                        case 0: material.color.setHex(0xFF0000); break; // X - rojo
                        case 1: material.color.setHex(0x00FF00); break; // Y - verde (altura)
                        case 2: material.color.setHex(0x0000FF); break; // Z - azul
                    }
                }
            });
        }

        // Agregar etiquetas para los ejes
        const createAxisLabel = (text: string, position: THREE.Vector3, color: number) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return;
            
            canvas.width = 64;
            canvas.height = 64;
            context.font = 'bold 48px Arial';
            context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, 32, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(position);
            sprite.scale.set(50, 50, 1);
            return sprite;
        };

        // Crear y añadir las etiquetas con posiciones ajustadas
        const labels = [
            createAxisLabel('X', new THREE.Vector3(-550, 0, 0), 0xFF0000),    // X - rojo (invertido)
            createAxisLabel('Y', new THREE.Vector3(0, 550, 0), 0x00FF00),    // Y - verde (altura)
            createAxisLabel('Z', new THREE.Vector3(0, 0, -550), 0x0000FF)     // Z - azul (invertido)
        ];
        
        labels.forEach(label => label && this.scene.add(label));
        this.scene.add(axesHelper);

        // Agregar plano de referencia semi-transparente en XZ
        const groundGeometry = new THREE.PlaneGeometry(size, size);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotar para que esté en el plano XZ
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    public dispose(): void {
        // Limpiar recursos de Three.js
        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (object.material instanceof THREE.Material) {
                    object.material.dispose();
                } else if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                }
            }
        });

        // Detener el renderizado
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            this.renderer.domElement.remove();
        }

        // Limpiar event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));
    }
} 