import React, { useRef, useState } from 'react';
import { InspectionAngle } from '@/types';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface PhotoUploadProps {
  angle: InspectionAngle;
  currentImage?: string;
  onImageSelected: (image: string, angle: InspectionAngle) => void;
  onRemove?: () => void;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  angle,
  currentImage,
  onImageSelected,
  onRemove,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result as string;
      onImageSelected(result, angle);
      setIsLoading(false);
      toast.success(`Photo uploaded for ${angle.replace('_', ' ')} view`);
    };

    reader.onerror = () => {
      setIsLoading(false);
      toast.error('Failed to read file');
    };

    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera on mobile
          width: { ideal: 4096 },
          height: { ideal: 2048 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    context.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.95);
    onImageSelected(imageData, angle);
    stopCamera();
    toast.success(`Photo captured for ${angle.replace('_', ' ')} view`);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      setIsCameraActive(false);
    }
  };

  return (
    <Card className="p-3 space-y-2">
      {/* Main Row: Label, Image, Buttons - Only show if camera not active */}
      {!isCameraActive && (
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-2">
          {/* Label & Status */}
          <div className="flex items-center gap-1.5 shrink-0 min-w-fit">
            <h3 className="text-xs md:text-sm font-semibold text-foreground capitalize whitespace-nowrap">
              {angle.replace('_', ' ')}
            </h3>
            <Badge variant="outline" className="text-[9px] md:text-[10px] shrink-0">
              {currentImage ? 'Done' : 'Pending'}
            </Badge>
          </div>

          {/* Image Preview */}
          {currentImage ? (
            <div className="relative group shrink-0">
              <img src={currentImage} alt={angle} className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg" />
              <button
                onClick={() => {
                  onRemove?.();
                  toast.success('Photo removed');
                }}
                className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-2 flex items-center justify-center w-16 h-16 md:w-20 md:h-20 shrink-0">
              <p className="text-xs text-muted-foreground text-center">-</p>
            </div>
          )}

          {/* Action Buttons - Responsive */}
          <div className="flex gap-1 md:gap-1.5 md:ml-auto mt-1 md:mt-0 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-1 md:flex-none md:w-auto flex items-center justify-center gap-1 text-xs py-1 px-2 md:px-3 whitespace-nowrap"
            >
              <Upload className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">{isLoading ? 'Uploading...' : 'Upload'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={startCamera}
              className="flex-1 md:flex-none md:w-auto flex items-center justify-center gap-1 text-xs py-1 px-2 md:px-3 whitespace-nowrap"
            >
              <Camera className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Capture</span>
            </Button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      <Dialog open={isCameraActive} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="max-w-2xl p-0 bg-black border-0">
          <div className="relative bg-black rounded-lg overflow-hidden w-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full aspect-video object-cover"
            />
            <div className="absolute inset-0 flex flex-col justify-between p-4">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-white font-semibold text-sm md:text-base capitalize">
                  Capture {angle.replace('_', ' ')}
                </h2>
                <button
                  onClick={stopCamera}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Bottom Buttons */}
              <div className="flex gap-2 justify-center">
                <Button
                  size="lg"
                  onClick={capturePhoto}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Photo
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={stopCamera}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-[10px] text-muted-foreground text-center leading-tight">
        4K equirectangular (4096×2048)
      </p>
    </Card>
  );
};

export default PhotoUpload;
