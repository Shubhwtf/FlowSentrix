import { FastifyRequest, FastifyReply } from 'fastify';

export const requireApiKey = (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
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
