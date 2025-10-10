var express = require('express');
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var db = require('better-sqlite3')(path.join(__dirname, '../app.db'));
var router = express.Router();

// Configure multer for file uploads
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/files'))
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

var upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// GET /files - Display files with search and filtering
router.get('/', function(req, res, next) {
  const { 
    search = '',
    filterTag = '',
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = req.query;
  
  // Ensure FILES table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS FILES (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type TEXT,
          tags TEXT,
          description TEXT,
          uploaded_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Error creating FILES table:', error);
    return res.status(500).json({ error: 'Database error' });
  }
  
  // Validate sort parameters
  const validSortFields = ['id', 'filename', 'original_name', 'file_size', 'mime_type', 'tags', 'created_at'];
  const validSortOrders = ['ASC', 'DESC'];
  
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
  
  // Build WHERE clause for filtering
  let whereConditions = [];
  let params = [];
  
  // Search functionality
  if (search && search.trim() !== '') {
    whereConditions.push(`(filename LIKE ? OR original_name LIKE ? OR tags LIKE ? OR description LIKE ?)`);
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  // Filter by tag
  if (filterTag && filterTag.trim() !== '') {
    whereConditions.push('tags LIKE ?');
    params.push(`%${filterTag.trim()}%`);
  }
  
  // Build the query
  let query = 'SELECT * FROM FILES';
  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }
  query += ` ORDER BY ${sortField} ${sortDirection}`;
  
  let files;
  try {
    if (params.length > 0) {
      files = db.prepare(query).all(...params);
    } else {
      files = db.prepare(query).all();
    }
  } catch (error) {
    console.error('Error executing files query:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    return res.status(500).json({ error: 'Database query error' });
  }
  
  // Get unique tags for filter dropdown
  let uniqueTags = [];
  try {
    const allFiles = db.prepare('SELECT DISTINCT tags FROM FILES WHERE tags IS NOT NULL AND tags != ""').all();
    uniqueTags = [...new Set(allFiles.flatMap(f => f.tags ? f.tags.split(',').map(tag => tag.trim()) : []).filter(Boolean))].sort();
  } catch (error) {
    console.error('Error getting unique tags:', error);
    // Continue with empty tags array
  }
  
  // Add file URLs and formatted size
  const filesWithUrls = (files || []).map(file => ({
    ...file,
    downloadUrl: `/files/download/${file.id}`,
    curlUrl: `${req.protocol}://${req.get('host')}/files/download/${file.id}`,
    formattedSize: formatFileSize(file.file_size),
    tagList: file.tags ? file.tags.split(',').map(tag => tag.trim()) : []
  }));
  
  return res.render('files', { 
    files: filesWithUrls,
    currentSort: { field: sortField, order: sortDirection },
    search: search,
    filters: { tag: filterTag },
    filterOptions: { tags: uniqueTags },
    currentPage: 'files'
  });
});

// POST /files - Upload new file
router.post('/', upload.single('file'), function(req, res, next) {
  const { tags, description, uploadedBy } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const fileData = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      tags: tags || '',
      description: description || '',
      uploaded_by: uploadedBy || 'Unknown'
    };
    
    const insertQuery = `INSERT INTO FILES (filename, original_name, file_path, file_size, mime_type, tags, description, uploaded_by) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const result = db.prepare(insertQuery).run(
      fileData.filename,
      fileData.original_name,
      fileData.file_path,
      fileData.file_size,
      fileData.mime_type,
      fileData.tags,
      fileData.description,
      fileData.uploaded_by
    );
    
    return res.json({ 
      success: true, 
      fileId: result.lastInsertRowid,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    // Clean up uploaded file if database insert fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Failed to save file: ' + error.message });
  }
});

// GET /files/download/:id - Download file
router.get('/download/:id', function(req, res, next) {
  const fileId = req.params.id;
  
  if (!fileId) {
    return res.status(400).json({ error: 'No file ID provided' });
  }
  
  const file = db.prepare('SELECT * FROM FILES WHERE id = ?').get(fileId);
  
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  if (!fs.existsSync(file.file_path)) {
    return res.status(404).json({ error: 'File no longer exists on disk' });
  }
  
  res.download(file.file_path, file.original_name);
});

// DELETE /files/:id - Delete file
router.delete('/:id', function(req, res, next) {
  const fileId = req.params.id;
  
  if (!fileId) {
    return res.status(400).json({ error: 'No file ID provided' });
  }
  
  const file = db.prepare('SELECT * FROM FILES WHERE id = ?').get(fileId);
  
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  try {
    // Delete file from disk
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }
    
    // Delete record from database
    db.prepare('DELETE FROM FILES WHERE id = ?').run(fileId);
    
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete file: ' + error.message });
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
