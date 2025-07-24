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
}

export function InteractiveWhiteboard({
  className,
  onSave,
  height = '500px'
}: InteractiveWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const { toast } = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas background to white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set initial canvas properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Resize canvas to fill container
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      
      // Save current content
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Resize
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Set background to white again
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Restore content
      ctx.putImageData(imageData, 0, 0);
      
      // Reset drawing properties
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    resize();
    window.addEventListener('resize', resize);

    return () => window.removeEventListener('resize', resize);
  }, []);

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
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    return { x, y };
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
      <div className="relative bg-gray-100" style={{ height }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full touch-none bg-white"
          style={{ cursor: tool === 'eraser' ? 'crosshair' : 'default' }}
        />
      </div>
    </div>
  );
} 