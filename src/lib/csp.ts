// /dashboard ও /login-এর কড়া nonce-ভিত্তিক CSP (Arch §১৪.৪)। public পেজের CSP `public/_headers`-এ।
// `strict-dynamic` ইচ্ছাকৃতভাবে নেই: তাতে 'self' উপেক্ষিত হয়ে /theme-init.js ব্লক হতো।
// Firebase Auth popup-এর জন্য: authDomain iframe, apis.google.com (gapi), *.googleapis.com।
export function buildAppCsp(nonce: string, projectId: string): string {
  const authDomain = `https://${projectId}.firebaseapp.com`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://apis.google.com https://www.gstatic.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://res.cloudinary.com",
    "font-src 'self'",
    `connect-src 'self' https://*.googleapis.com ${authDomain} https://api.cloudinary.com`,
    `frame-src ${authDomain} https://accounts.google.com https://content.googleapis.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
