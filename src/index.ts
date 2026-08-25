import express, { Request, Response } from 'express';
import { Queue, Worker } from 'bullmq';

const app = express();
app.use(express.json());

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

const notifyQueue = new Queue('ai-notifications', { connection });

app.post('/notify', async (req: Request, res: Response) => {
    const { eventType, payload } = req.body;
    
    if (!eventType || !payload) {
        return res.status(400).json({ error: 'Missing eventType or payload' });
    }

    const job = await notifyQueue.add('send-notification', { eventType, payload });
    res.json({ jobId: job.id, status: 'queued' });
});

const worker = new Worker('ai-notifications', async job => {
    // Mock processing event
    console.log(`Processing event ${job.data.eventType}`);
    return { success: true };
}, { connection });

if (require.main === module) {
    app.listen(3000, () => console.log('Event Driven Notifications on port 3000'));
}

export { app, notifyQueue, worker };
