/** Royal Tyres brand icon — red circle crown logo */
const RoyalTyresIcon = ({ className = '', size = 32 }: { className?: string; size?: number }) => (
  <img
    src="/cropped-logo-default-mobile.png"
    alt="Royal Tyres"
    width={size}
    height={size}
    className={className}
    draggable={false}
  />
);

export default RoyalTyresIcon;
