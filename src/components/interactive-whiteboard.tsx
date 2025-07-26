'use client';

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { PenTool, Eraser, Save, Trash2, Download, Square, Circle, Minus, ArrowUpRight, Undo, Redo, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Point {
  x: number;
  y: number;
}

interface Path {
  points: Point[];
  tool: 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow';
  color: string;
  strokeWidth: number;
  startPoint?: Point; // For shapes
  endPoint?: Point; // For shapes
  id?: string; // Add unique ID for each path
  selected?: boolean; // For selection state
}

// History state interface for undo/redo functionality
interface HistoryState {
  paths: Path[];
  timestamp: number;
}

interface InteractiveWhiteboardProps {
  className?: string;
  onSave?: (dataUrl: string) => void;
  height?: string;
  backgroundImage?: string;
  // Real-time collaboration props
  webrtcManager?: any; // WebRTCManager instance
  isCollaborative?: boolean;
  isHost?: boolean;
  onDrawingEvent?: (drawingData: any) => void;
  onClearEvent?: () => void;
  onUndoEvent?: () => void;
}

interface InteractiveWhiteboardMethods {
  handleRemoteDrawing: (drawingData: any) => void;
  handleRemoteClear: () => void;
  handleRemoteUndo: () => void;
  handleRemoteRedo: () => void;
}

const PRESET_COLORS = [
  '#000000', // Black
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#008000', // Dark Green
  '#800000', // Maroon
  '#000080', // Navy
];

export const InteractiveWhiteboard = forwardRef<InteractiveWhiteboardMethods, InteractiveWhiteboardProps>(({
  className,
  onSave,
  height = '500px',
  backgroundImage,
  webrtcManager,
  isCollaborative = false,
  isHost = true,
  onDrawingEvent,
  onClearEvent,
  onUndoEvent,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'move'>('pen');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [color, setColor] = useState('#000000');
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  
  // Undo/Redo history management
  const [history, setHistory] = useState<HistoryState[]>([{ paths: [], timestamp: Date.now() }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const maxHistorySize = 50; // Limit history to prevent memory issues
  
  // Shape drawing state
  const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);
  const [shapePreview, setShapePreview] = useState<Path | null>(null);

  // Move tool state
  const [selectedPath, setSelectedPath] = useState<Path | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  // Real-time collaboration state
  const [isRemoteDrawing, setIsRemoteDrawing] = useState(false);
  const [remoteDrawingData, setRemoteDrawingData] = useState<any>(null);
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);
  
  // State to track remote drawing paths
  const [remoteCurrentPaths, setRemoteCurrentPaths] = useState<{ [pathId: string]: { points: Point[], tool: string, color: string, strokeWidth: number } }>({});
  
  // Throttling for drawing events
  const lastDrawEventTime = useRef(0);
  const drawEventThrottle = 50; // Only send events every 50ms
  const currentPathId = useRef<number | null>(null);
  
  // Flag to prevent automatic redraws during manual operations
  const preventRedraw = useRef(false);
  
  const { toast } = useToast();

  // Generate unique ID for paths
  const generatePathId = () => `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Hit detection for paths and shapes
  const hitTestPath = useCallback((path: Path, point: Point): boolean => {
    const tolerance = Math.max(10, path.strokeWidth + 5); // Minimum 10px tolerance

    if (path.tool === 'rectangle' || path.tool === 'circle' || path.tool === 'line' || path.tool === 'arrow') {
      // Hit test for shapes
      if (!path.startPoint || !path.endPoint) return false;

      const { startPoint, endPoint } = path;

      if (path.tool === 'rectangle') {
        const left = Math.min(startPoint.x, endPoint.x);
        const right = Math.max(startPoint.x, endPoint.x);
        const top = Math.min(startPoint.y, endPoint.y);
        const bottom = Math.max(startPoint.y, endPoint.y);
        
        // Check if point is on the border of rectangle
        const onLeftEdge = Math.abs(point.x - left) < tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance;
        const onRightEdge = Math.abs(point.x - right) < tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance;
        const onTopEdge = Math.abs(point.y - top) < tolerance && point.x >= left - tolerance && point.x <= right + tolerance;
        const onBottomEdge = Math.abs(point.y - bottom) < tolerance && point.x >= left - tolerance && point.x <= right + tolerance;
        
        return onLeftEdge || onRightEdge || onTopEdge || onBottomEdge;
      } else if (path.tool === 'circle') {
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;
        const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
        const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;
        
        // Check if point is on the circle edge
        const normalizedX = (point.x - centerX) / radiusX;
        const normalizedY = (point.y - centerY) / radiusY;
        const distanceFromEdge = Math.abs(Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY) - 1);
        
        return distanceFromEdge * Math.min(radiusX, radiusY) < tolerance;
      } else if (path.tool === 'line' || path.tool === 'arrow') {
        // Distance from point to line segment
        const A = point.x - startPoint.x;
        const B = point.y - startPoint.y;
        const C = endPoint.x - startPoint.x;
        const D = endPoint.y - startPoint.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B) < tolerance;
        
        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));
        
        const xx = startPoint.x + param * C;
        const yy = startPoint.y + param * D;
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        
        return Math.sqrt(dx * dx + dy * dy) < tolerance;
      }
    } else {
      // Hit test for freehand paths
      if (path.points.length < 2) return false;
      
      for (let i = 0; i < path.points.length - 1; i++) {
        const start = path.points[i];
        const end = path.points[i + 1];
        
        const A = point.x - start.x;
        const B = point.y - start.y;
        const C = end.x - start.x;
        const D = end.y - start.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) continue;
        
        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));
        
        const xx = start.x + param * C;
        const yy = start.y + param * D;
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        
        if (Math.sqrt(dx * dx + dy * dy) < tolerance) {
          return true;
        }
      }
    }
    
    return false;
  }, []);

  // Find path at point
  const findPathAtPoint = useCallback((point: Point): Path | null => {
    // Search from last to first (top to bottom in drawing order)
    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      if (hitTestPath(path, point)) {
        return path;
      }
    }
    return null;
  }, [paths, hitTestPath]);



  // Save current state to history
  const saveToHistory = useCallback((newPaths: Path[]) => {
    setHistory(prevHistory => {
      const newState: HistoryState = {
        paths: [...newPaths],
        timestamp: Date.now()
      };
      
      // Remove any states after current index (when undoing then making new changes)
      const truncatedHistory = prevHistory.slice(0, historyIndex + 1);
      
      // Add new state
      const updatedHistory = [...truncatedHistory, newState];
      
      // Limit history size
      if (updatedHistory.length > maxHistorySize) {
        return updatedHistory.slice(-maxHistorySize);
      }
      
      return updatedHistory;
    });
    
    setHistoryIndex(prevIndex => {
      const newIndex = Math.min(historyIndex + 1, maxHistorySize - 1);
      return newIndex;
    });
  }, [historyIndex]);

  // Undo functionality
  const undo = useCallback((isRemote = false) => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      
      setHistoryIndex(newIndex);
      setPaths(previousState.paths);
      setCurrentPath([]);
      setShapeStartPoint(null);
      setShapePreview(null);
      
      // Send undo event to other participants only if this is not a remote call
      if (isCollaborative && webrtcManager && isHost && !isRemote) {
        // Send the complete state to remote participants
        const undoData = {
          type: 'undo',
          newState: previousState,
          timestamp: Date.now()
        };
        webrtcManager.sendWhiteboardDraw(undoData);
        onUndoEvent?.();
      }
      
      toast({ 
        title: 'Undone', 
        description: 'Last action was undone'
      });
    }
  }, [historyIndex, history, isCollaborative, webrtcManager, isHost, onUndoEvent, toast]);

  // Redo functionality
  const redo = useCallback((isRemote = false) => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      
      setHistoryIndex(newIndex);
      setPaths(nextState.paths);
      setCurrentPath([]);
      setShapeStartPoint(null);
      setShapePreview(null);
      
      // Send redo event to other participants only if this is not a remote call
      if (isCollaborative && webrtcManager && isHost && !isRemote) {
        // Send the complete state to remote participants
        const redoData = {
          type: 'redo',
          newState: nextState,
          timestamp: Date.now()
        };
        webrtcManager.sendWhiteboardDraw(redoData);
      }
      
      toast({ 
        title: 'Redone', 
        description: 'Action was redone'
      });
    }
  }, [historyIndex, history, isCollaborative, webrtcManager, isHost, toast]);

  // Button click handlers
  const handleUndoClick = useCallback(() => undo(false), [undo]);
  const handleRedoClick = useCallback(() => redo(false), [redo]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo(false);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw background if exists
    if (backgroundImageLoaded && backgroundImage) {
      loadBackgroundImage(ctx, canvas);
    }
    
    const newPaths: Path[] = [];
    setPaths(newPaths);
    setCurrentPath([]);
    setRemoteCurrentPaths({});
    setShapeStartPoint(null);
    setShapePreview(null);
    
    // Save clear action to history
    saveToHistory(newPaths);
    
    // Send clear event to other participants
    if (isCollaborative && webrtcManager && isHost) {
      webrtcManager.clearWhiteboard();
      onClearEvent?.();
    }
  };



  // Function to load background image
  const loadBackgroundImage = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Reset any transformations before drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    if (!backgroundImage) {
      // Set canvas background to white
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setBackgroundImageLoaded(true);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Clear canvas and draw background image
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Reset drawing properties after background image load
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      setBackgroundImageLoaded(true);
    };
    img.onerror = () => {
      console.warn('Failed to load background image, using white background');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Reset drawing properties after error fallback
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      setBackgroundImageLoaded(true);
    };
    img.src = backgroundImage;
  }, [backgroundImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial canvas properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Resize canvas to fill container
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      
      // Ensure we have valid dimensions
      const newWidth = Math.max(rect.width, 800); // Minimum width
      const newHeight = Math.max(rect.height, 600); // Minimum height
      
      // Skip if canvas already has these dimensions
      if (canvas.width === newWidth && canvas.height === newHeight) return;
      
      // Save current content (only if canvas has valid dimensions and no background image loading)
      let imageData = null;
      if (canvas.width > 0 && canvas.height > 0 && backgroundImageLoaded) {
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
          console.warn('Could not save canvas content during resize:', e);
        }
      }

      // Resize
      canvas.width = newWidth;
      canvas.height = newHeight;

      // Load background (either image or white)
      loadBackgroundImage(ctx, canvas);

      // Reset drawing properties after background load
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Restore content if we have it
      if (imageData) {
        try {
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          console.warn('Could not restore canvas content after resize:', e);
        }
      }
      
      // Reset drawing properties
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    // Initial resize with a slight delay to ensure parent is rendered
    const timeoutId = setTimeout(resize, 100);
    window.addEventListener('resize', resize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Effect to load background image when it changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width > 0 && canvas.height > 0) {
      loadBackgroundImage(ctx, canvas);
    }
  }, [backgroundImage, loadBackgroundImage]);

  // Helper function to draw shapes
  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: Path) => {
    if (!shape.startPoint || !shape.endPoint) return;

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';

    const { startPoint, endPoint } = shape;
    const width = endPoint.x - startPoint.x;
    const height = endPoint.y - startPoint.y;

    ctx.beginPath();
    
    switch (shape.tool) {
      case 'rectangle':
        ctx.rect(startPoint.x, startPoint.y, width, height);
        break;
      case 'circle':
        const radius = Math.sqrt(width * width + height * height) / 2;
        const centerX = startPoint.x + width / 2;
        const centerY = startPoint.y + height / 2;
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        break;
      case 'line':
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        break;
      case 'arrow':
        // Draw line
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        
        // Draw arrowhead
        const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;
        
        ctx.moveTo(endPoint.x, endPoint.y);
        ctx.lineTo(
          endPoint.x - arrowLength * Math.cos(angle - arrowAngle),
          endPoint.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(endPoint.x, endPoint.y);
        ctx.lineTo(
          endPoint.x - arrowLength * Math.cos(angle + arrowAngle),
          endPoint.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        break;
    }
    
    ctx.stroke();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log('🎨 redrawCanvas: Drawing', paths.length, 'paths');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw background if exists
    if (backgroundImageLoaded && backgroundImage) {
      loadBackgroundImage(ctx, canvas);
    }
    
    // Redraw all permanent paths
    paths.forEach(path => {
      // Set selection styling
      const isSelected = path.selected || path === selectedPath;
      
      if (path.tool === 'rectangle' || path.tool === 'circle' || path.tool === 'line' || path.tool === 'arrow') {
        // Draw shapes
        if (path.startPoint && path.endPoint) {
          drawShape(ctx, path);
          
          // Draw selection highlight
          if (isSelected) {
            ctx.save();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#007bff';
            ctx.lineWidth = 2;
            ctx.globalCompositeOperation = 'source-over';
            drawShape(ctx, path);
            ctx.restore();
          }
        }
      } else {
        // Draw freehand paths
        if (path.points.length < 2) return;
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (path.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = path.strokeWidth * 3;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = path.color;
          ctx.lineWidth = path.strokeWidth;
        }
        
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        
        ctx.stroke();
        
        // Draw selection highlight for freehand paths
        if (isSelected && path.tool !== 'eraser') {
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = '#007bff';
          ctx.lineWidth = Math.max(2, path.strokeWidth + 2);
          ctx.globalCompositeOperation = 'source-over';
          
          ctx.beginPath();
          ctx.moveTo(path.points[0].x, path.points[0].y);
          
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
          }
          
          ctx.stroke();
          ctx.restore();
        }
      }
    });
    
    // Redraw active remote paths (for real-time collaboration)
    Object.values(remoteCurrentPaths).forEach(remotePath => {
      // Handle remote shape previews
      if ((remotePath as any).isShape && (remotePath as any).startPoint && (remotePath as any).endPoint) {
        const shapePreview: Path = {
          points: [],
          tool: remotePath.tool as any,
          color: remotePath.color,
          strokeWidth: remotePath.strokeWidth,
          startPoint: (remotePath as any).startPoint,
          endPoint: (remotePath as any).endPoint
        };
        drawShape(ctx, shapePreview);
        return;
      }
      
      // Handle regular drawing paths
      if (remotePath.points.length < 2) return;
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (remotePath.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = remotePath.strokeWidth * 3;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = remotePath.color;
        ctx.lineWidth = remotePath.strokeWidth;
      }
      
      ctx.beginPath();
      ctx.moveTo(remotePath.points[0].x, remotePath.points[0].y);
      
      for (let i = 1; i < remotePath.points.length; i++) {
        ctx.lineTo(remotePath.points[i].x, remotePath.points[i].y);
      }
      
      ctx.stroke();
    });
  }, [paths, backgroundImageLoaded, backgroundImage, loadBackgroundImage, remoteCurrentPaths, drawShape]);

  // Trigger redraw when paths change (for undo/redo)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    console.log('🔄 historyIndex useEffect triggered, index:', historyIndex, 'preventRedraw:', preventRedraw.current);
    
    // Skip redraw if we're in the middle of a manual operation
    if (preventRedraw.current) {
      console.log('🔄 Skipping redraw due to preventRedraw flag');
      return;
    }
    
    // Only redraw for undo/redo operations, not for normal drawing operations
    // This prevents interference with real-time drawing
    console.log('🔄 Calling redrawCanvas from historyIndex useEffect');
    redrawCanvas();
  }, [historyIndex]);

  // Trigger redraw when paths change (for eraser and other path modifications)
  useEffect(() => {
    console.log('🔄 paths useEffect triggered, paths count:', paths.length);
    redrawCanvas();
  }, [paths, redrawCanvas]);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isHost && isCollaborative) return; // Only host can draw in collaborative mode
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const point: Point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

    // Handle different tools
    if (tool === 'eraser') {
      // Smart eraser: find and delete entire path
      const pathToDelete = findPathAtPoint(point);
      console.log('🧹 Eraser action, isHost:', isHost, 'pathToDelete:', pathToDelete?.id, 'timestamp:', Date.now());
      
      if (pathToDelete) {
        // Simply update the state - useEffect will handle redraw
        setPaths(currentPaths => {
          const newPaths = currentPaths.filter(p => p !== pathToDelete);
          console.log('🧹 Eraser: setPaths called, before:', currentPaths.length, 'after:', newPaths.length);
          saveToHistory(newPaths);
          return newPaths;
        });
        
        // Send erase event to collaborators
        if (isCollaborative && webrtcManager && isHost) {
          const eraseData = {
            type: 'path-delete',
            pathId: pathToDelete.id,
            timestamp: Date.now()
          };
          webrtcManager.sendWhiteboardDraw(eraseData);
          onDrawingEvent?.(eraseData);
        }
        
        toast({
          title: 'Erased',
          description: 'Path removed'
        });
      }
      return;
    } else if (tool === 'move') {
      // Move tool: select path for moving
      const pathToMove = findPathAtPoint(point);
      if (pathToMove) {
        setSelectedPath(pathToMove);
        setIsDragging(true);
        
        // Calculate offset for smooth dragging
        if (pathToMove.tool === 'rectangle' || pathToMove.tool === 'circle' || pathToMove.tool === 'line' || pathToMove.tool === 'arrow') {
          // For shapes, use startPoint as reference
          if (pathToMove.startPoint) {
            setDragOffset({
              x: point.x - pathToMove.startPoint.x,
              y: point.y - pathToMove.startPoint.y
            });
          }
        } else {
          // For freehand paths, use first point as reference
          if (pathToMove.points.length > 0) {
            setDragOffset({
              x: point.x - pathToMove.points[0].x,
              y: point.y - pathToMove.points[0].y
            });
          }
        }
        
        setTimeout(() => redrawCanvas(), 0);
        return;
      } else {
        // Clicked empty area, deselect
        setSelectedPath(null);
        setTimeout(() => redrawCanvas(), 0);
        return;
      }
    }
    
    // Regular drawing tools
    setIsDrawing(true);
    
    // Generate new path ID for this drawing session
    currentPathId.current = Date.now();
    
    // Handle shape tools differently
    if (['rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
      setShapeStartPoint(point);
      setShapePreview(null);
    } else {
      setCurrentPath([point]);
    }
  }, [isHost, isCollaborative, tool]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const point: Point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

    // Handle move tool dragging
    if (tool === 'move' && isDragging && selectedPath) {
      const newPosition = {
        x: point.x - dragOffset.x,
        y: point.y - dragOffset.y
      };
      
      // Update the path position
      const updatedPaths = paths.map(path => {
        if (path === selectedPath) {
          const updatedPath = { ...path };
          
          if (path.tool === 'rectangle' || path.tool === 'circle' || path.tool === 'line' || path.tool === 'arrow') {
            // For shapes, move both start and end points
            if (path.startPoint && path.endPoint) {
              const deltaX = newPosition.x - path.startPoint.x;
              const deltaY = newPosition.y - path.startPoint.y;
              
              updatedPath.startPoint = { ...newPosition };
              updatedPath.endPoint = {
                x: path.endPoint.x + deltaX,
                y: path.endPoint.y + deltaY
              };
            }
          } else {
            // For freehand paths, move all points
            if (path.points.length > 0) {
              const deltaX = newPosition.x - path.points[0].x;
              const deltaY = newPosition.y - path.points[0].y;
              
              updatedPath.points = path.points.map(p => ({
                x: p.x + deltaX,
                y: p.y + deltaY
              }));
            }
          }
          
          return updatedPath;
        }
        return path;
      });
      
      setPaths(updatedPaths);
      setTimeout(() => redrawCanvas(), 0);
      
      // Send move event to collaborators
      if (isCollaborative && webrtcManager && isHost) {
        const moveData = {
          type: 'path-move',
          pathId: selectedPath.id,
          newPosition,
          timestamp: Date.now()
        };
        webrtcManager.sendWhiteboardDraw(moveData);
        onDrawingEvent?.(moveData);
      }
      
      return;
    }

    if (!isDrawing || (!isHost && isCollaborative)) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle shape tools
    if (['rectangle', 'circle', 'line', 'arrow'].includes(tool) && shapeStartPoint) {
      // Clear canvas and redraw everything including shape preview
      redrawCanvas();
      
      // Draw shape preview
      const previewShape: Path = {
        points: [],
        tool: tool as 'rectangle' | 'circle' | 'line' | 'arrow',
        color,
        strokeWidth,
        startPoint: shapeStartPoint,
        endPoint: point
      };
      
      setShapePreview(previewShape);
      drawShape(ctx, previewShape);
      
      // Send shape preview to other participants for real-time collaboration
      if (isCollaborative && webrtcManager && isHost && currentPathId.current) {
        const now = Date.now();
        const timeSinceLastEvent = now - lastDrawEventTime.current;
        
        // Throttle shape preview events
        if (timeSinceLastEvent >= drawEventThrottle) {
          lastDrawEventTime.current = now;
          const drawingData = {
            type: 'shape-preview',
            shape: previewShape,
            pathId: currentPathId.current
          };
          
          setTimeout(() => {
            webrtcManager.sendWhiteboardDraw(drawingData);
            onDrawingEvent?.(drawingData);
          }, 0);
        }
      }
      
      return;
    }

    // Handle pen and eraser tools
    if (tool === 'pen' || tool === 'eraser') {
      // Update current path and draw immediately
      setCurrentPath(prev => {
        const newPath = [...prev, point];
        
        // Draw the line immediately using the new path
        if (newPath.length >= 2) {
          const lastPoint = newPath[newPath.length - 2]; // Previous point
          const currentPoint = newPath[newPath.length - 1]; // Current point
          
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = strokeWidth * 3;
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
          }

          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(currentPoint.x, currentPoint.y);
          ctx.stroke();
        }
        
        return newPath;
      });
    }
  }, [isDrawing, isHost, isCollaborative, tool, color, strokeWidth, shapeStartPoint, redrawCanvas, drawShape]);

  // Send drawing events after state updates (not during render)
  useEffect(() => {
    if (!isCollaborative || !webrtcManager || !isHost || currentPath.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastEvent = now - lastDrawEventTime.current;
    
    // Only send events if enough time has passed (throttling)
    if (timeSinceLastEvent < drawEventThrottle) return;
    
    lastDrawEventTime.current = now;
    const latestPoint = currentPath[currentPath.length - 1];
    const drawingData = {
      type: 'draw',
      point: latestPoint,
      tool,
      color,
      strokeWidth,
      pathId: currentPathId.current
    };
    
    // Use setTimeout to avoid calling during render
    const timeoutId = setTimeout(() => {
      webrtcManager.sendWhiteboardDraw(drawingData);
      onDrawingEvent?.(drawingData);
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentPath, tool, color, strokeWidth, isCollaborative, webrtcManager, isHost, onDrawingEvent]);

  const stopDrawing = useCallback(() => {
    // Handle move tool
    if (tool === 'move' && isDragging) {
      setIsDragging(false);
      
      // Save to history after move is complete
      if (selectedPath) {
        saveToHistory(paths);
        
        toast({
          title: 'Moved',
          description: 'Object moved successfully'
        });
      }
      return;
    }
    
    if (!isDrawing) return;
    
    setIsDrawing(false);
    let shouldSaveToHistory = false;
    let newPaths = paths;
    
    // Handle shape completion
    if (['rectangle', 'circle', 'line', 'arrow'].includes(tool) && shapeStartPoint && shapePreview) {
      const newPath: Path = {
        points: [],
        tool: tool as 'rectangle' | 'circle' | 'line' | 'arrow',
        color,
        strokeWidth,
        startPoint: shapeStartPoint,
        endPoint: shapePreview.endPoint,
        id: generatePathId()
      };
      
      newPaths = [...paths, newPath];
      setPaths(newPaths);
      setShapeStartPoint(null);
      setShapePreview(null);
      shouldSaveToHistory = true;
      
      // Send shape completion event for collaborative drawing
      if (isCollaborative && webrtcManager && isHost && currentPathId.current) {
        const drawingData = {
          type: 'shape-complete',
          path: newPath,
          pathId: currentPathId.current
        };
        
        setTimeout(() => {
          webrtcManager.sendWhiteboardDraw(drawingData);
          onDrawingEvent?.(drawingData);
        }, 0);
      }
    } else if (currentPath.length > 0 && tool !== 'move') {
      // Handle pen/eraser completion
      const newPath: Path = {
        points: currentPath,
        tool: tool as 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow',
        color,
        strokeWidth,
        id: generatePathId()
      };
      
      newPaths = [...paths, newPath];
      setPaths(newPaths);
      shouldSaveToHistory = true;
      
      // Send path completion event for collaborative drawing
      if (isCollaborative && webrtcManager && isHost && currentPathId.current) {
        const drawingData = {
          type: 'path-complete',
          path: newPath,
          pathId: currentPathId.current
        };
        
        setTimeout(() => {
          webrtcManager.sendWhiteboardDraw(drawingData);
          onDrawingEvent?.(drawingData);
        }, 0);
      }
    }
    
    // Save to history if a new path was added
    if (shouldSaveToHistory) {
      saveToHistory(newPaths);
    }
    
    setCurrentPath([]);
    currentPathId.current = null;
  }, [isDrawing, currentPath, tool, color, strokeWidth, shapeStartPoint, shapePreview, isCollaborative, webrtcManager, isHost, onDrawingEvent, paths, saveToHistory]);

  const getCoordinates = (
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate the position relative to the canvas
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Scale coordinates to match internal canvas dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    // Debug logging for coordinate issues
    if (scaledX < 0 || scaledY < 0 || scaledX > canvas.width || scaledY > canvas.height) {
      console.warn('Coordinate out of bounds:', {
        original: { x, y },
        scaled: { x: scaledX, y: scaledY },
        canvasSize: { width: canvas.width, height: canvas.height },
        rectSize: { width: rect.width, height: rect.height },
        scale: { x: scaleX, y: scaleY }
      });
    }

    return { 
      x: scaledX, 
      y: scaledY 
    };
  };

  // Handle remote drawing events
  const handleRemoteDrawing = useCallback((drawingData: any) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingData) return;
    
    // Don't process drawing events if we're the host, but allow deletion/move events
    if (isHost && isCollaborative && 
        !['path-delete', 'path-move', 'undo', 'redo'].includes(drawingData.type)) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log('🎨 Processing remote drawing:', drawingData.type);

    if (drawingData.type === 'draw') {
      // Handle real-time drawing updates for remote participants only
      const pathId = drawingData.pathId;
      
      setRemoteCurrentPaths(prev => {
        const existing = prev[pathId] || { 
          points: [], 
          tool: drawingData.tool, 
          color: drawingData.color, 
          strokeWidth: drawingData.strokeWidth 
        };
        
        const newPath = {
          ...existing,
          points: [...existing.points, drawingData.point]
        };
        
        // Draw the line immediately for real-time feedback
        if (newPath.points.length >= 2) {
          const lastPoint = newPath.points[newPath.points.length - 2];
          const currentPoint = newPath.points[newPath.points.length - 1];
          
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (drawingData.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = drawingData.strokeWidth * 3;
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = drawingData.color;
            ctx.lineWidth = drawingData.strokeWidth;
          }

          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(currentPoint.x, currentPoint.y);
          ctx.stroke();
        }
        
        return {
          ...prev,
          [pathId]: newPath
        };
      });
    } else if (drawingData.type === 'path-complete') {
      // Clean up the temporary remote path and add to permanent paths
      console.log('✅ Adding remote path:', drawingData.path);
      
      // Clear the real-time drawing path first
      setRemoteCurrentPaths(prev => {
        const { [drawingData.pathId]: removedPath, ...rest } = prev;
        return rest;
      });
      
      // Add the completed path to permanent paths
      setPaths(prev => {
        const newPaths = [...prev, drawingData.path];
        // Save to history for non-host participants
        if (!isHost) {
          setTimeout(() => saveToHistory(newPaths), 20);
        }
        return newPaths;
      });
      
      // Redraw entire canvas to ensure clean state and remove any temporary strokes
      setTimeout(() => {
        redrawCanvas();
      }, 10);
    } else if (drawingData.type === 'shape-preview') {
      // Handle remote shape preview for real-time feedback
      console.log('👁️ Showing remote shape preview:', drawingData.shape);
      
      // Store the preview shape with pathId
      setRemoteCurrentPaths(prev => ({
        ...prev,
        [`shape-${drawingData.pathId}`]: {
          points: [],
          tool: drawingData.shape.tool,
          color: drawingData.shape.color,
          strokeWidth: drawingData.shape.strokeWidth,
          startPoint: drawingData.shape.startPoint,
          endPoint: drawingData.shape.endPoint,
          isShape: true
        }
      }));
      
      // Redraw to show the preview
      setTimeout(() => {
        redrawCanvas();
      }, 10);
    } else if (drawingData.type === 'shape-complete') {
      // Handle remote shape completion
      console.log('✅ Adding remote shape:', drawingData.path);
      
      // Remove the preview first
      setRemoteCurrentPaths(prev => {
        const { [`shape-${drawingData.pathId}`]: removedPreview, ...rest } = prev;
        return rest;
      });
      
      setPaths(prev => {
        const newPaths = [...prev, drawingData.path];
        // Save to history for non-host participants
        if (!isHost) {
          setTimeout(() => saveToHistory(newPaths), 20);
        }
        return newPaths;
      });
      
      setTimeout(() => {
        redrawCanvas();
      }, 10);
    } else if (drawingData.type === 'undo') {
      // Handle remote undo - restore state
      console.log('↩️ Processing remote undo:', drawingData.newState);
      const newState = drawingData.newState;
      setPaths(newState.paths);
      setCurrentPath([]);
      setShapeStartPoint(null);
      setShapePreview(null);
      setRemoteCurrentPaths({});
      
      // Update history for non-host participants
      if (!isHost) {
        setHistory(prev => {
          const newHistory = [...prev];
          const currentIndex = newHistory.findIndex(state => 
            JSON.stringify(state.paths) === JSON.stringify(newState.paths)
          );
          if (currentIndex !== -1) {
            setHistoryIndex(currentIndex);
          }
          return newHistory;
        });
      }
    } else if (drawingData.type === 'redo') {
      // Handle remote redo - restore state
      console.log('🔄 Processing remote redo:', drawingData.newState);
      const newState = drawingData.newState;
      setPaths(newState.paths);
      setCurrentPath([]);
      setShapeStartPoint(null);
      setShapePreview(null);
      setRemoteCurrentPaths({});
      
      // Update history for non-host participants
      if (!isHost) {
        setHistory(prev => {
          const newHistory = [...prev];
          const currentIndex = newHistory.findIndex(state => 
            JSON.stringify(state.paths) === JSON.stringify(newState.paths)
          );
          if (currentIndex !== -1) {
            setHistoryIndex(currentIndex);
          }
          return newHistory;
                 });
       }
     } else if (drawingData.type === 'path-delete') {
       // Handle remote path deletion (smart eraser) - only for non-host participants
       console.log('🗑️ Received path-delete event, isHost:', isHost, 'pathId:', drawingData.pathId);
       if (!isHost) {
         console.log('🗑️ Processing remote path delete:', drawingData.pathId);
         setPaths(prev => prev.filter(p => p.id !== drawingData.pathId));
         setCurrentPath([]);
         setRemoteCurrentPaths({});
         
         // Update history for non-host participants
         setPaths(currentPaths => {
           const newPaths = currentPaths.filter(p => p.id !== drawingData.pathId);
           saveToHistory(newPaths);
           return currentPaths; // Don't actually change the state here
         });
       } else {
         console.log('🗑️ Ignoring path-delete event from host (own action)');
       }
     } else if (drawingData.type === 'path-move') {
       // Handle remote path move
       console.log('📦 Processing remote path move:', drawingData.pathId);
       setPaths(prev => prev.map(path => {
         if (path.id === drawingData.pathId) {
           const updatedPath = { ...path };
           const newPosition = drawingData.newPosition;
           
           if (path.tool === 'rectangle' || path.tool === 'circle' || path.tool === 'line' || path.tool === 'arrow') {
             // For shapes, move both start and end points
             if (path.startPoint && path.endPoint) {
               const deltaX = newPosition.x - path.startPoint.x;
               const deltaY = newPosition.y - path.startPoint.y;
               
               updatedPath.startPoint = { ...newPosition };
               updatedPath.endPoint = {
                 x: path.endPoint.x + deltaX,
                 y: path.endPoint.y + deltaY
               };
             }
           } else {
             // For freehand paths, move all points
             if (path.points.length > 0) {
               const deltaX = newPosition.x - path.points[0].x;
               const deltaY = newPosition.y - path.points[0].y;
               
               updatedPath.points = path.points.map(p => ({
                 x: p.x + deltaX,
                 y: p.y + deltaY
               }));
             }
           }
           
           return updatedPath;
         }
         return path;
       }));
       
       // Update history for non-host participants
       if (!isHost) {
         setTimeout(() => {
           setPaths(currentPaths => {
             saveToHistory(currentPaths);
             return currentPaths;
           });
         }, 20);
       }
     }
   }, [redrawCanvas, isHost, isCollaborative, saveToHistory]);

  const handleRemoteClear = useCallback(() => {
    console.log('🧹 Executing remote clear');
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (backgroundImageLoaded && backgroundImage) {
      loadBackgroundImage(ctx, canvas);
    }
    
    const newPaths: Path[] = [];
    setPaths(newPaths);
    setCurrentPath([]);
    setRemoteCurrentPaths({});
    setShapeStartPoint(null);
    setShapePreview(null);
    
    // Save clear action to history for non-host participants
    if (!isHost) {
      saveToHistory(newPaths);
    }
  }, [backgroundImageLoaded, backgroundImage, loadBackgroundImage, isHost, saveToHistory]);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    handleRemoteDrawing: (drawingData: any) => {
      console.log('🎨 Processing remote drawing via ref:', drawingData.type);
      handleRemoteDrawing(drawingData);
    },
    handleRemoteClear: () => {
      console.log('🧹 Executing remote clear via ref');
      handleRemoteClear();
    },
    handleRemoteUndo: () => {
      console.log('🔙 Executing remote undo via ref');
      undo(true);
    },
    handleRemoteRedo: () => {
      console.log('↩️ Executing remote redo via ref');
      redo(true);
    }
  }), [handleRemoteDrawing, handleRemoteClear, undo, redo]);

  // Set up WebRTC event listeners
  useEffect(() => {
    if (!isCollaborative || !webrtcManager) return;

    // Listen for remote drawing events through props or direct WebRTC callbacks
    // This will be connected when the whiteboard is activated
    
    return () => {
      // Cleanup WebRTC listeners if needed
    };
  }, [isCollaborative, webrtcManager]);

  const saveWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave?.(dataUrl);
    toast({ title: 'Whiteboard saved', description: 'Image ready to share' });
  };

  const downloadWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
    
    toast({ title: 'Downloaded', description: 'Whiteboard saved to your device' });
  };

  return (
    <div className={cn('flex flex-col bg-white rounded-lg shadow-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
        {/* Drawing Tools */}
        <Button
          variant={tool === 'pen' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('pen')}
        >
          <PenTool className="h-4 w-4 mr-1" />
          Pen
        </Button>
        <Button
          variant={tool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('eraser')}
        >
          <Eraser className="h-4 w-4 mr-1" />
          Eraser
        </Button>
        <Button
          variant={tool === 'move' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('move')}
        >
          <Move className="h-4 w-4 mr-1" />
          Move
        </Button>
        
        {/* Shape Tools */}
        <div className="border-l pl-2 ml-2 flex gap-1">
          <Button
            variant={tool === 'rectangle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('rectangle')}
            title="Rectangle"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === 'circle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('circle')}
            title="Circle"
          >
            <Circle className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === 'line' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('line')}
            title="Line"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === 'arrow' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('arrow')}
            title="Arrow"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Stroke Width */}
        <div className="border-l pl-2 ml-2">
          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="h-8 px-2 border rounded text-sm"
          >
            <option value={1}>Thin</option>
            <option value={2}>Medium</option>
            <option value={5}>Thick</option>
            <option value={8}>Very Thick</option>
          </select>
        </div>

        {/* Color Palette */}
        <div className="border-l pl-2 ml-2 flex items-center gap-1">
          <span className="text-sm text-gray-600">Color:</span>
          <div className="flex gap-1">
            {PRESET_COLORS.map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => setColor(presetColor)}
                className={cn(
                  "w-6 h-6 rounded border-2 hover:scale-110 transition-transform",
                  color === presetColor ? "border-gray-800 ring-2 ring-blue-500" : "border-gray-300"
                )}
                style={{ backgroundColor: presetColor }}
                title={presetColor}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded border-2 border-gray-300 cursor-pointer"
              title="Custom color"
            />
          </div>
        </div>

        <div className="flex-1" />
        
        {/* Action Buttons */}
        <Button variant="outline" size="sm" onClick={clearCanvas}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
        <Button variant="outline" size="sm" onClick={downloadWhiteboard}>
          <Download className="h-4 w-4 mr-1" />
          Download
        </Button>
        <Button size="sm" onClick={saveWhiteboard}>
          <Save className="h-4 w-4 mr-1" />
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={handleUndoClick}>
          <Undo className="h-4 w-4 mr-1" />
          Undo
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedoClick}>
          <Redo className="h-4 w-4 mr-1" />
          Redo
        </Button>
      </div>

      {/* Canvas Container */}
      <div 
        className="relative bg-gray-100 w-full min-h-[600px]" 
        style={{ height: height === '100%' ? '100%' : height }}
      >
        <canvas
          ref={canvasRef}
          key={backgroundImage || 'no-background'} // Force remount when background changes
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full touch-none bg-white border border-gray-200"
          style={{ 
            cursor: tool === 'eraser' ? 'crosshair' : 
                   tool === 'move' ? 'grab' :
                   ['rectangle', 'circle', 'line', 'arrow'].includes(tool) ? 'crosshair' : 'default' 
          }}
        />
      </div>
    </div>
  );
}); 