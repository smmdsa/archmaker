import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { Point } from '../core/types/geometry';
import { CanvasStore } from '../store/CanvasStore';
import * as THREE from 'three';

interface Transform {
    x: number;
    y: number;
    scale: number;
}

export class Canvas2D {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private readonly canvasStore: CanvasStore;
    
    // Zoom control properties
    private minZoom = 0.1;
    private maxZoom = 5;
    private zoomFactor = 1.1;
    
    // Transform state
    private transform: Transform = {
        x: 0,
        y: 0,
        scale: 1
    };
    
    // Panning control
    private isPanning = false;
    private lastPointerPosition: Point | null = null;
    
    // Animation frame request
    private animationFrame: number | null = null;

    // Object groups for organization
    private gridGroup: THREE.Group;
    private wallsGroup: THREE.Group;
    private doorsGroup: THREE.Group;
    private windowsGroup: THREE.Group;
    private nodesGroup: THREE.Group;
    private previewGroup: THREE.Group;
    
    constructor(
        containerId: string,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.logger.info('Initializing Canvas2D component with Three.js...');
        
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Canvas container not found: ${containerId}`);
        }

        // Initialize Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // Create orthographic camera
        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 1000;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            2000
        );
        this.camera.position.z = 1000;

        // Initialize object groups
        this.gridGroup = new THREE.Group();
        this.wallsGroup = new THREE.Group();
        this.doorsGroup = new THREE.Group();
        this.windowsGroup = new THREE.Group();
        this.nodesGroup = new THREE.Group();
        this.previewGroup = new THREE.Group();

        this.scene.add(this.gridGroup);
        this.scene.add(this.wallsGroup);
        this.scene.add(this.doorsGroup);
        this.scene.add(this.windowsGroup);
        this.scene.add(this.nodesGroup);
        this.scene.add(this.previewGroup);

        // Initialize CanvasStore
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        this.canvasStore.setCanvas(this);
        
        // Initial setup
        this.handleResize();
        this.setupEventListeners();
        this.startRenderLoop();
        this.createGrid();

        // Emit canvas ready event
        this.eventManager.emit('canvas:initialized', {
            canvas: this,
            dimensions: {
                width: container.clientWidth,
                height: container.clientHeight
            }
        });

        this.logger.info('Canvas2D component initialized successfully');
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', this.handleResize);
        
        const canvas = this.renderer.domElement;
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('mousedown', this.handleMouseDown);
        canvas.addEventListener('mousemove', this.handleMouseMove);
        canvas.addEventListener('mouseup', this.handleMouseUp);
        canvas.addEventListener('mouseleave', this.handleMouseLeave);
        canvas.addEventListener('wheel', this.handleWheel, { passive: false });

        // Subscribe to store changes
        this.eventManager.on('wall:created', (event) => {
            this.logger.info('Wall created event received:', event);
            this.renderObjects();
        });
        this.eventManager.on('wall:updated', (event) => {
            this.logger.info('Wall updated event received:', event);
            this.renderObjects();
        });
        this.eventManager.on('wall:deleted', (event) => {
            this.logger.info('Wall deleted event received:', event);
            this.renderObjects();
        });
        this.eventManager.on('door:changed', (event) => {
            this.logger.info('Door changed event received:', event);
            this.renderObjects();
        });
        this.eventManager.on('window:changed', (event) => {
            this.logger.info('Window changed event received:', event);
            this.renderObjects();
        });
        this.eventManager.on('node:changed', (event) => {
            this.logger.info('Node changed event received:', event);
            this.renderObjects();
        });
        this.eventManager.on('graph:changed', (event) => {
            this.logger.info('Graph changed event received:', event);
            this.renderObjects();
        });

        // Add preview event listener
        this.eventManager.on('canvas:preview', (event: { data: any }) => {
            this.updatePreview(event.data);
        });

        // Initial render
        this.renderObjects();
    }

    private handleMouseDown = (e: MouseEvent): void => {
        if (e.button === 2) {
            e.preventDefault();
            this.isPanning = true;
            this.lastPointerPosition = this.getMousePosition(e);
            this.renderer.domElement.style.cursor = 'grabbing';
            return;
        }

        // Handle double click
        if (e.detail === 2) {
            const worldPos = this.getWorldPosition(this.getMousePosition(e));
            this.eventManager.emit('canvas:event', {
                type: 'dblclick',
                position: worldPos,
                originalEvent: e,
                button: e.button
            });
            return;
        }

        const worldPos = this.getWorldPosition(this.getMousePosition(e));
        this.eventManager.emit('canvas:event', {
            type: 'mousedown',
            position: worldPos,
            originalEvent: e,
            button: e.button
        });
    };

    private handleMouseMove = (e: MouseEvent): void => {
        const mousePos = this.getMousePosition(e);

        if (this.isPanning && this.lastPointerPosition) {
            const dx = mousePos.x - this.lastPointerPosition.x;
            const dy = mousePos.y - this.lastPointerPosition.y;

            this.camera.position.x -= dx / this.transform.scale;
            this.camera.position.y += dy / this.transform.scale;

            this.lastPointerPosition = mousePos;

            this.eventManager.emit('canvas:pan', {
                position: { x: this.camera.position.x, y: this.camera.position.y },
                offset: { x: this.camera.position.x, y: this.camera.position.y },
                delta: { x: dx, y: dy }
            });

            return;
        }

        const worldPos = this.getWorldPosition(mousePos);
        this.eventManager.emit('canvas:event', {
            type: 'mousemove',
            position: worldPos,
            originalEvent: e,
            button: e.button
        });
    };

    private handleMouseUp = (e: MouseEvent): void => {
        if (e.button === 2) {
            this.isPanning = false;
            this.lastPointerPosition = null;
            this.renderer.domElement.style.cursor = 'default';
            return;
        }

        const worldPos = this.getWorldPosition(this.getMousePosition(e));
        this.eventManager.emit('canvas:event', {
            type: 'mouseup',
            position: worldPos,
            originalEvent: e,
            button: e.button
        });
    };

    private handleMouseLeave = (): void => {
        this.isPanning = false;
        this.lastPointerPosition = null;
        this.renderer.domElement.style.cursor = 'default';
    };

    private handleWheel = (e: WheelEvent): void => {
        e.preventDefault();
        
        const mousePos = this.getMousePosition(e);
        const worldPos = this.getWorldPosition(mousePos);
        
        const oldScale = this.transform.scale;
        let newScale = e.deltaY < 0 ? 
            oldScale * this.zoomFactor : 
            oldScale / this.zoomFactor;
        
        newScale = Math.max(this.minZoom, Math.min(this.maxZoom, newScale));
        if (newScale === oldScale) return;
        
        this.transform.scale = newScale;
        this.camera.zoom = newScale;
        this.camera.updateProjectionMatrix();
        
        this.eventManager.emit('canvas:zoom', {
            scale: newScale,
            position: { x: this.camera.position.x, y: this.camera.position.y },
            pointer: mousePos
        });
    };

    private handleResize = (): void => {
        const container = this.renderer.domElement.parentElement;
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspect = width / height;

        this.renderer.setSize(width, height);
        
        // Update camera frustum
        const frustumSize = 1000;
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
    };

    private createGrid(): void {
        const gridSize = 2000;
        const gridSpacing = 20;
        const gridMaterial = new THREE.LineBasicMaterial({ color: 0xdddddd });

        const vertices: number[] = [];
        const halfSize = gridSize / 2;

        // Create vertical lines
        for (let x = -halfSize; x <= halfSize; x += gridSpacing) {
            vertices.push(x, -halfSize, 0);
            vertices.push(x, halfSize, 0);
        }

        // Create horizontal lines
        for (let y = -halfSize; y <= halfSize; y += gridSpacing) {
            vertices.push(-halfSize, y, 0);
            vertices.push(halfSize, y, 0);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        const grid = new THREE.LineSegments(geometry, gridMaterial);
        this.gridGroup.add(grid);
    }

    private startRenderLoop(): void {
        const render = () => {
            this.render();
            this.animationFrame = requestAnimationFrame(render);
        };
        render();
    }

    private render(): void {
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    private renderObjects(): void {
        this.logger.info('Starting renderObjects()');
        
        // Clear existing objects
        this.wallsGroup.clear();
        this.doorsGroup.clear();
        this.windowsGroup.clear();
        this.nodesGroup.clear();

        const wallGraph = this.canvasStore.getWallGraph();
        const doorStore = this.canvasStore.getDoorStore();
        const windowStore = this.canvasStore.getWindowStore();

        // Log current state
        this.logger.info('Current store state:', {
            walls: wallGraph.getAllWalls().length,
            doors: doorStore.getAllDoors().length,
            windows: windowStore.getAllWindows().length,
            nodes: wallGraph.getAllNodes().length
        });

        // Draw walls
        wallGraph.getAllWalls().forEach(wall => {
            const wallObj = this.createWallObject(wall);
            this.wallsGroup.add(wallObj);
            this.logger.info('Created wall object:', {
                id: wall.id,
                data: wall.getData()
            });
        });

        // Draw doors
        doorStore.getAllDoors().forEach(door => {
            const doorObj = this.createDoorObject(door);
            this.doorsGroup.add(doorObj);
            this.logger.info('Created door object:', {
                id: door.id,
                data: door.getData()
            });
        });

        // Draw windows
        windowStore.getAllWindows().forEach(window => {
            const windowObj = this.createWindowObject(window);
            this.windowsGroup.add(windowObj);
            this.logger.info('Created window object:', {
                id: window.id,
                data: window.getData()
            });
        });

        // Draw nodes
        wallGraph.getAllNodes().forEach(node => {
            const nodeObj = this.createNodeObject(node);
            this.nodesGroup.add(nodeObj);
            this.logger.info('Created node object:', {
                id: node.id,
                data: node.getData()
            });
        });

        this.logger.info('Finished renderObjects()');
    }

    private createWallObject(wall: any): THREE.Object3D {
        const data = wall.getData();
        const start = data.startPoint;
        const end = data.endPoint;
        const thickness = data.thickness || 10;

        // Create wall line
        const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0).normalize();
        const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
        const halfThickness = thickness / 2;

        // Create vertices for the wall rectangle
        const vertices = [
            new THREE.Vector3(start.x + perpendicular.x * halfThickness, start.y + perpendicular.y * halfThickness, 0),
            new THREE.Vector3(start.x - perpendicular.x * halfThickness, start.y - perpendicular.y * halfThickness, 0),
            new THREE.Vector3(end.x + perpendicular.x * halfThickness, end.y + perpendicular.y * halfThickness, 0),
            new THREE.Vector3(end.x - perpendicular.x * halfThickness, end.y - perpendicular.y * halfThickness, 0)
        ];

        // Create geometry
        const geometry = new THREE.BufferGeometry();
        const indices = new Uint16Array([0, 1, 2, 2, 1, 3]); // Two triangles
        const positions = new Float32Array(vertices.flatMap(v => [v.x, v.y, v.z]));

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        // Create material
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x333333,
            side: THREE.DoubleSide
        });

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);

        // Add outline for better visibility
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
            vertices[0], vertices[2], vertices[3], vertices[1], vertices[0]
        ]);
        const outlineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 1
        });
        const outline = new THREE.Line(outlineGeometry, outlineMaterial);

        // Create group to hold both mesh and outline
        const group = new THREE.Group();
        group.add(mesh);
        group.add(outline);

        return group;
    }

    private createDoorObject(door: any): THREE.Object3D {
        const data = door.getData();
        const pos = data.position;
        const width = data.properties.width || 100;
        const angle = data.angle || 0;

        const group = new THREE.Group();
        group.position.set(pos.x, pos.y, 0);
        group.rotation.z = angle;

        // Door frame
        const frameGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-width/2, 0, 0),
            new THREE.Vector3(width/2, 0, 0)
        ]);
        const frameMaterial = new THREE.LineBasicMaterial({ 
            color: door.isHighlighted() ? 0x0088ff : 0x8B4513,
            linewidth: door.isSelected() ? 3 : 2
        });
        const frame = new THREE.Line(frameGeometry, frameMaterial);
        group.add(frame);

        // Door swing arc
        const arcPoints: THREE.Vector3[] = [];
        const radius = width/2;
        const segments = 32;
        const startAngle = data.isFlipped ? 0 : -Math.PI/2;
        const endAngle = data.isFlipped ? Math.PI/2 : 0;
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = startAngle + (endAngle - startAngle) * t;
            const x = (data.isFlipped ? -width/2 : width/2) + radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            arcPoints.push(new THREE.Vector3(x, y, 0));
        }

        const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arcMaterial = new THREE.LineBasicMaterial({ 
            color: door.isHighlighted() ? 0x0088ff : 0x8B4513,
            linewidth: 1
        });
        const arc = new THREE.Line(arcGeometry, arcMaterial);
        group.add(arc);

        return group;
    }

    private createWindowObject(window: any): THREE.Object3D {
        const data = window.getData();
        const pos = data.position;
        const width = data.properties.width || 100;
        const angle = data.angle || 0;

        const group = new THREE.Group();
        group.position.set(pos.x, pos.y, 0);
        group.rotation.z = angle;

        // Window frame
        const points: THREE.Vector3[] = [];
        const paneCount = 2;
        const paneWidth = width / paneCount;

        // Vertical lines
        for (let i = 0; i <= paneCount; i++) {
            const x = -width/2 + i * paneWidth;
            points.push(
                new THREE.Vector3(x, -20, 0),
                new THREE.Vector3(x, 20, 0)
            );
        }

        // Horizontal line
        points.push(
            new THREE.Vector3(-width/2, 0, 0),
            new THREE.Vector3(width/2, 0, 0)
        );

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: window.isHighlighted() ? 0x0088ff : 0x666666,
            linewidth: window.isSelected() ? 3 : 2
        });
        const frame = new THREE.LineSegments(geometry, material);
        group.add(frame);

        return group;
    }

    private createNodeObject(node: any): THREE.Object3D {
        const data = node.getData();
        const pos = node.position;
        const radius = data.radius || 5;
        const isMovable = data.isMovable ?? true;

        // Get colors from NodeObject styles
        const style = isMovable ? {
            fill: '#ffffff',
            stroke: '#000000'
        } : {
            fill: '#ffffff', 
            stroke: '#000000'
        };

        // Create node circle
        const geometry = new THREE.CircleGeometry(radius+3, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(style.fill)
        });
        const circle = new THREE.Mesh(geometry, material);
        circle.position.set(pos.x, pos.y, 0);

        // Create outline using EdgesGeometry for proper outline
        const outlineGeometry = new THREE.EdgesGeometry(geometry);
        const outlineMaterial = new THREE.LineBasicMaterial({ 
            color: new THREE.Color(style.stroke),
            linewidth: 2
        });
        const outline = new THREE.Line(outlineGeometry, outlineMaterial);
        outline.position.set(pos.x, pos.y, 0);

        // Create group to hold both circle and outline
        const group = new THREE.Group();
        group.add(circle);
        group.add(outline);

        return group;
    }

    private getMousePosition(e: MouseEvent): Point {
        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    private getWorldPosition(screenPos: Point): Point {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = (screenPos.x / rect.width) * 2 - 1;
        const y = -(screenPos.y / rect.height) * 2 + 1;

        const vector = new THREE.Vector3(x, y, 0);
        vector.unproject(this.camera);

        return {
            x: vector.x,
            y: vector.y
        };
    }

    private getScreenPosition(worldPos: Point): Point {
        const vector = new THREE.Vector3(worldPos.x, worldPos.y, 0);
        vector.project(this.camera);

        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: ((vector.x + 1) / 2) * rect.width,
            y: ((-vector.y + 1) / 2) * rect.height
        };
    }

    public resetTransform(): void {
        this.transform.scale = 1;
        this.camera.position.set(0, 0, 1000);
        this.camera.zoom = 1;
        this.camera.updateProjectionMatrix();
        
        this.eventManager.emit('canvas:transform-reset', {
            scale: 1,
            position: { x: 0, y: 0 }
        });
    }

    public dispose(): void {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
        }
        window.removeEventListener('resize', this.handleResize);
        
        // Dispose Three.js resources
        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (object.material instanceof THREE.Material) {
                    object.material.dispose();
                }
            }
        });
        
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    // Public API methods to match previous interface
    public getAbsolutePosition(screenPos: Point): Point {
        return this.getWorldPosition(screenPos);
    }

    public getRelativePosition(worldPos: Point): Point {
        return this.getScreenPosition(worldPos);
    }

    public getCanvasOffset(): Point {
        return { 
            x: this.camera.position.x,
            y: this.camera.position.y
        };
    }

    public getZoom(): number {
        return this.transform.scale;
    }

    public setZoom(zoom: number, center?: Point): void {
        const newScale = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        if (newScale === this.transform.scale) return;
        
        this.transform.scale = newScale;
        this.camera.zoom = newScale;
        this.camera.updateProjectionMatrix();
        
        this.eventManager.emit('canvas:zoom', {
            scale: newScale,
            position: { x: this.camera.position.x, y: this.camera.position.y },
            pointer: center || {
                x: this.renderer.domElement.width / 2,
                y: this.renderer.domElement.height / 2
            }
        });
    }

    public updatePreview(previewData: any): void {
        this.previewGroup.clear();
        
        if (!previewData) return;

        if (previewData.type === 'wall') {
            const { start, end, thickness = 10 } = previewData;
            
            // Create preview wall
            const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0).normalize();
            const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
            const halfThickness = thickness / 2;

            // Create vertices for preview wall
            const vertices = [
                new THREE.Vector3(start.x + perpendicular.x * halfThickness, start.y + perpendicular.y * halfThickness, 0),
                new THREE.Vector3(start.x - perpendicular.x * halfThickness, start.y - perpendicular.y * halfThickness, 0),
                new THREE.Vector3(end.x + perpendicular.x * halfThickness, end.y + perpendicular.y * halfThickness, 0),
                new THREE.Vector3(end.x - perpendicular.x * halfThickness, end.y - perpendicular.y * halfThickness, 0)
            ];

            // Create preview geometry
            const geometry = new THREE.BufferGeometry();
            const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
            const positions = new Float32Array(vertices.flatMap(v => [v.x, v.y, v.z]));

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));

            // Create semi-transparent material
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x333333,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.5
            });

            const mesh = new THREE.Mesh(geometry, material);
            this.previewGroup.add(mesh);

            // Add outline
            const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
                vertices[0], vertices[2], vertices[3], vertices[1], vertices[0]
            ]);
            const outlineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x000000,
                linewidth: 1,
                transparent: true,
                opacity: 0.5
            });
            const outline = new THREE.Line(outlineGeometry, outlineMaterial);
            this.previewGroup.add(outline);
        } else if (previewData.type === 'node') {
            const { position, connectedWalls } = previewData;
            
            // Create preview node
            const radius = 5;
            const geometry = new THREE.CircleGeometry(radius, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x333333,
                transparent: true,
                opacity: 0.5
            });
            const circle = new THREE.Mesh(geometry, material);
            circle.position.set(position.x, position.y, 0);

            // Create outline
            const outlineGeometry = new THREE.EdgesGeometry(geometry);
            const outlineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x000000,
                linewidth: 1,
                transparent: true,
                opacity: 0.5
            });
            const outline = new THREE.Line(outlineGeometry, outlineMaterial);
            outline.position.set(position.x, position.y, 0);

            // Add node preview
            const nodeGroup = new THREE.Group();
            nodeGroup.add(circle);
            nodeGroup.add(outline);
            this.previewGroup.add(nodeGroup);

            // Add connected walls preview
            if (connectedWalls) {
                for (const wall of connectedWalls) {
                    const { start, end } = wall;
                    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0).normalize();
                    const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
                    const thickness = 10;
                    const halfThickness = thickness / 2;

                    const vertices = [
                        new THREE.Vector3(start.x + perpendicular.x * halfThickness, start.y + perpendicular.y * halfThickness, 0),
                        new THREE.Vector3(start.x - perpendicular.x * halfThickness, start.y - perpendicular.y * halfThickness, 0),
                        new THREE.Vector3(end.x + perpendicular.x * halfThickness, end.y + perpendicular.y * halfThickness, 0),
                        new THREE.Vector3(end.x - perpendicular.x * halfThickness, end.y - perpendicular.y * halfThickness, 0)
                    ];

                    const wallGeometry = new THREE.BufferGeometry();
                    const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
                    const positions = new Float32Array(vertices.flatMap(v => [v.x, v.y, v.z]));

                    wallGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    wallGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

                    const wallMaterial = new THREE.MeshBasicMaterial({ 
                        color: 0x333333,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.3
                    });

                    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
                    this.previewGroup.add(wallMesh);

                    // Add wall outline
                    const wallOutlineGeometry = new THREE.BufferGeometry().setFromPoints([
                        vertices[0], vertices[2], vertices[3], vertices[1], vertices[0]
                    ]);
                    const wallOutlineMaterial = new THREE.LineBasicMaterial({ 
                        color: 0x000000,
                        linewidth: 1,
                        transparent: true,
                        opacity: 0.3
                    });
                    const wallOutline = new THREE.Line(wallOutlineGeometry, wallOutlineMaterial);
                    this.previewGroup.add(wallOutline);
                }
            }
        }
    }
} 