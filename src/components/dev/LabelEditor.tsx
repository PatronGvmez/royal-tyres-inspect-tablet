import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { InspectionLabel, InspectionAngle } from '@/types';

interface LabelEditorProps {
  open: boolean;
  angle: InspectionAngle;
  coordinates?: { x: number; y: number; z: number };
  onSave: (label: Omit<InspectionLabel, 'id'>) => void;
  onClose: () => void;
  existingLabel?: InspectionLabel;
}

const LabelEditor: React.FC<LabelEditorProps> = ({
  open,
  angle,
  coordinates,
  onSave,
  onClose,
  existingLabel,
}) => {
  const [text, setText] = useState(existingLabel?.text || '');
  const [severity, setSeverity] = useState<'pass' | 'warning' | 'fail'>(
    existingLabel?.severity || 'warning'
  );
  const [data, setData] = useState<Record<string, any>>(existingLabel?.data || {});
  const [dataKey, setDataKey] = useState('');
  const [dataValue, setDataValue] = useState('');

  const handleAddData = () => {
    if (dataKey.trim()) {
      setData((prev) => ({ ...prev, [dataKey]: dataValue }));
      setDataKey('');
      setDataValue('');
    }
  };

  const handleRemoveData = (key: string) => {
    setData((prev) => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  };

  const handleSave = () => {
    if (!text.trim()) {
      return;
    }

    onSave({
      hotspot_id: existingLabel?.hotspot_id || `hotspot-${Date.now()}`,
      angle,
      text: text.trim(),
      severity,
      data: Object.keys(data).length > 0 ? data : undefined,
    });

    // Reset form
    setText('');
    setSeverity('warning');
    setData({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Inspection Label</DialogTitle>
          <DialogDescription>
            Add a label for the {angle.replace('_', ' ')} view
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Angle Display */}
          <div>
            <Label className="text-xs text-muted-foreground block mb-1">View Angle</Label>
            <Badge variant="outline" className="capitalize">
              {angle.replace('_', ' ')}
            </Badge>
          </div>

          {/* Coordinates Display */}
          {coordinates && (
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">
                3D Coordinates
              </Label>
              <code className="text-xs bg-muted p-2 rounded block font-mono">
                X: {coordinates.x}, Y: {coordinates.y}, Z: {coordinates.z}
              </code>
            </div>
          )}

          {/* Label Text */}
          <div>
            <Label htmlFor="label-text">Label Text *</Label>
            <Textarea
              id="label-text"
              placeholder="e.g., Brake pad wear - needs replacement"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-sm"
              rows={3}
            />
          </div>

          {/* Severity */}
          <div>
            <Label htmlFor="severity">Severity</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger id="severity" className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="warning">⚠ Warning</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional Data */}
          <div className="border-t border-border pt-4">
            <Label className="text-sm font-semibold mb-2 block">Optional Data</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Add key-value data (e.g., PSI: 32, Depth: 4mm)
            </p>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input
                placeholder="Key (e.g., PSI)"
                value={dataKey}
                onChange={(e) => setDataKey(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Value (e.g., 32)"
                value={dataValue}
                onChange={(e) => setDataValue(e.target.value)}
                className="text-sm"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddData}
              className="w-full text-sm mb-3"
            >
              Add Data Field
            </Button>

            {/* Display added data */}
            {Object.entries(data).length > 0 && (
              <div className="space-y-1 bg-muted p-2 rounded">
                {Object.entries(data).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-center text-sm py-1"
                  >
                    <span className="font-mono text-xs">
                      {key}: {value}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveData(key)}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!text.trim()}
              className="flex-1"
            >
              Save Label
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LabelEditor;
