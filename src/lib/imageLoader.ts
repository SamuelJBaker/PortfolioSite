import type { ImageLoaderProps } from "next/image";

/**
 * next/image loader for pre-generated variants. A src such as
 * "/headshot-1280.webp" maps onto "/headshot-<width>.webp" for each srcSet
 * width in images.deviceSizes; anything else passes through untouched.
 * Used instead of /_next/image, which is a pass-through on this deployment.
 */
export default function imageLoader({ src, width }: ImageLoaderProps): string {
  const match = src.match(/^(.*?)(?:-\d+)?\.webp$/);
  return match ? match[1] + "-" + width + ".webp" : src;
}
