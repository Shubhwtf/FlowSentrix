"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireApiKey = void 0;
const requireApiKey = (request, reply, done) => {
    const configuredKey = process.env.API_KEY;
    if (!configuredKey) {
        done();
        return;
    }
    const providedKey = request.headers['x-api-key'];
    if (!providedKey || providedKey !== configuredKey) {
        reply.status(401).send({ error: 'unauthorized' });
        return;
    }
    done();
};
exports.requireApiKey = requireApiKey;
