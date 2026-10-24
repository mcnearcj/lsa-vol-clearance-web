// True only in the demo build (VITE_DEV_SITE=1 npm run build): it shows a "work in progress" banner and a Migration info
// tab for the school's webmaster. A normal build has neither; the constant is replaced at build time, so that code is left out.
export const DEV_SITE: boolean = import.meta.env.VITE_DEV_SITE === '1'
