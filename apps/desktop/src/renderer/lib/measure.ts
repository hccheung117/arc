/**
 * Factory for creating text measurers with specific CSS font.
 * Returns a closure that reuses Canvas context for performance.
 *
 * @param font - CSS font string (e.g., '14px ui-sans-serif, system-ui, sans-serif')
 */
export function createTextMeasurer(font: string) {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null

  return (text: string): number => {
    if (!canvas) {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      ctx.font = font
    }
    return ctx!.measureText(text).width
  }
}
