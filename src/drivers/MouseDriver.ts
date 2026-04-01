import { ButtonDriver } from './ButtonDriver'

// MouseDriver behaves identically to ButtonDriver — moves are injected
// from CubeCanvas mouse events rather than UI buttons.
export class MouseDriver extends ButtonDriver {}
