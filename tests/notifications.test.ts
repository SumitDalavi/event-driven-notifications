import request from 'supertest';
import { app, metrics, preferencesDb } from '../src/index';

describe('Event Driven Notifications', () => {
    beforeEach(() => {
        metrics.received = 0;
        metrics.delivered = 0;
        metrics.suppressed = 0;
        metrics.failed = 0;
    });

    it('should queue and deliver a notification when user is opted in', async () => {
        // user-1 has email and sms enabled
        const res = await request(app).post('/notify').send({
            userId: 'user-1',
            eventType: 'ALERT',
            payload: { message: 'High CPU' },
            channels: ['email', 'sms']
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.jobId).toBeDefined();

        // Wait for engine to process
        await new Promise(r => setTimeout(r, 50));

        expect(metrics.received).toBe(1);
        expect(metrics.delivered).toBe(1);
        expect(metrics.suppressed).toBe(0);
        expect(metrics.failed).toBe(0);
    });

    it('should suppress notification if user opted out', async () => {
        // user-2 has email disabled, sms enabled. We send to email only.
        const res = await request(app).post('/notify').send({
            userId: 'user-2',
            eventType: 'ALERT',
            payload: { message: 'High CPU' },
            channels: ['email']
        });

        expect(res.statusCode).toEqual(200);

        await new Promise(r => setTimeout(r, 50));

        expect(metrics.received).toBe(1);
        expect(metrics.delivered).toBe(0);
        expect(metrics.suppressed).toBe(1); // Suppressed!
    });

    it('should deliver to SMS but suppress Email for partial opt-out', async () => {
        // user-2 has email disabled, sms enabled.
        await request(app).post('/notify').send({
            userId: 'user-2',
            eventType: 'ALERT',
            payload: { message: 'High CPU' },
            channels: ['email', 'sms']
        });

        await new Promise(r => setTimeout(r, 50));

        expect(metrics.received).toBe(1);
        expect(metrics.delivered).toBe(1); // One successful delivery (SMS)
        expect(metrics.suppressed).toBe(0);
    });

    it('should track failures during provider outage', async () => {
        await request(app).post('/notify').send({
            userId: 'user-1',
            eventType: 'ALERT',
            payload: { simulateError: 'email' },
            channels: ['email']
        });

        await new Promise(r => setTimeout(r, 50));

        expect(metrics.received).toBe(1);
        expect(metrics.failed).toBe(1);
        expect(metrics.delivered).toBe(0);
    });

    it('should update user preferences dynamically', async () => {
        const res = await request(app).post('/preferences').send({
            userId: 'user-99',
            emailEnabled: false,
            smsEnabled: false,
            pushEnabled: false
        });

        expect(res.statusCode).toEqual(200);
        expect(preferencesDb['user-99'].emailEnabled).toBe(false);

        // Try to send, should be suppressed
        await request(app).post('/notify').send({
            userId: 'user-99',
            eventType: 'ALERT',
            payload: { message: 'Hi' },
            channels: ['email']
        });

        await new Promise(r => setTimeout(r, 50));
        expect(metrics.suppressed).toBe(1);
    });
});
