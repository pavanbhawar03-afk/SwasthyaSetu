const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  patient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Patient', 
    required: true 
  },
  
  // File Info
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String },
  size: { type: Number },
  path: { type: String },
  
  // Document Classification
  documentType: { 
    type: String, 
    enum: ['Lab Report', 'Prescription', 'Imaging', 'Discharge Summary', 'Insurance', 'Other'],
    default: 'Other'
  },
  
  // OCR & AI Extraction Results
  ocrText: { type: String },
  extractedData: {
    // Lab Reports
    hemoglobin: String,
    wbc: String,
    rbc: String,
    platelets: String,
    glucose: String,
    creatinine: String,
    
    // Prescriptions
    medicines: [String],
    dosage: String,
    duration: String,
    
    // Imaging
    imagingType: String,
    findings: String,
    impression: String,
    
    // General
    dateOfReport: Date,
    referredBy: String,
    hospital: String,
    notes: String
  },
  
  // Processing Status
  processingStatus: {
    type: String,
    enum: ['uploaded', 'processing', 'completed', 'failed'],
    default: 'uploaded'
  },
  
  // Auto-fill mapping
  autoFilledFields: [{ type: String }],
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', documentSchema);