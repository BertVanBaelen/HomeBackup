import '@testing-library/jest-dom/vitest'

// jsdom lacks pointer capture, which the hold button uses on touch devices.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

// jsdom lacks ResizeObserver and document.fonts, which the swipe tabs measure with.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
if (!('fonts' in document)) Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() } })
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia
// Radix Select scrolls the chosen option into view; vaul's drawer reads computed transforms.
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.setPointerCapture ??= () => {}
