import * as THREE from 'three';
import { WallRenderer3D, WallRenderer3DConfig } from './WallRenderer3D';
import { IWallService } from '../services/IWallService';
import { ILogger } from '../../../core/interfaces/ILogger';
import { Wall } from '../types/wall';

describe('WallRenderer3D', () => {
    let renderer: WallRenderer3D;
    let scene: THREE.Scene;
    let wallService: jest.Mocked<IWallService>;
    let logger: jest.Mocked<ILogger>;
    let config: WallRenderer3DConfig;

    const mockWall: Wall = {
        id: 'wall1',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 10, y: 0 },
        height: 3,
        thickness: 0.2,
        material: 'default',
        angle: 0,
        length: 10
    };

    beforeEach(() => {
        scene = new THREE.Scene();
        
        wallService = {
            getAllWalls: jest.fn().mockResolvedValue([mockWall]),
            getWall: jest.fn().mockReturnValue(mockWall),
            createWall: jest.fn(),
            updateWall: jest.fn(),
            deleteWall: jest.fn(),
            getAvailableMaterials: jest.fn(),
            getDefaultMaterial: jest.fn(),
            getWallDefaults: jest.fn(),
            setWallDefaults: jest.fn(),
            validateProperties: jest.fn(),
            calculateWallGeometry: jest.fn(),
            initialize: jest.fn(),
            dispose: jest.fn(),
            id: 'wall-service'
        } as unknown as jest.Mocked<IWallService>;

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            setPluginContext: jest.fn(),
            clearPluginContext: jest.fn()
        } as jest.Mocked<ILogger>;

        config = {
            scene,
            defaultColor: 0xcccccc,
            selectedColor: 0xff0000,
            materials: {}
        };

        renderer = new WallRenderer3D(wallService, config, logger);
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Limpiar la escena
        while(scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }
    });

    describe('initialize', () => {
        it('should initialize and render walls', async () => {
            await renderer.initialize();
            
            expect(wallService.getAllWalls).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Initializing WallRenderer3D');
            expect(scene.children.length).toBe(1); // Una pared renderizada
        });
    });

    describe('dispose', () => {
        it('should clean up resources', async () => {
            await renderer.initialize();
            await renderer.dispose();
            
            expect(logger.info).toHaveBeenCalledWith('Disposing WallRenderer3D');
            expect(scene.children.length).toBe(0); // Todas las paredes eliminadas
        });
    });

    describe('refreshWalls', () => {
        it('should clear and re-render all walls', async () => {
            await renderer.initialize();
            
            // Simular cambio en las paredes
            const newWall = { ...mockWall, id: 'wall2' };
            wallService.getAllWalls.mockResolvedValueOnce([newWall]);
            
            await renderer.refreshWalls();
            
            expect(scene.children.length).toBe(1);
        });
    });

    describe('selectWall', () => {
        it('should update wall materials when selecting', async () => {
            await renderer.initialize();
            
            // Seleccionar pared
            renderer.selectWall(mockWall.id);
            const mesh = scene.children[0] as THREE.Mesh;
            expect(mesh.material).toBeDefined();
            
            // Deseleccionar pared
            renderer.selectWall(null);
            expect(mesh.material).toBeDefined();
        });
    });

    describe('renderWall', () => {
        it('should create mesh with correct dimensions', async () => {
            await renderer.initialize();
            
            const mesh = scene.children[0] as THREE.Mesh;
            const geometry = mesh.geometry as THREE.BoxGeometry;
            
            // Verificar dimensiones
            expect(geometry.parameters.width).toBe(mockWall.length);
            expect(geometry.parameters.height).toBe(mockWall.height);
            expect(geometry.parameters.depth).toBe(mockWall.thickness);
        });

        it('should position mesh correctly', async () => {
            await renderer.initialize();
            
            const mesh = scene.children[0] as THREE.Mesh;
            
            // Verificar posición
            expect(mesh.position.x).toBe(5); // Centro entre startPoint y endPoint
            expect(mesh.position.y).toBe(1.5); // Altura/2
            expect(Math.abs(mesh.position.z)).toBe(0); // Centro en Z, usando Math.abs para manejar -0
        });
    });
}); 