import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { afterAll, describe, expect, it } from "vitest";
import { LtiError, type LtiService } from "./lti.js";
import { registerLtiRoutes } from "./lti-routes.js";

/** ROADMAP §10: the LMS's open login and launch, limited per client address. */

const app = Fastify().withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
const lti = {
  login: async () => "https://lms.test/mod/lti/auth.php",
  launch: async () => {
    throw new LtiError("invalid_launch", "That launch is not valid");
  },
} as unknown as LtiService;
registerLtiRoutes(app, { lti, staff: async () => null, limit: { perSecond: 0.001, burst: 3 } });

afterAll(async () => {
  await app.close();
});

describe("the open LTI endpoints", () => {
  it("answer 429 to one address past its bucket, shared by login and launch, and not to another", async () => {
    const login = (ip: string) => app.inject({ method: "GET", url: "/lti/login?iss=https%3A%2F%2Flms.test", remoteAddress: ip });
    expect((await login("10.0.0.1")).statusCode).toBe(302);
    const form = await app.inject({ method: "POST", url: "/lti/login", remoteAddress: "10.0.0.1", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "iss=https%3A%2F%2Flms.test" });
    expect(form.statusCode).toBe(302);
    const launch = await app.inject({ method: "POST", url: "/lti/launch", remoteAddress: "10.0.0.1", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "id_token=not-a-real-token&state=not-a-real-state" });
    expect(launch.statusCode).toBe(400);

    const refused = await login("10.0.0.1");
    expect(refused.statusCode).toBe(429);
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    expect(refused.headers["content-type"]).toContain("text/html");
    expect(refused.payload).toContain("Too many launches from this network");

    expect((await login("10.0.0.2")).statusCode).toBe(302);
  });
});
