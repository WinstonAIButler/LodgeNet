"use strict";
// The setup flow for a domain, one safe step at a time. Each call to advance()
// does the next step and returns the updated order; calling it again after a
// crash or timeout repeats nothing harmful, because every step first checks
// whether its work is already done.
//
// Purchased: paid -> registering -> dns -> attaching -> verifying -> live
// Connected: pending -> verifying -> live
//
// Money rules: the customer is refunded automatically if anything goes wrong
// BEFORE the domain is registered (taken in the meantime, price went up, the
// registrar keeps failing). Once it's registered it belongs to the customer,
// so later trouble goes to "needs_attention" for a person to fix, not a refund.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowStop = exports.FINAL = void 0;
exports.advance = advance;
const pricing_1 = require("./pricing");
const pointing_1 = require("./pointing");
const PRE_REGISTRATION = new Set(["paid", "registering"]);
exports.FINAL = new Set(["live", "refunded", "needs_attention", "removed"]);
async function advance(order, deps) {
    const o = { ...order };
    const now = (deps.now ?? (() => new Date()))();
    const maxAttempts = deps.maxAttempts ?? 3;
    if (exports.FINAL.has(o.status))
        return o;
    try {
        await step(o, deps, now);
        o.attempts = 0;
        o.lastError = null;
    }
    catch (error) {
        o.attempts += 1;
        o.lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        const permanent = error instanceof FlowStop;
        if (permanent || o.attempts >= maxAttempts) {
            if (o.source === "purchased" && PRE_REGISTRATION.has(o.status)) {
                await deps.refund(o.lastError);
                o.status = "refunded";
                await deps.notify(`We couldn't register ${o.name}, so the payment was refunded in full. Reason: ${o.lastError}`);
            }
            else if (o.source === "purchased") {
                o.status = "needs_attention";
                await deps.notify(`${o.name} is registered to you, but setting it up got stuck: ${o.lastError} We're looking at it.`);
            }
            else if (permanent) {
                o.status = "needs_attention";
                await deps.notify(`${o.name} couldn't be connected: ${o.lastError}`);
            }
        }
    }
    return o;
}
/** Stops the flow right away (no retries), e.g. the name was taken meanwhile. */
class FlowStop extends Error {
}
exports.FlowStop = FlowStop;
async function step(o, d, now) {
    const domain = (0, pointing_1.apexOf)(o.name);
    switch (o.status) {
        case "paid": {
            if (await d.registrar.getDomain(domain)) {
                o.status = "dns";
                return;
            } // registered on an earlier try
            const [r] = await d.registrar.checkAvailability([domain]);
            if (!r || !r.purchasable)
                throw new FlowStop(`${domain} was taken by someone else before we could register it.`);
            if (r.premium || (r.purchaseType && r.purchaseType !== "registration"))
                throw new FlowStop(`${domain} is now a premium name.`);
            const yearly = (0, pricing_1.toCents)(r.purchasePrice);
            if (yearly > o.priceCents)
                throw new FlowStop(`The registry raised the price of ${domain} above what you paid.`);
            o.status = "registering";
            return;
        }
        case "registering": {
            const already = await d.registrar.getDomain(domain);
            if (!already) {
                const who = await d.registrant();
                if (!who)
                    throw new FlowStop("The owner's contact details are missing.");
                const r = await d.registrar.register(domain, o.years, who);
                o.expiresAt = r.expireDate ?? o.expiresAt;
            }
            else {
                o.expiresAt = already.expireDate ?? o.expiresAt;
            }
            o.status = "dns";
            return;
        }
        case "dns": {
            const target = await d.host.target(domain);
            const want = [
                ...target.a.map((ip) => ({ host: "", type: "A", answer: ip })),
                ...(target.cname ? [{ host: "www", type: "CNAME", answer: target.cname }] : []),
            ];
            const have = await d.registrar.listRecords(domain);
            const isApex = (h) => h === "" || h === "@" || h === domain;
            const sameSpot = (a, b) => (isApex(a.host) && isApex(b.host)) || a.host === b.host;
            // Remove parking records that would fight ours (A/AAAA/CNAME at @ and www).
            for (const r of have) {
                const clash = ["A", "AAAA", "CNAME", "ALIAS", "ANAME"].includes(r.type) && want.some((w) => sameSpot(w, r));
                const exact = want.some((w) => sameSpot(w, r) && w.type === r.type && w.answer === r.answer.replace(/\.$/, ""));
                if (clash && !exact && r.id != null)
                    await d.registrar.deleteRecord(domain, r.id);
            }
            for (const w of want) {
                const exists = have.some((r) => sameSpot(w, r) && r.type === w.type && r.answer.replace(/\.$/, "") === w.answer);
                if (!exists)
                    await d.registrar.createRecord(domain, w);
            }
            o.status = "attaching";
            return;
        }
        case "attaching":
        case "pending": {
            await d.host.attach(domain);
            await d.host.attach(`www.${domain}`).catch(() => undefined); // www is a nice-to-have
            o.status = "verifying";
            return;
        }
        case "verifying": {
            const st = await d.host.status(domain);
            if (!st.attached) {
                await d.host.attach(domain);
            }
            const target = await d.host.target(domain, st.verification);
            o.lastCheck = await (0, pointing_1.checkPointing)(domain, target, d.lookup, now);
            const verified = st.verified || (await d.host.verify(domain));
            if (verified && o.lastCheck.items.filter((i) => i.label.startsWith(domain)).every((i) => i.ok)) {
                o.status = "live";
                await d.notify(`${domain} is live and points at your site.`);
                return;
            }
            const hours = (now.getTime() - new Date(o.createdAt).getTime()) / 3_600_000;
            if (hours > (d.verifyHours ?? 72)) {
                o.status = "needs_attention";
                await d.notify(`${domain} still doesn't point at your site after ${Math.round(hours)} hours. Check the records shown on the Domains card.`);
            }
            return; // not yet; the next check tries again
        }
        default:
            return;
    }
}
