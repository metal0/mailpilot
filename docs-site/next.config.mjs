import { createMDX } from 'fumadocs-mdx/config';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',  // Static export for GitHub Pages
  images: {
    unoptimized: true,  // Required for static export
    loader: 'custom',
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    formats: ['image/webp', 'image/png']
  },
  basePath: process.env.NODE_ENV === 'production' ? '/mailpilot' : '',
  trailingSlash: true
};

export default withMDX(config);
