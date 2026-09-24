const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://copysupport01_db_user:PlSbN6jBaGZyUZ0m@cluster0.p02ss9y.mongodb.net/ecopy?retryWrites=true&w=majority';

// Serverless Mongoose connection caching to prevent connection spikes
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Middleware to ensure DB is connected for all requests
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ success: false, message: 'Database connection failed', error: err.message });
  }
});

// PrintJob Schema
const printJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true },
  kioskId: { type: String, default: 'EX-MAIN' },
  fileName: { type: String, required: true },
  fileSizeMB: { type: Number, default: 0 },
  fileType: { type: String, default: 'pdf' },
  totalPages: { type: Number, default: 1 },
  pageRange: { type: String, default: 'All' },
  pagesToPrintCount: { type: Number, default: 1 },
  isColor: { type: Boolean, default: false },
  isDuplex: { type: Boolean, default: false },
  copies: { type: Number, default: 1 },
  paperSize: { type: String, default: 'A4' },
  layoutMode: { type: String, default: '1-Up' },
  finishing: { type: String, default: 'None' },
  couponApplied: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  pinToken: { type: String, default: '' },
  totalCost: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'], 
    default: 'PENDING' 
  },
  queuePosition: { type: Number, default: 1 },
  isPasswordProtected: { type: Boolean, default: false },
  paymentStatus: { type: String, default: 'SUCCESS' },
  paymentMethod: { type: String, default: 'UPI' },
  transactionId: { type: String, default: '' },
  filterMode: { type: String, default: 'bw' },
  rotation: { type: Number, default: 0 },
  filePreviewData: { type: String, default: null },
  notes: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'printjobs',
  strict: false
});

const PrintJob = mongoose.models.PrintJob || mongoose.model('PrintJob', printJobSchema);

// --- REST Endpoints ---

// 1. Root & Health Check
app.get('/', (req, res) => {
  res.json({
    message: '🚀 E-Copy Print Jobs Backend API is Live!',
    endpoints: {
      health: '/api/health',
      stats: '/api/stats',
      printjobs: '/api/printjobs'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// 2. Stats
app.get('/api/stats', async (req, res) => {
  try {
    const totalJobs = await PrintJob.countDocuments();
    const printingJobs = await PrintJob.countDocuments({ status: 'PRINTING' });
    const pendingJobs = await PrintJob.countDocuments({ status: 'PENDING' });
    const completedJobs = await PrintJob.countDocuments({ status: 'COMPLETED' });
    const failedJobs = await PrintJob.countDocuments({ status: { $in: ['FAILED', 'CANCELLED'] } });

    const revenueResult = await PrintJob.aggregate([
      { $match: { paymentStatus: 'SUCCESS' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalCost' }, totalPages: { $sum: '$pagesToPrintCount' } } }
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    const totalPagesPrinted = revenueResult.length > 0 ? revenueResult[0].totalPages : 0;

    res.json({
      success: true,
      stats: {
        totalJobs,
        printingJobs,
        pendingJobs,
        completedJobs,
        failedJobs,
        totalRevenue,
        totalPagesPrinted
      }
    });
  } catch (error) {
    console.error('Error in stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get all Print Jobs
app.get('/api/printjobs', async (req, res) => {
  try {
    const { status, kioskId, q, sortBy = 'createdAt', order = 'desc' } = req.query;
    let filter = {};

    if (status && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    if (kioskId && kioskId !== 'ALL') {
      filter.kioskId = kioskId;
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { jobId: regex },
        { fileName: regex },
        { pinToken: regex },
        { transactionId: regex },
        { kioskId: regex }
      ];
    }

    const sortOption = {};
    sortOption[sortBy] = order === 'asc' ? 1 : -1;

    const jobs = await PrintJob.find(filter).sort(sortOption).lean();

    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('Error fetching print jobs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Get single Print Job
app.get('/api/printjobs/:id', async (req, res) => {
  try {
    const job = await PrintJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Print job not found' });
    }
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Update Job Status
app.patch('/api/printjobs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const job = await PrintJob.findByIdAndUpdate(
      req.params.id,
      { $set: { status: status.toUpperCase() } },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, message: 'Print job not found' });
    }

    res.json({ success: true, message: 'Status updated', job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Delete a Job
app.delete('/api/printjobs/:id', async (req, res) => {
  try {
    const deleted = await PrintJob.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Print job not found' });
    }
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Create/Add a Print Job
app.post('/api/printjobs', async (req, res) => {
  try {
    const newJob = new PrintJob({
      ...req.body,
      jobId: req.body.jobId || `JOB-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    });
    const savedJob = await newJob.save();
    res.status(201).json({ success: true, job: savedJob });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = app;
