const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

// Request queue to prevent overload
let requestQueue = [];
let isProcessing = false;
const MAX_CONCURRENT_REQUESTS = 2;

app.use(cors());
app.use(bodyParser.text({ type: 'text/plain', limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', queueLength: requestQueue.length, isProcessing });
});

// Process queue
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  
  while (requestQueue.length > 0) {
    const { req, res, next } = requestQueue.shift();
    await handleCompilation(req, res, next);
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
  
  requestQueue.push({ req, res, next });
  processQueue();
});

async function handleCompilation(req, res, next) {
  console.log('==== COMPILE REQUEST RECEIVED ====');
  const texContent = req.body;
  
  // Log the first 100 chars of the content
  console.log(`TeX content received (first 100 chars): ${texContent.substring(0, 100)}...`);
  console.log(`Content length: ${texContent.length} bytes`);
  
  // Create temporary directory
  const tempDir = fs.mkdtempSync('/tmp/latex-');
  const texFilePath = path.join(tempDir, 'main.tex');
  const pdfPath = path.join(tempDir, 'main.pdf');
  const logPath = path.join(tempDir, 'main.log');
  
  try {
    // Write TeX content to file
    fs.writeFileSync(texFilePath, texContent);
    console.log('TeX content written to:', texFilePath);
    
    // Run LaTeX compilation
    console.log('Spawning LaTeX compilation process...');
    
    const result = await new Promise((resolve, reject) => {
      // Use pdflatex directly instead of the run-latex.sh script
      const child = exec(`pdflatex -interaction=nonstopmode -output-directory=${tempDir} ${texFilePath}`, {
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
        console.log(`LaTeX process exited with code: ${code}`);
        console.log(`stdout length: ${stdout.length}`);
        console.log(`stderr length: ${stderr.length}`);
        
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
        console.log('LaTeX log content:', logContent.substring(0, 500));
      }
      
      // Return error with log details
      res.status(500).json({
        error: 'LaTeX compilation failed',
        code: result.code,
        log: logContent || 'No log file generated',
        stdout: result.stdout.substring(0, 1000),
        stderr: result.stderr.substring(0, 1000)
      });
    }
    
  } catch (error) {
    console.error('Compilation error:', error);
    
    // Try to get log content for debugging
    let logContent = '';
    if (fs.existsSync(logPath)) {
      logContent = fs.readFileSync(logPath, 'utf-8');
    }
    
    res.status(500).json({
      error: 'LaTeX compilation failed',
      message: error.message,
      log: logContent || 'No log file generated'
    });
    
  } finally {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Temporary directory cleaned up');
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