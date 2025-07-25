'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PenTool, Eraser, Save, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface InteractiveWhiteboardProps {
  className?: string;
  onSave?: (dataUrl: string) => void;
  height?: string;
  backgroundImage?: string;
}

export function InteractiveWhiteboard({
  className,
  onSave,
  height = '500px',
  backgroundImage
}: InteractiveWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);
  const { toast } = useToast();

  // Function to load background image
  const loadBackgroundImage = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
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
  };

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
  }, [backgroundImage]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);

    ctx.beginPath();
    ctx.moveTo(x, y);
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = lineWidth * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }

    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

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
    
    // Reset background to white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    toast({ title: 'Canvas cleared' });
  };

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
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            className="h-8 px-2 border rounded text-sm"
          >
            <option value={1}>Thin</option>
            <option value={2}>Medium</option>
            <option value={5}>Thick</option>
          </select>
        </div>

        <div className="flex-1" />
        
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
} 