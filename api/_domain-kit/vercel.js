"use strict";
// Custom domains on one Vercel project that serves many sites
// (https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains).
// The records a domain must point at come from the config endpoint; they
// differ per project, so nothing here is hard-coded.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostError = void 0;
exports.vercelHost = vercelHost;
class HostError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "HostError";
    }
}
exports.HostError = HostError;
function vercelHost(config) {
    const fetcher = config.fetcher ?? fetch;
    const team = config.teamId ? `teamId=${encodeURIComponent(config.teamId)}` : "";
    const project = encodeURIComponent(config.projectId);
    async function call(method, path, body) {
        const url = `https://api.vercel.com${path}${team ? (path.includes("?") ? "&" : "?") + team : ""}`;
        const res = await fetcher(url, {
            method,
            headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
        });
        const json = (await res.json().catch(() => ({})));
        if (!res.ok)
            throw new HostError(`Vercel ${method} answered ${res.status}: ${json?.error?.message ?? res.statusText}`, res.status, json?.error?.code);
        return json;
    }
    return {
        /** Adds the domain to the project. Already there is fine; owned by another Vercel project is not. */
        async attach(domain) {
            try {
                const r = await call("POST", `/v10/projects/${project}/domains`, { name: domain });
                return { verified: Boolean(r.verified), verification: r.verification ?? [] };
            }
            catch (error) {
                if (error instanceof HostError && error.status === 409) {
                    throw new HostError(`${domain} is already connected to a different website host. Remove it there first, then try again.`, 409, error.code);
                }
                if (error instanceof HostError && error.status === 400 && /already|exist/i.test(error.message)) {
                    const r = await call("GET", `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`);
                    return { verified: Boolean(r.verified), verification: r.verification ?? [] };
                }
                throw error;
            }
        },
        /** Whether the project has the domain, is verified, and any ownership TXT record still needed. */
        async status(domain) {
            try {
                const r = await call("GET", `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`);
                return { attached: true, verified: Boolean(r.verified), verification: r.verification ?? [] };
            }
            catch (error) {
                if (error instanceof HostError && error.status === 404)
                    return { attached: false, verified: false, verification: [] };
                throw error;
            }
        },
        async verify(domain) {
            try {
                const r = await call("POST", `/v9/projects/${project}/domains/${encodeURIComponent(domain)}/verify`);
                return Boolean(r.verified);
            }
            catch (error) {
                if (error instanceof HostError && error.status === 400)
                    return false; // not verifiable yet
                throw error;
            }
        },
        /** The A and CNAME values this project wants, plus any ownership TXT record. */
        async target(domain, verification = []) {
            const r = await call("GET", `/v6/domains/${encodeURIComponent(domain)}/config`);
            const best = (xs) => (xs ?? []).slice().sort((a, b) => a.rank - b.rank)[0];
            return {
                a: best(r.recommendedIPv4)?.value ?? [],
                cname: best(r.recommendedCNAME)?.value?.replace(/\.$/, "").toLowerCase() ?? null,
                verification: verification.map(({ type, domain: d, value }) => ({ type, domain: d, value })),
                misconfigured: Boolean(r.misconfigured),
            };
        },
        async detach(domain) {
            try {
                await call("DELETE", `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`);
            }
            catch (error) {
                if (error instanceof HostError && error.status === 404)
                    return;
                throw error;
            }
        },
    };
}
