import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',  // Static export for GitHub Pages
  images: {
    unoptimized: true  // Required for static export
  },
  basePath: process.env.VERCEL ? '' : (process.env.NODE_ENV === 'production' ? '/mailpilot' : ''),
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true  // ESLint runs separately in CI
  }
};

export default withMDX(config);
