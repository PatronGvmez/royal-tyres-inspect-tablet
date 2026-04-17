const AVATAR_MAP: Record<string, { src: string; alt: string }> = {
  '1': { src: '/mechanic1.png',  alt: 'Mechanic — tyre & wrench' },
  '2': { src: '/mechanic2.png',  alt: 'Mechanic — large spanner' },
  '3': { src: '/mechenic3.png',  alt: 'Mechanic — thumbs up' },
  '4': { src: '/mechenic4.png',  alt: 'Mechanic — wrench & smile' },
  '5': { src: '/mechenic5.png',  alt: 'Mechanic — tyres thumbs up' },
};

const MechanicAvatar = ({
  variant = '1',
  size = 120,
  className = '',
}: {
  variant?: '1' | '2' | '3' | '4' | '5';
  size?: number;
  className?: string;
}) => {
  const { src, alt } = AVATAR_MAP[variant] ?? AVATAR_MAP['1'];
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', objectPosition: 'bottom' }}
      draggable={false}
    />
  );
};

export default MechanicAvatar;
