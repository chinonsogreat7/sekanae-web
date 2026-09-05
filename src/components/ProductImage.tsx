import { useState, type ImgHTMLAttributes } from "react";

type ProductImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  images: string[];
  alt: string;
};

export function ProductImage({ images, alt, className, ...props }: ProductImageProps) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = images.find((image) => image && !failed.includes(image));
  if (!source) {
    return <div className={`image-unavailable ${className ?? ""}`} role="img" aria-label={`${alt}: photograph unavailable`}>
      <span>Photograph unavailable</span>
    </div>;
  }
  return <img {...props} src={source} alt={alt} className={className} onError={() => setFailed((current) => [...current, source])} />;
}
