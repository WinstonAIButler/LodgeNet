"use strict";
// Name.com Core API v1 (https://docs.name.com/api/v1/overview.md).
// Sandbox: https://api.dev.name.com (username ends in -test, $100k of test credit).
// Production: https://api.name.com. HTTP Basic auth with username + API token.
// Limits: 20 requests/second, 3,000/hour; a 429 is retried after Retry-After.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrarError = void 0;
exports.nameComBaseUrl = nameComBaseUrl;
exports.nameCom = nameCom;
class RegistrarError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "RegistrarError";
    }
}
exports.RegistrarError = RegistrarError;
function nameComBaseUrl(env) {
    return (env ?? "").trim().toLowerCase() === "production" ? "https://api.name.com" : "https://api.dev.name.com";
}
const sleepFor = (ms) => new Promise((r) => setTimeout(r, ms));
function nameCom(config) {
    const base = nameComBaseUrl(config.env);
    const fetcher = config.fetcher ?? fetch;
    const sleep = config.sleep ?? sleepFor;
    const auth = "Basic " + btoa(`${config.username}:${config.token}`);
    async function call(method, path, body) {
        for (let attempt = 0;; attempt++) {
            const res = await fetcher(base + path, {
                method,
                headers: { authorization: auth, "content-type": "application/json", accept: "application/json" },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(30_000),
            });
            if (res.status === 429 && attempt < 3) {
                const wait = Number(res.headers.get("retry-after")) || 2 ** attempt;
                await sleep(Math.min(wait, 30) * 1000);
                continue;
            }
            const text = await res.text();
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            }
            catch {
                json = text;
            }
            if (!res.ok) {
                const msg = (json && typeof json === "object" && "message" in json ? String(json.message) : "") || text || res.statusText;
                throw new RegistrarError(`Name.com ${method} ${path.split("?")[0]} answered ${res.status}: ${msg}`.slice(0, 400), res.status, json);
            }
            return json;
        }
    }
    const enc = encodeURIComponent;
    return {
        /** Up to 50 exact names. */
        async checkAvailability(domains) {
            const r = await call("POST", "/core/v1/domains:checkAvailability", { domainNames: domains.slice(0, 50) });
            return r?.results ?? [];
        },
        /** Suggestions for a word, optionally limited to some endings (com, net, ...). */
        async search(keyword, tlds) {
            const r = await call("POST", "/core/v1/domains:search", {
                keyword,
                ...(tlds?.length ? { tldFilter: tlds.slice(0, 50) } : {}),
            });
            return r?.results ?? [];
        },
        /**
         * Registers a standard (non-premium) name. purchasePrice is omitted, as the
         * docs say to for standard registrations; the flow checks the price first.
         */
        async register(domain, years, registrant) {
            const contacts = { registrant, admin: registrant, tech: registrant, billing: registrant };
            const r = await call("POST", "/core/v1/domains", {
                domain: { domainName: domain, contacts },
                years,
                privacyEnabled: true,
            });
            return { expireDate: r?.domain?.expireDate };
        },
        async getDomain(domain) {
            try {
                return await call("GET", `/core/v1/domains/${enc(domain)}`);
            }
            catch (error) {
                if (error instanceof RegistrarError && error.status === 404)
                    return null;
                throw error;
            }
        },
        async renew(domain, years = 1) {
            const r = await call("POST", `/core/v1/domains/${enc(domain)}:renew`, { years });
            return { expireDate: r?.domain?.expireDate };
        },
        async setAutorenew(domain, on) {
            await call("PATCH", `/core/v1/domains/${enc(domain)}`, { autorenewEnabled: on });
        },
        async listRecords(domain) {
            const r = await call("GET", `/core/v1/domains/${enc(domain)}/records?perPage=1000`);
            return r?.records ?? [];
        },
        async createRecord(domain, rec) {
            await call("POST", `/core/v1/domains/${enc(domain)}/records`, { host: rec.host, type: rec.type, answer: rec.answer, ttl: rec.ttl ?? 300 });
        },
        async deleteRecord(domain, id) {
            await call("DELETE", `/core/v1/domains/${enc(domain)}/records/${id}`);
        },
        async balance() {
            return call("GET", "/core/v1/accountinfo/balance");
        },
    };
}
