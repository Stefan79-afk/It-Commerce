import { jest } from "@jest/globals";

jest.unstable_mockModule("mongoose", () => {
    function MockSchema() {}
    MockSchema.prototype.index = jest.fn();
    return {
        default: {
            Schema: MockSchema,
            model: jest.fn(() => ({})),
            connect: jest.fn().mockResolvedValue({}),
            connection: {
                db: {
                    admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }),
                },
            },
        },
    };
});

const { default: app } = await import("../src/app.js");
const { default: request } = await import("supertest");

describe("Orders Service", () => {
    test("GET /api/v1/health returns 200 with status ok", async () => {
        const res = await request(app).get("/api/v1/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
    });

    test("unknown route returns 404", async () => {
        const res = await request(app).get("/api/v1/nonexistent");
        expect(res.status).toBe(404);
    });
});
