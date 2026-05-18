export interface CaptureOpts {
  hide: HTMLElement | null
}

export async function captureViewportBase64(opts: CaptureOpts): Promise<{ png: string; width: number; height: number }> {
  const prev = opts.hide?.style.display ?? ''
  if (opts.hide) opts.hide.style.display = 'none'
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(document.body, {
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      logging: false,
    })
    const dataUrl = canvas.toDataURL('image/png')
    const png = dataUrl.split(',')[1] ?? ''
    return { png, width: canvas.width, height: canvas.height }
  } finally {
    if (opts.hide) opts.hide.style.display = prev
  }
}
