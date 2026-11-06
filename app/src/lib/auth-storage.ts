/** En web, el localStorage del navegador. */
export const authStorage = typeof localStorage === 'undefined' ? undefined : localStorage;
