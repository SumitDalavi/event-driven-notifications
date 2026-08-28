import express, { Request, Response } from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// --- Core Models & Mock Database ---
export interface UserPreferences {
    userId: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
}

const preferencesDb: Record<string, UserPreferences> = {
    'user-1': { userId: 'user-1', emailEnabled: true, smsEnabled: true, pushEnabled: true },
    'user-2': { userId: 'user-2', emailEnabled: false, smsEnabled: true, pushEnabled: true }, // Opted out of email
    'user-3': { userId: 'user-3', emailEnabled: false, smsEnabled: false, pushEnabled: false }, // Fully opted out
};

// --- Observability Metrics ---
export const metrics = {
    received: 0,
    delivered: 0,
    suppressed: 0,
    failed: 0
};

// --- Provider Adapters ---
abstract class NotificationProvider {
    abstract name: string;
    abstract send(userId: string, payload: any): Promise<boolean>;
}

class EmailProvider extends NotificationProvider {
    name = 'EMAIL';
    async send(userId: string, payload: any) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 10));
        if (payload.simulateError === 'email') throw new Error('Email provider outage');
        return true;
    }
}

class SMSProvider extends NotificationProvider {
    name = 'SMS';
    async send(userId: string, payload: any) {
        await new Promise(r => setTimeout(r, 10));
        if (payload.simulateError === 'sms') throw new Error('SMS provider outage');
        return true;
    }
}

const providers = {
    email: new EmailProvider(),
    sms: new SMSProvider()
};

// --- Local Queue & Delivery Engine ---
interface Job {
    id: string;
    userId: string;
    eventType: string;
    payload: any;
    channels: ('email' | 'sms')[];
}

class NotificationEngine {
    private queue: Job[] = [];
    private isProcessing = false;

    async add(jobReq: Omit<Job, 'id'>) {
        const job = { ...jobReq, id: crypto.randomUUID() };
        this.queue.push(job);
        metrics.received++;
        this.processQueue();
        return job.id;
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const job = this.queue.shift()!;
            
            // 1. Fetch Preferences (Routing Policy)
            const prefs = preferencesDb[job.userId] || { emailEnabled: true, smsEnabled: true };
            
            // 2. Filter channels based on preferences
            const activeChannels = job.channels.filter(ch => {
                if (ch === 'email') return prefs.emailEnabled;
                if (ch === 'sms') return prefs.smsEnabled;
                return false;
            });

            if (activeChannels.length === 0) {
                metrics.suppressed++;
                continue; // Suppressed due to opt-out
            }

            // 3. Dispatch to Provider Adapters with Delivery Guarantees (basic retry skipped for brevity, tracking success)
            try {
                await Promise.all(activeChannels.map(ch => providers[ch].send(job.userId, job.payload)));
                metrics.delivered++;
            } catch (err) {
                metrics.failed++;
                // In a robust system, this routes to a DLQ/Retry engine.
            }
        }
        this.isProcessing = false;
    }
}

const engine = new NotificationEngine();

// --- API Endpoints ---
app.post('/notify', async (req: Request, res: Response) => {
    const { userId, eventType, payload, channels } = req.body;
    
    if (!userId || !eventType || !payload || !channels) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const jobId = await engine.add({ userId, eventType, payload, channels });
    res.json({ jobId, status: 'queued' });
});

app.get('/metrics', (req: Request, res: Response) => {
    res.json({ metrics });
});

app.post('/preferences', (req: Request, res: Response) => {
    const { userId, emailEnabled, smsEnabled, pushEnabled } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    
    preferencesDb[userId] = { userId, emailEnabled, smsEnabled, pushEnabled };
    res.json({ success: true, preferences: preferencesDb[userId] });
});

export async function startServer() {
    return app.listen(3000, () => console.log('Event Driven Notifications on port 3000'));
}

if (require.main === module) {
    startServer();
}

export { app, engine, preferencesDb };
