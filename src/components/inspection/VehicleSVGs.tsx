import React from 'react';

export type VehicleType = 'sedan' | 'hatchback' | 'suv' | 'bakkie' | 'truck';
export type ViewAngle = 'left' | 'right' | 'front' | 'rear';

interface VehicleSVGProps {
  className?: string;
  style?: React.CSSProperties;
}

// Shared PNG image helper
const VehicleImg: React.FC<{ src: string; alt: string; className?: string; style?: React.CSSProperties; flip?: boolean }> = (
  { src, alt, className, style, flip }
) => (
  <img
    src={src}
    alt={alt}
    className={className}
    style={{ objectFit: 'contain', ...(flip ? { transform: 'scaleX(-1)' } : {}), ...style }}
  />
);

// ─── SEDAN ───

const SedanLeftImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/sedanright.png" alt="Sedan Left View" className={className} style={style} flip />
);

const SedanRightImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/sedanright.png" alt="Sedan Right View" className={className} style={style} />
);

const SedanFrontImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/sedanfront.png" alt="Sedan Front View" className={className} style={style} />
);

const SedanRearImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/sedanback.png" alt="Sedan Rear View" className={className} style={style} />
);

// ─── HATCHBACK ───

const HatchbackLeftImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/hatchback-left.png" alt="Hatchback Left View" className={className} style={style} />
);

const HatchbackRightImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/hatchback-left.png" alt="Hatchback Right View" className={className} style={style} flip />
);

const HatchbackFrontImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/hatchback-front.png" alt="Hatchback Front View" className={className} style={style} />
);

const HatchbackRearImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/hatchback-rear.png" alt="Hatchback Rear View" className={className} style={style} />
);

// ─── SUV ───

const SUVLeftImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/SUV_LEFT_SIDE.png" alt="SUV Left View" className={className} style={style} />
);

const SUVRightImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/SUV_LEFT_SIDE.png" alt="SUV Right View" className={className} style={style} flip />
);

const SUVFrontImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/SUV_Front.png" alt="SUV Front View" className={className} style={style} />
);

const SUVRearImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/SUV_BACK.png" alt="SUV Rear View" className={className} style={style} />  
);

// ─── BAKKIE ───

const BakkieLeftImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/bakkie_right_side.png" alt="Bakkie Left View" className={className} style={style} flip />
);

const BakkieRightImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/bakkie_right_side.png" alt="Bakkie Right View" className={className} style={style} />
);

const BakkieFrontImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/bakkie_front.png" alt="Bakkie Front View" className={className} style={style} />
);

const BakkieRearImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/bakkie_back.png" alt="Bakkie Rear View" className={className} style={style} />
);

// ─── TRUCK ───

const TruckLeftImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/Truck_left_side.png" alt="Truck Left View" className={className} style={style} />
);

const TruckRightImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/Truck_left_side.png" alt="Truck Right View" className={className} style={style} flip />
);

const TruckFrontImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/Truck_front.png" alt="Truck Front View" className={className} style={style} />
);

const TruckRearImg: React.FC<VehicleSVGProps> = ({ className, style }) => (
  <VehicleImg src="/Truck_back.png" alt="Truck Rear View" className={className} style={style} />
);

// ─── REGISTRY ───

export const vehicleViewSVGs: Record<VehicleType, Record<ViewAngle, React.FC<VehicleSVGProps>>> = {
  sedan:    { left: SedanLeftImg,    right: SedanRightImg,    front: SedanFrontImg,    rear: SedanRearImg    },
  hatchback:{ left: HatchbackLeftImg,right: HatchbackRightImg,front: HatchbackFrontImg,rear: HatchbackRearImg },
  suv:      { left: SUVLeftImg,      right: SUVRightImg,      front: SUVFrontImg,      rear: SUVRearImg      },
  bakkie:   { left: BakkieLeftImg,   right: BakkieRightImg,   front: BakkieFrontImg,   rear: BakkieRearImg   },
  truck:    { left: TruckLeftImg,    right: TruckRightImg,    front: TruckFrontImg,    rear: TruckRearImg    },
};

export const vehicleLabels: Record<VehicleType, string> = {
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  suv: 'SUV',
  bakkie: 'Bakkie',
  truck: 'Truck',
};

export const viewLabels: Record<ViewAngle, string> = {
  left: 'Left Side',
  right: 'Right Side',
  front: 'Front',
  rear: 'Rear',
};
