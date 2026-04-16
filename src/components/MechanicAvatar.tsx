/**
 * MechanicAvatar — renders the actual mechanic PNG images.
 * variant="1"  → younger mechanic (blue overalls, tyre + wrench)  → /mechanic1.png
 * variant="2"  → senior mechanic (teal overalls, large spanner)    → /mechanic2.png
 * Place the PNG files directly in the /public folder.
 */
const MechanicAvatar = ({
  variant = "1",
  size = 120,
  className = "",
}: {
  variant?: "1" | "2";
  size?: number;
  className?: string;
}) => (
  <img
    src={variant === "1" ? "/mechanic1.png" : "/mechanic2.png"}
    alt={variant === "1" ? "Mechanic" : "Senior Mechanic"}
    width={size}
    height={size}
    className={className}
    style={{ objectFit: "contain", objectPosition: "bottom" }}
    draggable={false}
  />
);

export default MechanicAvatar;
