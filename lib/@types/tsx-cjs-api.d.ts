declare module 'tsx/cjs/api' {
  type Unregister = () => void;

  export const require: (id: string, fromFile: string | URL) => unknown;
  export const register: (options?: { namespace?: string }) => Unregister;
}
