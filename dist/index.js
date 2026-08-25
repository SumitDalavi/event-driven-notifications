"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worker = exports.notifyQueue = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const bullmq_1 = require("bullmq");
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};
const notifyQueue = new bullmq_1.Queue('ai-notifications', { connection });
exports.notifyQueue = notifyQueue;
app.post('/notify', async (req, res) => {
    const { eventType, payload } = req.body;
    if (!eventType || !payload) {
        return res.status(400).json({ error: 'Missing eventType or payload' });
    }
    const job = await notifyQueue.add('send-notification', { eventType, payload });
    res.json({ jobId: job.id, status: 'queued' });
});
const worker = new bullmq_1.Worker('ai-notifications', async (job) => {
    // Mock processing event
    console.log(`Processing event ${job.data.eventType}`);
    return { success: true };
}, { connection });
exports.worker = worker;
if (require.main === module) {
    app.listen(3000, () => console.log('Event Driven Notifications on port 3000'));
}
