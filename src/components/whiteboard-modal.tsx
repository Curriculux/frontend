'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InteractiveWhiteboard } from './interactive-whiteboard';
import { ploneAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Eye, X } from 'lucide-react';

interface WhiteboardViewerProps {
  whiteboard: any;
}

function WhiteboardViewer({ whiteboard }: WhiteboardViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWhiteboardImage = async () => {
      try {
        setLoading(true);
        setError(null);

        if (whiteboard.isS3 && whiteboard.s3Key) {
          // For S3-stored whiteboards, get a presigned URL
          console.log('Loading S3 whiteboard:', whiteboard.s3Key);
          const presignedUrl = await ploneAPI.getSecureFileUrl(whiteboard.s3Key, 60); // 1 hour expiry
          setImageUrl(presignedUrl);
        } else {
          // For Plone-stored whiteboards, use the direct image URL
          console.log('Loading Plone whiteboard:', whiteboard['@id']);
          const imageUrl = whiteboard['@id'] + '/@@images/image';
          setImageUrl(imageUrl);
        }
      } catch (err) {
        console.error('Error loading whiteboard image:', err);
        setError('Failed to load whiteboard image');
      } finally {
        setLoading(false);
      }
    };

    if (whiteboard) {
      loadWhiteboardImage();
    }
  }, [whiteboard]);

  if (loading) {
    return (
      <div className="border rounded-lg overflow-hidden flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading whiteboard...</p>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="border rounded-lg overflow-hidden flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">{error || 'Failed to load whiteboard'}</p>
          <p className="text-xs text-muted-foreground">
            Storage: {whiteboard.storageType || 'unknown'}
            {whiteboard.isS3 && ` (S3: ${whiteboard.s3Key})`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="p-2 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={whiteboard.isS3 ? 'default' : 'secondary'}>
            {whiteboard.isS3 ? 'S3 Storage' : 'Plone Storage'}
          </Badge>
          {whiteboard.fileSize && (
            <span className="text-xs text-muted-foreground">
              {(whiteboard.fileSize / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
        <a 
          href={imageUrl} 
          download={`${whiteboard.title}.png`}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Download
        </a>
      </div>
      <img 
        src={imageUrl} 
        alt={whiteboard.title}
        className="w-full h-auto max-h-[70vh] object-contain"
      />
    </div>
  );
}


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
  const [mode, setMode] = useState<'list' | 'create' | 'view' | 'edit'>('list');
  const [whiteboards, setWhiteboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWhiteboard, setSelectedWhiteboard] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [whiteboardTitle, setWhiteboardTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  // Function to load background image URL for editing
  const loadBackgroundImageUrl = async (whiteboard: any) => {
    if (!whiteboard) {
      setBackgroundImageUrl(undefined);
      return;
    }
    
    if (whiteboard.isS3 && whiteboard.s3Key) {
      // For S3-stored whiteboards, get a fresh presigned URL
      try {
        console.log('Getting fresh presigned URL for S3 whiteboard:', whiteboard.s3Key);
        const freshUrl = await ploneAPI.getSecureFileUrl(whiteboard.s3Key, 60); // 1 hour expiry
        setBackgroundImageUrl(freshUrl);
      } catch (error) {
        console.error('Failed to get presigned URL for S3 whiteboard:', error);
        // Fallback to stored URL even if it might be expired
        setBackgroundImageUrl(whiteboard.s3Url);
      }
    } else {
      // For Plone-stored whiteboards, use the image endpoint
      setBackgroundImageUrl(whiteboard['@id'] + '/@@images/image');
    }
  };

  // Handle keyboard events and body scroll lock
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      // Don't modify body overflow since we might have parent modals
      // document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Don't reset body overflow since we might have parent modals
      // document.body.style.overflow = 'unset';
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open && mode === 'list') {
      loadWhiteboards();
    }
  }, [open, mode]);

  // Load background image when entering edit mode with selected whiteboard
  useEffect(() => {
    if (mode === 'edit' && selectedWhiteboard) {
      loadBackgroundImageUrl(selectedWhiteboard);
    } else {
      setBackgroundImageUrl(undefined);
    }
  }, [mode, selectedWhiteboard]);

  // Auto-focus the modal when it opens
  useEffect(() => {
    if (open) {
      const modalElement = document.querySelector('[data-modal="whiteboard"]');
      if (modalElement) {
        // Small delay to ensure modal is fully rendered
        setTimeout(() => {
          (modalElement as HTMLElement).focus();
        }, 100);
      }
    }
  }, [open]);

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
      setTitleError(true);
      toast({
        title: 'Error',
        description: 'Please enter a title for the whiteboard',
        variant: 'destructive'
      });
      return;
    }
    
    // Clear title error if validation passes
    setTitleError(false);

    setLoading(true);
    try {
      if (mode === 'edit' && selectedWhiteboard) {
        // Get the whiteboard ID - try multiple possible ID fields
        let whiteboardId = selectedWhiteboard.id;
        
        // If id is not available, extract from @id URL
        if (!whiteboardId && selectedWhiteboard['@id']) {
          const urlParts = selectedWhiteboard['@id'].split('/');
          whiteboardId = urlParts[urlParts.length - 1];
        }
        
        // If still no ID, try to generate from title
        if (!whiteboardId && selectedWhiteboard.title) {
          whiteboardId = selectedWhiteboard.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
        
        // Final fallback - try any available identifier
        if (!whiteboardId) {
          whiteboardId = Object.keys(selectedWhiteboard).find(key => 
            key.includes('id') || key.includes('Id')
          );
        }
        
        if (!whiteboardId || whiteboardId === 'undefined') {
          console.error('Could not determine whiteboard ID. Available properties:', Object.keys(selectedWhiteboard));
          console.error('Full whiteboard object:', selectedWhiteboard);
          
          // Fallback: create a new whiteboard instead of updating
          console.warn('Cannot update existing whiteboard, creating new one instead');
          const result = await ploneAPI.saveWhiteboard(classId, {
            title: whiteboardTitle + ' (Updated)',
            dataUrl,
            description: `Created as update on ${new Date().toLocaleString()} - original could not be replaced`
          });
          
          toast({
            title: 'Whiteboard Saved',
            description: 'Created new whiteboard (could not update original)',
            variant: 'default'
          });
          
          setMode('list');
          setWhiteboardTitle('');
          setSelectedWhiteboard(null);
          await loadWhiteboards();
          return;
        }
        
        // Update existing whiteboard
        console.log(`Updating whiteboard "${whiteboardTitle}" (ID: ${whiteboardId}) for class: ${classId}`);
        console.log('Selected whiteboard object:', selectedWhiteboard);
        
        // For now, we'll delete the old one and create a new one since the API doesn't have an update method
        // TODO: Implement proper update method in the API
        await ploneAPI.deleteWhiteboard(classId, whiteboardId);
        
        const result = await ploneAPI.saveWhiteboard(classId, {
          title: whiteboardTitle,
          dataUrl,
          description: `Updated by teacher on ${new Date().toLocaleString()}`
        });
        console.log('Update result:', result);

        toast({
          title: 'Success',
          description: 'Whiteboard updated successfully',
        });
      } else {
        // Create new whiteboard
        console.log(`Creating new whiteboard "${whiteboardTitle}" for class: ${classId}`);
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
      }

      setMode('list');
      setWhiteboardTitle('');
      setSelectedWhiteboard(null);
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
              <Button onClick={() => {
                setMode('create');
                setWhiteboardTitle('');
                setTitleError(false);
              }} size="sm">
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
                  <Button onClick={() => {
                    setMode('create');
                    setWhiteboardTitle('');
                    setTitleError(false);
                  }}>
                    Create First Whiteboard
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {whiteboards.map((board, index) => (
                  <Card 
                    key={board.id || board['@id'] || `whiteboard-${index}`} 
                    className="hover:shadow-lg transition-shadow cursor-pointer group"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Don't trigger if clicking on delete button
                      const target = e.target as HTMLElement;
                      const deleteButton = target.closest('[data-delete-button]');
                      if (!deleteButton) {
                        console.log('Selected whiteboard for editing:', board);
                        console.log('Available ID fields:', {
                          id: board.id,
                          '@id': board['@id'],
                          title: board.title
                        });
                        setSelectedWhiteboard(board);
                        setWhiteboardTitle(board.title);
                        setMode('edit');
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedWhiteboard(board);
                      setMode('view');
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium group-hover:text-blue-600 transition-colors">{board.title}</h4>
                            <Badge variant={board.isS3 ? 'default' : 'secondary'} className="text-xs">
                              {board.isS3 ? 'S3' : 'Plone'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Created {new Date(board.created).toLocaleDateString()}</span>
                            {board.fileSize && (
                              <span>{(board.fileSize / 1024).toFixed(1)} KB</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to edit • Right-click to view
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const whiteboardId = board.id || board['@id']?.split('/').pop() || `whiteboard-${index}`;
                              setDeleteConfirm(whiteboardId);
                            }}
                            data-delete-button
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
              <Button variant="ghost" size="sm" onClick={() => {
                setMode('list');
                setTitleError(false);
                setWhiteboardTitle('');
                setSelectedWhiteboard(null);
              }}>
                Back to List
              </Button>
            </div>
            
            <div>
              <Label htmlFor="title" className={titleError ? 'text-red-600' : ''}>
                Whiteboard Title {titleError && <span className="text-red-600">*</span>}
              </Label>
              <Input
                id="title"
                value={whiteboardTitle}
                onChange={(e) => {
                  setWhiteboardTitle(e.target.value);
                  if (titleError && e.target.value.trim()) {
                    setTitleError(false); // Clear error when user types
                  }
                }}
                placeholder="e.g., Math Equations - Chapter 5"
                className={`mt-1 ${titleError ? 'border-red-500 ring-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {titleError && (
                <p className="text-sm text-red-600 mt-1">
                  Please enter a title for the whiteboard
                </p>
              )}
            </div>

            <div className="flex-1 min-h-[600px]">
              <InteractiveWhiteboard
                height="100%"
                onSave={handleSaveWhiteboard}
              />
            </div>
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
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setWhiteboardTitle(selectedWhiteboard?.title || '');
                    setMode('edit');
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setMode('list');
                  setTitleError(false);
                  setWhiteboardTitle('');
                  setSelectedWhiteboard(null);
                }}>
                  Back to List
                </Button>
              </div>
            </div>

            {selectedWhiteboard && (
              <WhiteboardViewer whiteboard={selectedWhiteboard} />
            )}
          </div>
        );

      case 'edit':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Whiteboard</h3>
                              <Button variant="ghost" size="sm" onClick={() => {
                  setMode('view');
                  setTitleError(false);
                }}>
                  Cancel
                </Button>
            </div>
            
            <div>
              <Label htmlFor="edit-title" className={titleError ? 'text-red-600' : ''}>
                Whiteboard Title {titleError && <span className="text-red-600">*</span>}
              </Label>
              <Input
                id="edit-title"
                value={whiteboardTitle}
                onChange={(e) => {
                  setWhiteboardTitle(e.target.value);
                  if (titleError && e.target.value.trim()) {
                    setTitleError(false);
                  }
                }}
                placeholder="e.g., Math Equations - Chapter 5"
                className={`mt-1 ${titleError ? 'border-red-500 ring-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {titleError && (
                <p className="text-sm text-red-600 mt-1">
                  Please enter a title for the whiteboard
                </p>
              )}
            </div>

             <div className="flex-1 min-h-[600px]">
               <InteractiveWhiteboard
                 height="100%"
                 onSave={handleSaveWhiteboard}
                 backgroundImage={backgroundImageUrl}
               />
             </div>
          </div>
        );
    }
  };

  // Render the modal using a portal to ensure it's at the top level
  const modalContent = (
    <>
      {open && (
        <div 
          className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Prevent event bubbling to parent modals
            e.stopPropagation();
            // Close modal if clicking on backdrop
            if (e.target === e.currentTarget) {
              onOpenChange(false);
            }
          }}
          onKeyDown={(e) => {
            // Handle escape key
            if (e.key === 'Escape') {
              e.stopPropagation();
              onOpenChange(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg w-[95vw] h-[95vh] flex flex-col relative focus:outline-none"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whiteboard-modal-title"
            data-modal="whiteboard"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 p-2 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close whiteboard modal"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6 h-full flex flex-col">
              <div className="pb-4">
                <h2 id="whiteboard-modal-title" className="text-lg font-semibold">Whiteboard Manager</h2>
                <p className="text-sm text-gray-600">
                  Create and manage whiteboards for your class
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      )}

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

  // Use portal only in browser environment
  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
} 