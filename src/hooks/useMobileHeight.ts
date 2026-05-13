import { useEffect } from 'react';

/**
 * Hook to handle the 100vh issue on mobile browsers (especially PWA standalone mode)
 * by setting a --vh CSS variable based on window.innerHeight.
 */
export function useMobileHeight() {
  useEffect(() => {
    const setHeight = () => {
      // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
      let vh = window.innerHeight * 0.01;
      // Then we set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setHeight();
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);

    return () => {
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
    };
  }, []);
}
