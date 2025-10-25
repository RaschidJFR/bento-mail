import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';

function sanitizeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 100);
}

export async function fetchRawEmailFromMaildev(id: string): Promise<string | null> {
  const url = `http://127.0.0.1:1080/email/${id}/source`;
  try {
    const response = await axios.get(url, { responseType: 'text' });
    if (response.status === 200 && typeof response.data === 'string') {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`[email] Failed to fetch raw email from Maildev: `, error);
    return null;
  }
}

export async function saveEmailSample(email: { subject: string; id?: string }) {
  const subject = email.subject ? sanitizeFilename(email.subject) : 'untitled';
  let filePath: string;
  let raw = null;
  if (email.id) {
    raw = await fetchRawEmailFromMaildev(email.id);
  }

  const dir = path.resolve(process.cwd(), 'samples/email');
  await fs.promises.mkdir(dir, { recursive: true });
  if (raw) {
    filePath = path.join(dir, `${subject}.eml`);
    await fs.promises.writeFile(filePath, raw, 'utf8');
  } else {
    filePath = path.join(dir, `${subject}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(email, null, 2), 'utf8');
  }
}
