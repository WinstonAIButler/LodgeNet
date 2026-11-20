"use strict";
// Checks, as the public internet sees it, whether a domain points at the host,
// and says what's right and wrong in plain words.
Object.defineProperty(exports, "__esModule", { value: true });
exports.apexOf = apexOf;
exports.recordsToSet = recordsToSet;
exports.checkPointing = checkPointing;
/** "www.Rosas.com." -> "rosas.com" (the name people type, without www). */
function apexOf(domain) {
    return domain.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}
/** The records a customer sets at the company where they bought their domain. */
function recordsToSet(domain, target) {
    const apex = apexOf(domain);
    const out = [];
    for (const ip of target.a)
        out.push({ type: "A", host: "@", value: ip });
    if (target.cname)
        out.push({ type: "CNAME", host: "www", value: target.cname });
    for (const v of target.verification) {
        const host = v.domain.toLowerCase().replace(/\.$/, "");
        out.push({ type: v.type, host: host === apex ? "@" : host.endsWith("." + apex) ? host.slice(0, -apex.length - 1) : host, value: v.value });
    }
    return out;
}
async function checkPointing(domain, target, lookup, now = new Date()) {
    const apex = apexOf(domain);
    const items = [];
    const safe = async (name, type) => lookup(name, type).catch(() => []);
    if (target.a.length) {
        const got = await safe(apex, "A");
        const want = new Set(target.a);
        const ok = got.length > 0 && got.every((ip) => want.has(ip));
        items.push({
            label: `${apex} (A record)`,
            ok,
            detail: ok ? "Points at your site." : got.length ? `Points at ${got.join(", ")} instead of ${target.a.join(", ")}.` : `Not set yet. Add an A record for @ with the value ${target.a[0]}.`,
        });
    }
    if (target.cname) {
        const www = `www.${apex}`;
        const got = (await safe(www, "CNAME")).map((c) => c.replace(/\.$/, ""));
        const ok = got.includes(target.cname);
        items.push({
            label: `${www} (CNAME record)`,
            ok,
            detail: ok ? "Points at your site." : got.length ? `Points at ${got[0]} instead of ${target.cname}.` : `Not set yet. Add a CNAME record for www with the value ${target.cname}.`,
        });
    }
    for (const v of target.verification) {
        const got = await safe(v.domain, "TXT");
        const ok = got.includes(v.value);
        items.push({ label: `${v.domain} (${v.type} record)`, ok, detail: ok ? "Ownership confirmed." : `Add a ${v.type} record for ${v.domain} with the value ${v.value}.` });
    }
    return { ok: items.length > 0 && items.every((i) => i.ok), checkedAt: now.toISOString(), items };
}
