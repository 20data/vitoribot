import { auth } from '@/auth';

export default auth((req) => {
  const isAdmin = req.nextUrl.pathname.startsWith('/admin');
  if (isAdmin && !req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return Response.redirect(url);
  }
  return undefined;
});

export const config = {
  matcher: ['/admin/:path*'],
};
