import React, { useState } from 'react';
import { InspectionAngle } from '@/types';
import PhotoUpload from '../inspection/PhotoUpload';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Photo360UploaderProps {
  onPhotosReady: (images: Partial<Record<InspectionAngle, string>>) => void;
  onCancel?: () => void;
}

const Photo360Uploader: React.FC<Photo360UploaderProps> = ({
  onPhotosReady,
  onCancel,
}) => {
  const angles: InspectionAngle[] = ['rear', 'front', 'left_side', 'right_side', 'top'];

  const [images, setImages] = useState<Partial<Record<InspectionAngle, string>>>({});

  const handleImageSelected = (image: string, angle: InspectionAngle) => {
    setImages((prev) => ({ ...prev, [angle]: image }));
  };

  const handleRemoveImage = (angle: InspectionAngle) => {
    setImages((prev) => {
      const newImages = { ...prev };
      delete newImages[angle];
      return newImages;
    });
  };

  const uploadedCount = Object.keys(images).length;
  const allUploaded = uploadedCount === angles.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          Upload 360° Inspection Photos
        </h2>
        <p className="text-sm text-muted-foreground">
          Capture or upload equirectangular images from 5 angles. You can use your phone's
          panorama mode or a 360° camera app like Insta360 or Ricoh Theta.
        </p>
      </div>

      {/* Progress */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              {uploadedCount} of {angles.length} photos ready
            </span>
          </div>
          <div className="w-32 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${(uploadedCount / angles.length) * 100}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Photo Uploads - Rows (Stacked Vertically) */}
      <div className="space-y-3">
        {angles.map((angle) => (
          <div key={angle} className="w-full">
            <PhotoUpload
              angle={angle}
              currentImage={images[angle]}
              onImageSelected={handleImageSelected}
              onRemove={() => handleRemoveImage(angle)}
            />
          </div>
        ))}
      </div>

      {/* Instructions */}
      <Card className="p-4 bg-amber-50 border-amber-200 space-y-2">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-900">For Best Results:</p>
            <ul className="text-amber-800 space-y-1 ml-4 list-disc">
              <li>Use 4K resolution images (4096×2048 minimum)</li>
              <li>Ensure 2:1 aspect ratio for equirectangular format</li>
              <li>Capture from the same position for consistency</li>
              <li>Use good lighting conditions</li>
              <li>Avoid moving objects in the frame</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={() => onPhotosReady(images)}
          disabled={!allUploaded}
          className="flex-1"
        >
          {allUploaded ? 'Start Inspection' : `Upload ${angles.length - uploadedCount} more`}
        </Button>
      </div>
    </div>
  );
};

export default Photo360Uploader;
