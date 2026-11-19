import '@testing-library/jest-dom/vitest'

// jsdom lacks pointer capture, which the hold button uses on touch devices.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
