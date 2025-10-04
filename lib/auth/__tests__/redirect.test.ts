import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRedirectUrl, resolveRedirectBase } from '../redirect';

test('prefers the direct host header over forwarded host', () => {
  const headers = new Headers({
    host: 'ai-latex-editor.useoctree.com',
    'x-forwarded-host': 'tools.useoctree.com',
    'x-forwarded-proto': 'https',
  });

  const base = resolveRedirectBase(headers, new URL('https://ai-latex-editor.useoctree.com/auth/oauth'));
  assert.equal(base.origin, 'https://ai-latex-editor.useoctree.com');

  const redirect = buildRedirectUrl(headers, 'https://ai-latex-editor.useoctree.com', '/projects/123');
  assert.equal(redirect, 'https://ai-latex-editor.useoctree.com/projects/123');
});

test('falls back to origin host when proxy host differs', () => {
  const headers = new Headers({
    host: 'tools.useoctree.com',
    'x-forwarded-host': 'app.useoctree.com',
    'x-forwarded-proto': 'https',
  });

  const base = resolveRedirectBase(headers, new URL('https://app.useoctree.com/auth/oauth'));
  assert.equal(base.origin, 'https://app.useoctree.com');

  const redirect = buildRedirectUrl(headers, 'https://app.useoctree.com', '/projects/123');
  assert.equal(redirect, 'https://app.useoctree.com/projects/123');
});

test('falls back to forwarded host when allow-listed', () => {
  const headers = new Headers({
    'x-forwarded-host': 'preview.ai-latex-editor.vercel.app',
    'x-forwarded-proto': 'https',
  });

  const base = resolveRedirectBase(
    headers,
    new URL('https://ai-latex-editor.useoctree.com/auth/oauth'),
    'preview.ai-latex-editor.vercel.app'
  );
  assert.equal(base.origin, 'https://preview.ai-latex-editor.vercel.app');

  const redirect = buildRedirectUrl(
    headers,
    'https://ai-latex-editor.useoctree.com',
    '/projects/123',
    'preview.ai-latex-editor.vercel.app'
  );
  assert.equal(redirect, 'https://preview.ai-latex-editor.vercel.app/projects/123');
});

test('defaults to origin host when no candidate is allow-listed', () => {
  const headers = new Headers({
    host: 'internal.vercel.app',
    'x-forwarded-host': 'example.com',
    'x-forwarded-proto': 'https',
  });

  const base = resolveRedirectBase(headers, new URL('https://ai-latex-editor.useoctree.com/auth/oauth'));
  assert.equal(base.origin, 'https://ai-latex-editor.useoctree.com');
});
