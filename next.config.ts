import type { NextConfig } from 'next';

const config: NextConfig = {
  productionBrowserSourceMaps: true,
  experimental: {
    serverSourceMaps: true,

    // Required to prevent Next-Typegoose issues with minified class names.
    // See: https://github.com/vercel/next.js/issues/59594#issuecomment-3445849631
    serverMinification: false,
  },
};

export default config;

import withMongooseStudio from '@mongoosejs/studio/next';

// Mount Mongoose Studio frontend on /studio
export default withMongooseStudio({
  // Your Next.js config here
  reactStrictMode: true,
});