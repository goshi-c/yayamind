import { buildApp } from '../server/index';

const app = buildApp();
const ready = app.ready();

export default async function handler(request: any, response: any) {
  await ready;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const injected = await app.inject({
    method: request.method,
    url: request.url,
    headers: request.headers,
    payload: chunks.length ? Buffer.concat(chunks) : undefined
  });

  response.statusCode = injected.statusCode;
  for (const [key, value] of Object.entries(injected.headers)) {
    if (typeof value !== 'undefined') response.setHeader(key, value as string | string[]);
  }
  response.end(injected.body);
}
