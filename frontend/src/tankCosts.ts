/** Parse litres into integer decilitres; accept German and decimal-point input. */
export function parseTankVolume(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d)?$/.test(normalized)) return null
  const decilitres = Math.round(Number(normalized) * 10)
  return decilitres >= 1 && decilitres <= 2000 ? decilitres : null
}

/** Prices have three decimal places. Round each complete fill to cents. */
export function fillCostCents(price: number | undefined, decilitres: number | null): number | null {
  if (price === undefined || !Number.isFinite(price) || price <= 0 || decilitres === null ||
      !Number.isInteger(decilitres) || decilitres < 1 || decilitres > 2000) return null
  const mills = Math.round(price * 1000)
  const product = mills * decilitres
  if (mills <= 0 || !Number.isSafeInteger(product)) return null
  return Math.round(product / 100)
}

export const euroFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export const litreFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
