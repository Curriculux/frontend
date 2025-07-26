'use client';

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { PenTool, Eraser, Save, Trash2, Download, Undo, Redo, Square, Circle, Minus, ArrowUpRight } from 'lucide-react';
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
  const [tool, setTool] = useState<'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow'>('pen');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [color, setColor] = useState('#000000');
  const [paths, setPaths] = useState<Path[]>([]);
  const [redoPaths, setRedoPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  
  // Shape drawing state
  const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);
  const [shapePreview, setShapePreview] = useState<Path | null>(null);

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
  
  const { toast } = useToast();

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw background if exists
    if (backgroundImageLoaded && backgroundImage) {
      loadBackgroundImage(ctx, canvas); // Re-use loadBackgroundImage to handle image loading
    }
    
    setPaths([]);
    setRedoPaths([]);
    setCurrentPath([]);
    setRemoteCurrentPaths({}); // Clear remote drawing paths
    setShapeStartPoint(null);
    setShapePreview(null);
    
    // Send clear event to other participants
    if (isCollaborative && webrtcManager && isHost) {
      webrtcManager.clearWhiteboard();
      onClearEvent?.();
    }
  };

  const undo = () => {
    if (paths.length === 0) return;
    
    const lastPath = paths[paths.length - 1];
    setPaths(prev => prev.slice(0, -1));
    setRedoPaths(prev => [...prev, lastPath]);
    
    redrawCanvas();
    
    // Send undo event to other participants
    if (isCollaborative && webrtcManager && isHost) {
      webrtcManager.undoWhiteboard();
      onUndoEvent?.();
    }
  };

  const redo = () => {
    if (redoPaths.length === 0) return;
    
    const pathToRedo = redoPaths[redoPaths.length - 1];
    setRedoPaths(prev => prev.slice(0, -1));
    setPaths(prev => [...prev, pathToRedo]);
    
    redrawCanvas();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd key combinations
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isCtrlOrCmd && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw background if exists
    if (backgroundImageLoaded && backgroundImage) {
      loadBackgroundImage(ctx, canvas);
    }
    
    // Redraw all permanent paths
    paths.forEach(path => {
      if (path.tool === 'rectangle' || path.tool === 'circle' || path.tool === 'line' || path.tool === 'arrow') {
        // Draw shapes
        if (path.startPoint && path.endPoint) {
          drawShape(ctx, path);
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

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isHost && isCollaborative) return; // Only host can draw in collaborative mode
    
    setIsDrawing(true);
    setRedoPaths([]); // Clear redo stack when new drawing starts
    
    // Generate new path ID for this drawing session
    currentPathId.current = Date.now();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const point: Point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    
    // Handle shape tools differently
    if (['rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
      setShapeStartPoint(point);
      setShapePreview(null);
    } else {
      setCurrentPath([point]);
    }
  }, [isHost, isCollaborative, tool]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || (!isHost && isCollaborative)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const point: Point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

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
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    // Handle shape completion
    if (['rectangle', 'circle', 'line', 'arrow'].includes(tool) && shapeStartPoint && shapePreview) {
      const newPath: Path = {
        points: [],
        tool: tool as 'rectangle' | 'circle' | 'line' | 'arrow',
        color,
        strokeWidth,
        startPoint: shapeStartPoint,
        endPoint: shapePreview.endPoint
      };
      
      setPaths(prev => [...prev, newPath]);
      setShapeStartPoint(null);
      setShapePreview(null);
      
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
    } else if (currentPath.length > 0) {
      // Handle pen/eraser completion
      const newPath: Path = {
        points: currentPath,
        tool,
        color,
        strokeWidth
      };
      
      setPaths(prev => [...prev, newPath]);
      
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
    
    setCurrentPath([]);
    currentPathId.current = null;
  }, [isDrawing, currentPath, tool, color, strokeWidth, shapeStartPoint, shapePreview, isCollaborative, webrtcManager, isHost, onDrawingEvent]);

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
    // Don't process our own drawing events if we're the host
    if (isHost && isCollaborative) return;
    
    const canvas = canvasRef.current;
    if (!canvas || !drawingData) return;

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
      setPaths(prev => [...prev, drawingData.path]);
      
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
      
      setPaths(prev => [...prev, drawingData.path]);
      
      setTimeout(() => {
        redrawCanvas();
      }, 10);
    }
  }, [redrawCanvas, isHost, isCollaborative]);

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
    
    setPaths([]);
    setRedoPaths([]);
    setCurrentPath([]);
    setRemoteCurrentPaths({}); // Clear remote drawing paths
    setShapeStartPoint(null);
    setShapePreview(null);
  }, [backgroundImageLoaded, backgroundImage, loadBackgroundImage]);

  const handleRemoteUndo = useCallback(() => {
    console.log('↩️ Executing remote undo');
    if (paths.length === 0) return;
    
    const lastPath = paths[paths.length - 1];
    setPaths(prev => prev.slice(0, -1));
    setRedoPaths(prev => [...prev, lastPath]);
    
    // Redraw after undo
    setTimeout(() => {
      redrawCanvas();
    }, 10);
  }, [paths, redrawCanvas]);

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
      console.log('↩️ Executing remote undo via ref');
      setPaths(prev => {
        if (prev.length === 0) return prev;
        const lastPath = prev[prev.length - 1];
        setRedoPaths(current => [...current, lastPath]);
        const newPaths = prev.slice(0, -1);
        setTimeout(() => redrawCanvas(), 10);
        return newPaths;
      });
    }
  }), [redrawCanvas, backgroundImageLoaded, backgroundImage, loadBackgroundImage]);

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
        <Button 
          variant="outline" 
          size="sm" 
          onClick={undo}
          disabled={paths.length === 0}
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo className="h-4 w-4 mr-1" />
          Undo
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={redo}
          disabled={redoPaths.length === 0}
          title="Redo (Ctrl/Cmd+Y)"
        >
          <Redo className="h-4 w-4 mr-1" />
          Redo
        </Button>
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
                   ['rectangle', 'circle', 'line', 'arrow'].includes(tool) ? 'crosshair' : 'default' 
          }}
        />
      </div>
    </div>
  );
}); 