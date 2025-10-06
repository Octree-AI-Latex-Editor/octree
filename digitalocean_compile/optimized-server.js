const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const port = 3001;
const HISTORY_DIR = process.env.HISTORY_DIR || path.join(__dirname, 'logs');
function persistMetadata(metadata) {
  try {
    if (!metadata?.requestId) return;
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    const filePath = path.join(HISTORY_DIR, `${metadata.requestId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error(`[${metadata?.requestId || 'unknown'}] Failed to persist metadata:`, err.message);
  }
}

// Request queue to prevent overload
let requestQueue = [];
let isProcessing = false;
const MAX_CONCURRENT_REQUESTS = 2;
const MAX_LOG_CHARS = 5000;
const LOG_TAIL_LINES = 80;

function truncateText(text = '', max = MAX_LOG_CHARS) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(-max);
}

function tailLines(text = '', maxLines = LOG_TAIL_LINES) {
  if (!text) return '';
  const lines = text.split('\n');
  return lines.slice(-maxLines).join('\n');
}

app.use(cors());
app.use(bodyParser.text({ type: 'text/plain', limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', queueLength: requestQueue.length, isProcessing });
});

// Process queue
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  
  while (requestQueue.length > 0) {
    const job = requestQueue.shift();
    if (!job) continue;
    await handleCompilation(job);
  }
  
  isProcessing = false;
}

// Main compilation endpoint
app.post('/compile', (req, res, next) => {
  // Add to queue if we're at capacity
  if (requestQueue.length >= MAX_CONCURRENT_REQUESTS) {
    return res.status(503).json({
      error: 'Server busy',
      message: 'Too many compilation requests. Please try again in a moment.',
      queuePosition: requestQueue.length + 1
    });
  }
  
  requestQueue.push({ req, res, next, enqueuedAt: Date.now() });
  processQueue();
});

async function handleCompilation(job) {
  const { req, res, next, enqueuedAt = Date.now() } = job;
  const requestId = randomUUID();
  const receivedAt = Date.now();
  const queueMs = Math.max(0, receivedAt - enqueuedAt);
  const metadata = {
    requestId,
    enqueuedAt,
    receivedAt,
    queueMs,
    status: 'processing',
  };
  console.log(`[${requestId}] ==== COMPILE REQUEST RECEIVED ====`);
  
  // Handle both JSON ({"content": "..."}) and raw text body
  let texString;
  if (typeof req.body === 'object' && req.body.content) {
    texString = req.body.content;
  } else if (Buffer.isBuffer(req.body)) {
    texString = req.body.toString('utf8');
  } else {
    texString = req.body;
  }
  
  // Log the first 120 chars of the content
  console.log(`[${requestId}] TeX preview: ${texString.substring(0, 120).replace(/\n/g, ' ')}...`);
  console.log(`[${requestId}] Content length: ${texString.length} bytes`);
  console.log(`[${requestId}] Estimated queue wait: ${queueMs}ms`);
  
  // Create temporary directory
  const tempDir = fs.mkdtempSync('/tmp/latex-');
  const texFilePath = path.join(tempDir, 'main.tex');
  const pdfPath = path.join(tempDir, 'main.pdf');
  const logPath = path.join(tempDir, 'main.log');
  const jsonPath = path.join(tempDir, 'compile-meta.json');
  
  try {
    // Write TeX content to file
    fs.writeFileSync(texFilePath, texString);
    fs.writeFileSync(jsonPath, JSON.stringify({ ...metadata, status: 'written' }, null, 2));
    persistMetadata({ ...metadata, status: 'written' });
    console.log(`[${requestId}] TeX content written to: ${texFilePath}`);
    
    // Run LaTeX compilation
    console.log('Spawning LaTeX compilation process...');
    
    const result = await new Promise((resolve, reject) => {
      // Use pdflatex directly instead of the run-latex.sh script
      const child = exec(`pdflatex -interaction=nonstopmode -halt-on-error -file-line-error -output-directory=${tempDir} ${texFilePath}`, {
        cwd: tempDir,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        metadata.status = code === 0 ? 'success' : 'error';
        metadata.exitCode = code;
        metadata.completedAt = Date.now();
        metadata.durationMs = metadata.completedAt - receivedAt;
        metadata.stdoutBytes = stdout.length;
        metadata.stderrBytes = stderr.length;
        fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
        persistMetadata(metadata);
        console.log(`[${requestId}] LaTeX process exited with code: ${code}`);
        console.log(`[${requestId}] stdout length: ${stdout.length}`);
        console.log(`[${requestId}] stderr length: ${stderr.length}`);
        
        resolve({ code, stdout, stderr });
      });
      
      child.on('error', (error) => {
        console.error('Child process error:', error);
        reject(error);
      });
    });
    
    // Check if PDF was created
    if (fs.existsSync(pdfPath)) {
      console.log('PDF created successfully');
      
      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      console.log(`PDF size: ${pdfBuffer.length} bytes`);
      
      // Verify it's a valid PDF
      const firstBytes = pdfBuffer.slice(0, 4).toString('hex');
      if (firstBytes !== '25504446') {
        throw new Error(`Invalid PDF format. First bytes: ${firstBytes}`);
      }
      
      // Set response headers
      metadata.status = 'success';
      metadata.completedAt = metadata.completedAt || Date.now();
      metadata.durationMs = metadata.completedAt - receivedAt;
      metadata.pdfSize = pdfBuffer.length;
      metadata.sha256 = require('crypto').createHash('sha256').update(pdfBuffer).digest('hex');
      metadata.logTail = fs.existsSync(logPath) ? tailLines(truncateText(fs.readFileSync(logPath, 'utf-8'))) : undefined;
      fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
      persistMetadata(metadata);
      res.setHeader('X-Compile-Request-Id', requestId);
      res.setHeader('X-Compile-Duration-Ms', String(metadata.durationMs));
      res.setHeader('X-Compile-Queue-Ms', String(queueMs));
      res.setHeader('X-Compile-Sha256', metadata.sha256);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', 'attachment; filename="compiled.pdf"');
      
      // Send PDF
      res.send(pdfBuffer);
      
      console.log('PDF sent successfully');
    } else {
      // PDF not created, check log file
      let logContent = '';
      if (fs.existsSync(logPath)) {
        logContent = fs.readFileSync(logPath, 'utf-8');
        console.log(`[${requestId}] LaTeX log excerpt: ${logContent.substring(0, 500)}`);
      }
      
      const responsePayload = {
        error: 'LaTeX compilation failed',
        code: result.code,
        requestId,
        queueMs,
        durationMs: metadata.durationMs,
        stdout: truncateText(result.stdout),
        stderr: truncateText(result.stderr),
        log: tailLines(logContent),
      };
      metadata.status = 'error';
      metadata.exitCode = result.code;
      metadata.stdoutTail = responsePayload.stdout;
      metadata.stderrTail = responsePayload.stderr;
      
      // Set headers for error responses as well
      res.setHeader('X-Compile-Request-Id', requestId);
      res.setHeader('X-Compile-Duration-Ms', String(metadata.durationMs));
      res.setHeader('X-Compile-Queue-Ms', String(queueMs));
      metadata.logTail = responsePayload.log;
      fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
      persistMetadata(metadata);
      res.status(500).json(responsePayload);
    }
    
  } catch (error) {
    console.error('Compilation error:', error);
    
    // Try to get log content for debugging
    let logContent = '';
    if (fs.existsSync(logPath)) {
      logContent = fs.readFileSync(logPath, 'utf-8');
    }
    
    metadata.status = 'error';
    metadata.errorMessage = error.message;
    metadata.completedAt = metadata.completedAt || Date.now();
    metadata.durationMs = metadata.completedAt - receivedAt;
    metadata.logTail = tailLines(logContent);
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
    persistMetadata(metadata);
    
    // Set headers for catch block errors as well
    res.setHeader('X-Compile-Request-Id', requestId);
    res.setHeader('X-Compile-Duration-Ms', String(metadata.durationMs));
    res.setHeader('X-Compile-Queue-Ms', String(queueMs));
    
    res.status(500).json({
      error: 'LaTeX compilation failed',
      message: error.message,
      requestId,
      queueMs,
      durationMs: metadata.durationMs,
      log: metadata.logTail || 'No log file generated'
    });
    
  } finally {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`[${requestId}] Temporary directory cleaned up`);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(port, () => {
  console.log(`LaTeX compilation server running on port ${port}`);
  console.log(`Max concurrent requests: ${MAX_CONCURRENT_REQUESTS}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 