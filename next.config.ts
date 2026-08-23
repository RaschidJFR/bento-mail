import type { NextConfig } from 'next';
import withMongooseStudio from '@mongoosejs/studio/next';

const config: NextConfig = {
  productionBrowserSourceMaps: true,
  experimental: {
    serverSourceMaps: true,

    // Required to prevent Next-Typegoose issues with minified class names.
    // See: https://github.com/vercel/next.js/issues/59594#issuecomment-3445849631
    serverMinification: false,
  },
};

// Mount Mongoose Studio frontend on /studio
export default withMongooseStudio(config);
