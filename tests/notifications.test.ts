import request from 'supertest';

jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn().mockResolvedValue({ id: 'job-1' })
    })),
    Worker: jest.fn().mockImplementation(() => ({
        close: jest.fn()
    }))
}));

import { app, notifyQueue, worker } from '../src/index';

describe('Event Driven Notifications API', () => {
    afterAll(async () => {
        await worker.close();
    });

    it('should queue notification', async () => {
        const res = await request(app).post('/notify').send({
            eventType: 'model_drift',
            payload: { metric: 0.85 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.jobId).toEqual('job-1');
        expect(notifyQueue.add).toHaveBeenCalledWith('send-notification', {
            eventType: 'model_drift',
            payload: { metric: 0.85 }
        });
    });

    it('should fail on invalid request', async () => {
        const res = await request(app).post('/notify').send({
            payload: {}
        });
        expect(res.statusCode).toEqual(400);
    });
});
