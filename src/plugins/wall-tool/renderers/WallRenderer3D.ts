import * as THREE from 'three';
import { Wall } from '../types/wall';
import { IWallService } from '../services/IWallService';
import { ILogger } from '../../../core/interfaces/ILogger';

export interface WallRenderer3DConfig {
    scene: THREE.Scene;
    defaultColor: THREE.ColorRepresentation;
    selectedColor: THREE.ColorRepresentation;
    materials: Record<string, THREE.Material>;
}

export class WallRenderer3D {
    private walls: Map<string, THREE.Mesh> = new Map();
    private selectedWallId: string | null = null;
    private defaultMaterial: THREE.MeshStandardMaterial;
    private selectedMaterial: THREE.MeshStandardMaterial;
    private materialCache: Map<string, THREE.Material> = new Map();

    constructor(
        private readonly service: IWallService,
        private readonly config: WallRenderer3DConfig,
        private readonly logger: ILogger
    ) {
        this.defaultMaterial = new THREE.MeshStandardMaterial({
            color: config.defaultColor,
            side: THREE.DoubleSide
        });

        this.selectedMaterial = new THREE.MeshStandardMaterial({
            color: config.selectedColor,
            side: THREE.DoubleSide,
            emissive: config.selectedColor,
            emissiveIntensity: 0.2
        });

        // Inicializar materiales predefinidos
        for (const [name, material] of Object.entries(config.materials)) {
            this.materialCache.set(name, material);
        }
    }

    public async initialize(): Promise<void> {
        this.logger.info('Initializing WallRenderer3D');
        await this.refreshWalls();
    }

    public async dispose(): Promise<void> {
        this.logger.info('Disposing WallRenderer3D');
        this.clearWalls();
        
        // Limpiar materiales
        this.defaultMaterial.dispose();
        this.selectedMaterial.dispose();
        this.materialCache.forEach(material => material.dispose());
        this.materialCache.clear();
    }

    public async refreshWalls(): Promise<void> {
        this.clearWalls();
        const walls = await this.service.getAllWalls();
        for (const wall of walls) {
            await this.renderWall(wall);
        }
    }

    public async selectWall(wallId: string | null): Promise<void> {
        // Desseleccionar pared anterior
        if (this.selectedWallId) {
            const previousWall = await this.service.getWall(this.selectedWallId);
            if (previousWall) {
                const material = await this.getMaterialForWall(previousWall);
                const mesh = this.walls.get(this.selectedWallId);
                if (mesh) {
                    mesh.material = material;
                }
            }
        }

        this.selectedWallId = wallId;

        // Seleccionar nueva pared
        if (wallId) {
            const wall = await this.service.getWall(wallId);
            if (wall) {
                const mesh = this.walls.get(wallId);
                if (mesh) {
                    mesh.material = this.selectedMaterial;
                }
            }
        }
    }

    private async renderWall(wall: Wall): Promise<void> {
        const geometry = this.createWallGeometry(wall);
        const material = await this.getMaterialForWall(wall);
        const mesh = new THREE.Mesh(geometry, material);

        // Posicionar la pared
        const centerX = (wall.startPoint.x + wall.endPoint.x) / 2;
        const centerY = wall.height / 2;
        const centerZ = -(wall.startPoint.y + wall.endPoint.y) / 2; // Negativo porque Three.js usa Z como profundidad

        mesh.position.set(centerX, centerY, centerZ);
        mesh.rotation.y = -wall.angle; // Negativo porque Three.js usa sistema de mano derecha

        this.walls.set(wall.id, mesh);
        this.config.scene.add(mesh);
    }

    private createWallGeometry(wall: Wall): THREE.BoxGeometry {
        return new THREE.BoxGeometry(
            wall.length,    // width (longitud de la pared)
            wall.height,    // height (altura de la pared)
            wall.thickness  // depth (grosor de la pared)
        );
    }

    private async getMaterialForWall(wall: Wall): Promise<THREE.Material> {
        const material = this.materialCache.get(wall.material);
        if (material) {
            return material;
        }

        // Si no está en caché, crear nuevo material
        const newMaterial = new THREE.MeshStandardMaterial({
            color: this.config.defaultColor,
            side: THREE.DoubleSide
        });
        this.materialCache.set(wall.material, newMaterial);
        return newMaterial;
    }

    private clearWalls(): void {
        for (const mesh of this.walls.values()) {
            mesh.geometry.dispose();
            this.config.scene.remove(mesh);
        }
        this.walls.clear();
        this.selectedWallId = null;
    }
} 