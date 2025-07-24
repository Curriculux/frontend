'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InteractiveWhiteboard } from './interactive-whiteboard';
import { ploneAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WhiteboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className?: string;
}

export function WhiteboardModal({
  open,
  onOpenChange,
  classId,
  className
}: WhiteboardModalProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'view'>('list');
  const [whiteboards, setWhiteboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWhiteboard, setSelectedWhiteboard] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [whiteboardTitle, setWhiteboardTitle] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open && mode === 'list') {
      loadWhiteboards();
    }
  }, [open, mode]);

  const loadWhiteboards = async () => {
    setLoading(true);
    try {
      console.log(`Loading whiteboards for class: ${classId}`);
      const boards = await ploneAPI.getWhiteboards(classId);
      console.log('Loaded whiteboards:', boards);
      setWhiteboards(boards);
    } catch (error) {
      console.error('Error loading whiteboards:', error);
      toast({
        title: 'Error',
        description: 'Failed to load whiteboards',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhiteboard = async (dataUrl: string) => {
    if (!whiteboardTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a title for the whiteboard',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      console.log(`Saving whiteboard "${whiteboardTitle}" for class: ${classId}`);
      const result = await ploneAPI.saveWhiteboard(classId, {
        title: whiteboardTitle,
        dataUrl,
        description: `Created by teacher on ${new Date().toLocaleString()}`
      });
      console.log('Save result:', result);

      toast({
        title: 'Success',
        description: 'Whiteboard saved successfully',
      });

      setMode('list');
      setWhiteboardTitle('');
      await loadWhiteboards(); // Wait for reload to complete
    } catch (error) {
      console.error('Error saving whiteboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to save whiteboard',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWhiteboard = async (whiteboardId: string) => {
    setLoading(true);
    try {
      await ploneAPI.deleteWhiteboard(classId, whiteboardId);
      toast({
        title: 'Success',
        description: 'Whiteboard deleted successfully',
      });
      loadWhiteboards();
    } catch (error) {
      console.error('Error deleting whiteboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete whiteboard',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setDeleteConfirm(null);
    }
  };

  const renderContent = () => {
    switch (mode) {
      case 'list':
        return (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Class Whiteboards</h3>
              <Button onClick={() => setMode('create')} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Whiteboard
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : whiteboards.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No whiteboards created yet</p>
                  <Button onClick={() => setMode('create')}>
                    Create First Whiteboard
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {whiteboards.map((board) => (
                  <Card key={board.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{board.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(board.created).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedWhiteboard(board);
                              setMode('view');
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteConfirm(board.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        );

      case 'create':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create New Whiteboard</h3>
              <Button variant="ghost" size="sm" onClick={() => setMode('list')}>
                Back to List
              </Button>
            </div>
            
            <div>
              <Label htmlFor="title">Whiteboard Title</Label>
              <Input
                id="title"
                value={whiteboardTitle}
                onChange={(e) => setWhiteboardTitle(e.target.value)}
                placeholder="e.g., Math Equations - Chapter 5"
                className="mt-1"
              />
            </div>

            <InteractiveWhiteboard
              height="400px"
              onSave={handleSaveWhiteboard}
            />
          </div>
        );

      case 'view':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedWhiteboard?.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(selectedWhiteboard?.created).toLocaleDateString()}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMode('list')}>
                Back to List
              </Button>
            </div>

            {selectedWhiteboard && (
              <div className="border rounded-lg overflow-hidden">
                <img 
                  src={selectedWhiteboard['@id'] + '/@@images/image'} 
                  alt={selectedWhiteboard.title}
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Whiteboard Manager</DialogTitle>
            <DialogDescription>
              Create and manage whiteboards for your class
            </DialogDescription>
          </DialogHeader>
          
          {renderContent()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Whiteboard?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The whiteboard will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteWhiteboard(deleteConfirm)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 