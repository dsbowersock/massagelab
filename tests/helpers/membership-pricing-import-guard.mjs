/**
 * Matches static, dynamic, or CommonJS imports of the display-only membership
 * pricing catalog so payment-authority tests share one fail-closed boundary.
 */
export const MEMBERSHIP_PRICING_IMPORT_PATTERN = /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"'\r\n]*membership-pricing[^"'\r\n]*["']/
