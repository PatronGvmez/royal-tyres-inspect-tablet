import React, { useState } from 'react';
import Inspection360View from './Inspection360View';
import { InspectionLabel, InspectionAngle } from '@/types';
import { generateStatusReportPDF, generateSummaryStats } from '@/lib/pdfGenerator';

/**
 * Example: Complete 360° Inspection Workflow
 * This demonstrates how to implement a full inspection flow with label management
 * and PDF report generation
 */

const Example360Inspection = () => {
  const [labels, setLabels] = useState<InspectionLabel[]>([
    {
      id: 'label-1',
      hotspot_id: 'hotspot-1',
      angle: 'front' as InspectionAngle,
      text: 'Brake pad wear - 15% remaining',
      severity: 'warning',
      data: {
        PSI: '32',
        thickness: '3mm',
        condition: 'Needs replacement soon',
      },
    },
    {
      id: 'label-2',
      hotspot_id: 'hotspot-2',
      angle: 'front' as InspectionAngle,
      text: 'Headlight foggy',
      severity: 'fail',
      data: {
        side: 'driver',
        recommendation: 'Polish or replace',
      },
    },
  ]);

  const [jobCard, setJobCard] = useState({
    id: 'JC-001',
    customer_name: 'John Doe',
    license_plate: 'ABC 123',
    odometer: 125000,
  });

  // Example 360° images (replace with real equirectangular images)
  const images = {
    front: 'https://via.placeholder.com/4096x2048?text=Front+View+360',
    left_side: 'https://via.placeholder.com/4096x2048?text=Left+Side+360',
    right_side: 'https://via.placeholder.com/4096x2048?text=Right+Side+360',
    rear: 'https://via.placeholder.com/4096x2048?text=Rear+View+360',
    top: 'https://via.placeholder.com/4096x2048?text=Top+View+360',
  };

  /**
   * Handle when a label is clicked
   */
  const handleLabelClick = (label: InspectionLabel) => {
    console.log('Label clicked:', label);
    // You can show more details, edit, or navigate to a detail view
  };

  /**
   * Handle coordinates picked from the 3D scene
   */
  const handleCoordinatePicked = (coords: { x: number; y: number; z: number }, angle: InspectionAngle) => {
    console.log(`Coordinates picked at ${angle}:`, coords);
    // Navigate to label editor with these coordinates
  };

  /**
   * Add a new label to the inspection
   */
  const handleAddLabel = (label: InspectionLabel) => {
    setLabels((prev) => [...prev, label]);
  };

  /**
   * Generate PDF status report
   */
  const handleGenerateReport = async () => {
    const statusReport = {
      id: `RPT-${Date.now()}`,
      inspection_id: `INS360-${Date.now()}`,
      job_card_id: jobCard.id,
      vehicle_info: {
        license_plate: jobCard.license_plate,
        customer_name: jobCard.customer_name,
        odometer: jobCard.odometer,
      },
      labels,
      summary: generateSummaryStats(labels),
      generated_at: new Date().toISOString(),
    };

    try {
      await generateStatusReportPDF(statusReport);
      console.log('Report generated successfully');
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">360° Vehicle Inspection</h1>
        <p className="text-gray-600 mt-2">
          {jobCard.customer_name} · {jobCard.license_plate} · {jobCard.odometer}km
        </p>
      </div>

      {/* 360° View */}
      <div className="border rounded-lg overflow-hidden bg-gray-900 h-96">
        <Inspection360View
          images={images}
          initialLabels={labels}
          onLabelClick={handleLabelClick}
          showCoordinateFinder={true}
          onCoordinatePicked={handleCoordinatePicked}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Labels</p>
          <p className="text-2xl font-bold text-blue-600">{labels.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Pass</p>
          <p className="text-2xl font-bold text-green-600">
            {labels.filter((l) => l.severity === 'pass').length}
          </p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Warning</p>
          <p className="text-2xl font-bold text-yellow-600">
            {labels.filter((l) => l.severity === 'warning').length}
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Fail</p>
          <p className="text-2xl font-bold text-red-600">
            {labels.filter((l) => l.severity === 'fail').length}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerateReport}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          📄 Generate PDF Report
        </button>
        <button
          onClick={() => setLabels([])}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
        >
          Clear All Labels
        </button>
      </div>

      {/* Labels Breakdown */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-bold mb-4">Inspection Labels ({labels.length})</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {labels.map((label) => (
            <div key={label.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{label.text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {label.angle.toUpperCase()} · {label.severity?.toUpperCase() || 'INFO'}
                </p>
                {label.data && Object.keys(label.data).length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    {Object.entries(label.data).map(([key, value]) => (
                      <p key={key}>
                        <span className="font-mono">{key}:</span> {value}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                style={{
                  backgroundColor:
                    label.severity === 'pass'
                      ? '#22c55e'
                      : label.severity === 'warning'
                      ? '#eab308'
                      : '#ef4444',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Example360Inspection;

/**
 * Usage Example 2: Just the 360 View Component
 * 
 * If you want to use just the 360 view component:
 * 
 * <Inspection360View
 *   images={{
 *     front: 'https://example.com/front.jpg',
 *     left_side: 'https://example.com/left.jpg',
 *     right_side: 'https://example.com/right.jpg',
 *     rear: 'https://example.com/rear.jpg',
 *     top: 'https://example.com/top.jpg',
 *   }}
 *   onLabelClick={(label) => {
 *     // Handle label click
 *   }}
 *   showCoordinateFinder={true}
 * />
 * 
 */

/**
 * Usage Example 3: Generating Reports
 * 
 * import { generateStatusReportPDF } from '@/lib/pdfGenerator';
 * 
 * const report = {
 *   id: 'RPT-123',
 *   inspection_id: 'INS360-123',
 *   job_card_id: 'JC-123',
 *   vehicle_info: {
 *     license_plate: 'ABC 123',
 *     customer_name: 'John Doe',
 *     odometer: 125000,
 *   },
 *   labels: [...],
 *   summary: {
 *     total_issues: 3,
 *     pass_count: 0,
 *     warning_count: 2,
 *     fail_count: 1,
 *   },
 *   generated_at: new Date().toISOString(),
 * };
 * 
 * await generateStatusReportPDF(report);
 */
