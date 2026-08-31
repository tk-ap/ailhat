export default function AilhatBrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/brand/ailhat-condensation.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    />
  );
}
