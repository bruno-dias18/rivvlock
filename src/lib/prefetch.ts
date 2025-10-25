/**
 * Intelligent prefetching system
 * Preloads critical routes and assets based on user behavior
 */

const prefetchedRoutes = new Set<string>();

/**
 * Prefetch a route component
 */
export const prefetchRoute = (route: string) => {
  if (prefetchedRoutes.has(route)) return;
  
  // Map route to lazy component path
  const routeMap: Record<string, () => Promise<any>> = {
    '/dashboard': () => import('../pages/DashboardPage'),
    '/dashboard/transactions': () => import('../pages/TransactionsPage'),
    '/dashboard/quotes': () => import('../pages/QuotesPage'),
    '/dashboard/profile': () => import('../pages/ProfilePage'),
    '/dashboard/admin': () => import('../pages/AdminPage'),
  };
  
  const prefetchFn = routeMap[route];
  if (prefetchFn) {
    prefetchFn().then(() => {
      prefetchedRoutes.add(route);
    });
  }
};

/**
 * Prefetch on hover (for navigation links)
 */
export const prefetchOnHover = (route: string) => {
  return {
    onMouseEnter: () => prefetchRoute(route),
    onTouchStart: () => prefetchRoute(route),
  };
};

/**
 * Prefetch on idle (after page load)
 */
export const prefetchOnIdle = (routes: string[], delay = 2000) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      setTimeout(() => {
        routes.forEach(prefetchRoute);
      }, delay);
    });
  } else {
    setTimeout(() => {
      routes.forEach(prefetchRoute);
    }, delay + 1000);
  }
};
