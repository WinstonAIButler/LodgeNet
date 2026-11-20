"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PRICING = void 0;
exports.salePrice = salePrice;
exports.toCents = toCents;
exports.quoteFrom = quoteFrom;
exports.formatCents = formatCents;
exports.DEFAULT_PRICING = { markupCents: 800, minimumCents: 1499 };
/** Wholesale + markup, never below the minimum, rounded up to the next .99. */
function salePrice(wholesaleCents, rules = exports.DEFAULT_PRICING) {
    const raw = Math.max(wholesaleCents + rules.markupCents, rules.minimumCents);
    return Math.ceil((raw + 1) / 100) * 100 - 1;
}
/** Name.com prices come as dollars (12.99); we work in whole cents. */
function toCents(dollars) {
    return Math.round(Number(dollars ?? 0) * 100);
}
/**
 * Turns a registrar result into a customer quote. Premium and aftermarket names
 * are left out for now. The customer pays one steady yearly price, based on the
 * higher of the registration and renewal wholesale prices, so year two never
 * costs more than year one.
 */
function quoteFrom(r, rules = exports.DEFAULT_PRICING) {
    const wholesale = toCents(r.purchasePrice);
    const wholesaleRenewal = toCents(r.renewalPrice ?? r.purchasePrice);
    let reason;
    if (!r.purchasable)
        reason = "Already taken";
    else if (r.premium)
        reason = "Premium name (not sold here yet)";
    else if (r.purchaseType && r.purchaseType !== "registration")
        reason = "Sold by its current owner (not sold here yet)";
    else if (!wholesale)
        reason = "No price available";
    return {
        domain: r.domainName.toLowerCase(),
        available: !reason,
        priceCents: reason ? 0 : salePrice(Math.max(wholesale, wholesaleRenewal), rules),
        renewalCents: reason ? 0 : salePrice(Math.max(wholesale, wholesaleRenewal), rules),
        wholesaleCents: wholesale,
        wholesaleRenewalCents: wholesaleRenewal,
        reason,
    };
}
/** "$19.99" */
function formatCents(cents) {
    return `$${(cents / 100).toFixed(2)}`;
}
