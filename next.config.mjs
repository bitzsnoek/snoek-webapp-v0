/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/auth/login',
        destination: '/',
        permanent: false,
      },
      {
        source: '/auth/:path*',
        destination: '/',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
