import axios from 'axios';

/**
 * Downloads HTML content from a given URL
 * @param {string} url - The URL to download HTML from
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} The HTML content as a string
 */
export async function downloadHtml(url, options = {}) {
  try {
    const config = {
      timeout: options.timeout || 10000,
      headers: {
        'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...options.headers
      },
      ...options
    };

    const response = await axios.get(url, config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText} for URL: ${url}`);
    } else if (error.request) {
      throw new Error(`Network error when requesting URL: ${url}`);
    } else {
      throw new Error(`Error downloading HTML from ${url}: ${error.message}`);
    }
  }
}

// CLI usage example
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  try {
    const html = await downloadHtml(url);
    console.log(html);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
