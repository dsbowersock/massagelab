/**
 * Matches static, dynamic, or CommonJS imports with the exact display-only
 * membership-pricing module basename and an optional standard JS/TS extension.
 * This raw-source fail-closed boundary intentionally also flags commented-out
 * exact imports so protected payment-authority files cannot park one dormant.
 */
export const MEMBERSHIP_PRICING_IMPORT_PATTERN = /(?:(?:\bfrom\s*|\bimport\s+)["'](?:[^"'\r\n]*\/)?membership-pricing(?:\.[cm]?[jt]sx?)?["']|\b(?:import|require)\s*\(\s*(?:["'](?:[^"'\r\n]*\/)?membership-pricing(?:\.[cm]?[jt]sx?)?["']|`(?:[^`\r\n]*\/)?membership-pricing(?:\.[cm]?[jt]sx?)?`))/
