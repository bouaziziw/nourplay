import Image, { type ImageLoader, type ImageProps } from 'next/image'

const externalImageLoader: ImageLoader = ({ src }) => src

type Props = Omit<ImageProps, 'loader' | 'unoptimized' | 'alt'> & { alt: string }

export function RemoteImage({ alt, ...props }: Props) {
  return <Image {...props} alt={alt} loader={externalImageLoader} unoptimized />
}
