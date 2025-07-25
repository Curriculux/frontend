'use client';

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { PenTool, Eraser, Save, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Point {
  x: number;
  y: number;
}

interface Path {
  points: Point[];
  tool: 'pen' | 'eraser';
  color: string;
  strokeWidth: number;
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
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [color, setColor] = useState('#000000');
  const [paths, setPaths] = useState<Path[]>([]);
  const [redoPaths, setRedoPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  // Real-time collaboration state
  const [isRemoteDrawing, setIsRemoteDrawing] = useState(false);
  const [remoteDrawingData, setRemoteDrawingData] = useState<any>(null);
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);
  
  // Throttling for drawing events
  const lastDrawEventTime = useRef(0);
  const drawEventThrottle = 50; // Only send events every 50ms
  
  const { toast } = useToast();

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

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isHost && isCollaborative) return; // Only host can draw in collaborative mode
    
    setIsDrawing(true);
    setRedoPaths([]); // Clear redo stack when new drawing starts
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const point: Point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    
    setCurrentPath([point]);
  }, [isHost, isCollaborative]);

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

    setCurrentPath(prev => {
      const newPath = [...prev, point];
      return newPath;
    });

    // Draw the line immediately for local feedback
    const ctx = canvas.getContext('2d');
    if (!ctx || currentPath.length === 0) return;

    const lastPoint = currentPath[currentPath.length - 1];
    
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
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }, [isDrawing, isHost, isCollaborative, currentPath, tool, color, strokeWidth]);

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
      pathId: now
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
    
    if (currentPath.length > 0) {
      const newPath: Path = {
        points: currentPath,
        tool,
        color,
        strokeWidth
      };
      
      setPaths(prev => [...prev, newPath]);
    }
    
    setCurrentPath([]);
  }, [isDrawing, currentPath, tool, color, strokeWidth]);

  // Send path completion events after state updates
  useEffect(() => {
    if (!isCollaborative || !webrtcManager || !isHost || paths.length === 0) return;
    
    const lastPath = paths[paths.length - 1];
    if (!lastPath) return;
    
    const drawingData = {
      type: 'path-complete',
      path: lastPath,
      pathId: Date.now()
    };
    
    // Use setTimeout to avoid calling during render
    const timeoutId = setTimeout(() => {
      webrtcManager.sendWhiteboardDraw(drawingData);
      onDrawingEvent?.(drawingData);
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [paths, isCollaborative, webrtcManager, isHost, onDrawingEvent]);

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
    
    // Redraw all paths
    paths.forEach(path => {
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
    });
  }, [paths, backgroundImageLoaded, backgroundImage, loadBackgroundImage]);

  // Handle remote drawing events
  const handleRemoteDrawing = useCallback((drawingData: any) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log('🎨 Processing remote drawing:', drawingData.type);

    if (drawingData.type === 'draw') {
      // For real-time drawing, we don't draw individual points
      // We'll wait for the path-complete event to draw the full path
      return;
    } else if (drawingData.type === 'path-complete') {
      // Add completed path to our paths array and redraw everything
      console.log('✅ Adding remote path:', drawingData.path);
      setPaths(prev => [...prev, drawingData.path]);
      
      // Redraw canvas to include the new path
      setTimeout(() => {
        redrawCanvas();
      }, 10); // Small delay to ensure state is updated
    }
  }, [redrawCanvas]);

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
      if (drawingData.type === 'path-complete') {
        console.log('✅ Adding remote path via ref:', drawingData.path);
        setPaths(prev => [...prev, drawingData.path]);
        setTimeout(() => redrawCanvas(), 10);
      }
    },
    handleRemoteClear: () => {
      console.log('🧹 Executing remote clear via ref');
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
        <Button
          variant={tool === 'pen' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('pen')}
        >
          <PenTool className="h-4 w-4 mr-1" />
          Draw
        </Button>
        <Button
          variant={tool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('eraser')}
        >
          <Eraser className="h-4 w-4 mr-1" />
          Erase
        </Button>
        
        <div className="border-l pl-2 ml-2">
          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="h-8 px-2 border rounded text-sm"
          >
            <option value={1}>Thin</option>
            <option value={2}>Medium</option>
            <option value={5}>Thick</option>
          </select>
        </div>

        <div className="flex-1" />
        
        <Button variant="outline" size="sm" onClick={undo}>
          <Trash2 className="h-4 w-4 mr-1" />
          Undo
        </Button>
        <Button variant="outline" size="sm" onClick={redo}>
          <Save className="h-4 w-4 mr-1" />
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
          style={{ cursor: tool === 'eraser' ? 'crosshair' : 'default' }}
        />
      </div>
    </div>
  );
}); 