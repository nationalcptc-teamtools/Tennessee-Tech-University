
var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var db = require('better-sqlite3')(path.join(__dirname, '../app.db'));

// PUT route for updating a credential by id
router.put('/:id', function(req, res, next) {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  const {
    credentialType,
    username,
    password,
    hash,
    service,
    domain,
    affected_host,
    os,
    notes
  } = req.body;

  // Validate at least one of username or password
  if (!username && !password) {
    return res.status(400).json({ error: 'At least one of username or password must be provided' });
  }

  // Build update fields
  let updateFields = [];
  let updateValues = [];
  if (username !== undefined) { updateFields.push('username = ?'); updateValues.push(username); }
  if (password !== undefined) { updateFields.push('password = ?'); updateValues.push(password); }
  if (hash !== undefined) { updateFields.push('hash = ?'); updateValues.push(hash); }
  if (service !== undefined) { updateFields.push('service = ?'); updateValues.push(service); }
  if (domain !== undefined) { updateFields.push('domain = ?'); updateValues.push(domain); }
  if (affected_host !== undefined) { updateFields.push('affected_host = ?'); updateValues.push(affected_host); }
  if (os !== undefined) { updateFields.push('os = ?'); updateValues.push(os); }
  if (notes !== undefined) { updateFields.push('notes = ?'); updateValues.push(notes); }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  // Check if credential exists
  const existing = db.prepare('SELECT * FROM CREDENTIALS WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  // Update the credential
  const updateQuery = `UPDATE CREDENTIALS SET ${updateFields.join(', ')} WHERE id = ?`;
  updateValues.push(id);
  try {
    db.prepare(updateQuery).run(...updateValues);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update credential: ' + error.message });
  }
});

// Hash type identification function
function identifyHashType(hash) {
  if (!hash) return 'Unknown';
  
  const hashLength = hash.length;
  const hashLower = hash.toLowerCase();
  
  // Remove common prefixes
  const cleanHash = hash.replace(/^[a-fA-F0-9$]*\$/, '');
  const cleanLength = cleanHash.length;
  
  // NTLM (32 chars, hex)
  if (hashLength === 32 && /^[a-fA-F0-9]+$/.test(hash)) {
    return 'NTLM';
  }
  
  // LM (32 chars, hex)
  if (hashLength === 32 && /^[a-fA-F0-9]+$/.test(hash)) {
    return 'LM';
  }
  
  // MD5 (32 chars, hex)
  if (hashLength === 32 && /^[a-fA-F0-9]+$/.test(hash)) {
    return 'MD5';
  }
  
  // SHA1 (40 chars, hex)
  if (hashLength === 40 && /^[a-fA-F0-9]+$/.test(hash)) {
    return 'SHA1';
  }
  
  // SHA256 (64 chars, hex)
  if (hashLength === 64 && /^[a-fA-F0-9]+$/.test(hash)) {
    return 'SHA256';
  }
  
  // bcrypt ($2a$, $2b$, $2y$)
  if (hashLower.startsWith('$2a$') || hashLower.startsWith('$2b$') || hashLower.startsWith('$2y$')) {
    return 'bcrypt';
  }
  
  // MD5crypt ($1$)
  if (hashLower.startsWith('$1$')) {
    return 'MD5crypt';
  }
  
  // SHA256crypt ($5$)
  if (hashLower.startsWith('$5$')) {
    return 'SHA256crypt';
  }
  
  // SHA512crypt ($6$)
  if (hashLower.startsWith('$6$')) {
    return 'SHA512crypt';
  }
  
  // DES (13 chars, alphanumeric)
  if (hashLength === 13 && /^[a-zA-Z0-9./]+$/.test(hash)) {
    return 'DES';
  }
  
  // LM:NTLM combination
  if (hash.includes(':') && hash.split(':').length === 2) {
    const [lm, ntlm] = hash.split(':');
    if (lm.length === 32 && ntlm.length === 32 && /^[a-fA-F0-9]+$/.test(lm) && /^[a-fA-F0-9]+$/.test(ntlm)) {
      return 'LM:NTLM';
    }
  }
  
  return 'Unknown';
}

  // CREATE TABLE IF NOT EXISTS SERVICES (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     host_id INTEGER,
  //     name TEXT NOT NULL,
  //     port INTEGER NOT NULL,
  //     protocol TEXT CHECK(protocol IN ('tcp', 'udp')) NOT NULL,
  //     version TEXT,
  //     FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  // )

  // CREATE TABLE IF NOT EXISTS HOSTS (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     address TEXT NOT NULL,
  //     hostname TEXT,
  //     os TEXT,
  //     notes TEXT,
  //     claimer TEXT DEFAULT 'unclaimed'
  // )

  // CREATE TABLE IF NOT EXISTS CREDENTIALS (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     host_id INTEGER,
  //     service TEXT,
  //     username TEXT,
  //     password TEXT,
  //     hash TEXT,
  //     FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  // )

  // CREATE TABLE IF NOT EXISTS TAGS (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     tag TEXT NOT NULL,
  //     host_id INTEGER,
  //     FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  // )

  // CREATE TABLE IF NOT EXISTS SCRIPTS (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     host_id INTEGER,
  //     name TEXT NOT NULL,
  //     output TEXT NOT NULL,
  //     FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  // )

router.get('/', function(req, res, next) {
  const { 
    sortBy = 'id', 
    sortOrder = 'DESC',
    search = '',
    filterService = '',
    filterDomain = '',
    filterOS = '',
    filterAffectedHost = ''
  } = req.query;
  
  // Check if created_at column exists
  const credentialsColumns = db.prepare("PRAGMA table_info(CREDENTIALS)").all();
  const columnNames = credentialsColumns.map(col => col.name);
  const hasCreatedAt = columnNames.includes('created_at');
  
  // Validate sort parameters - use 'id' as default if created_at doesn't exist
  const validSortFields = ['id', 'username', 'password', 'hash', 'service', 'domain', 'affected_host', 'os'];
  if (hasCreatedAt) {
    validSortFields.push('created_at');
  }
  const validSortOrders = ['ASC', 'DESC'];
  
  // Use 'id' as default sort if created_at is requested but doesn't exist
  let sortField = validSortFields.includes(sortBy) ? sortBy : 'id';
  if (sortBy === 'created_at' && !hasCreatedAt) {
    sortField = 'id';
  }
  const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
  
  // Build WHERE clause for filtering
  let whereConditions = [];
  let params = [];
  
  // Search functionality
  if (search) {
    whereConditions.push(`(username LIKE ? OR password LIKE ? OR hash LIKE ? OR service LIKE ? OR domain LIKE ? OR affected_host LIKE ? OR os LIKE ? OR notes LIKE ?)`);
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  // Filter by service
  if (filterService) {
    whereConditions.push('service = ?');
    params.push(filterService);
  }
  
  // Filter by domain
  if (filterDomain) {
    whereConditions.push('domain = ?');
    params.push(filterDomain);
  }
  
  // Filter by OS
  if (filterOS) {
    whereConditions.push('os = ?');
    params.push(filterOS);
  }
  
  // Filter by affected host
  if (filterAffectedHost) {
    whereConditions.push('affected_host = ?');
    params.push(filterAffectedHost);
  }
  
  // Build the query
  let query = 'SELECT * FROM CREDENTIALS';
  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }
  query += ` ORDER BY ${sortField} ${sortDirection}`;
  
  const credentials = db.prepare(query).all(...params);
  
  // Get unique values for filter dropdowns
  const allCredentials = db.prepare('SELECT DISTINCT service, domain, os, affected_host FROM CREDENTIALS WHERE service IS NOT NULL OR domain IS NOT NULL OR os IS NOT NULL OR affected_host IS NOT NULL').all();
  const uniqueServices = [...new Set(allCredentials.map(c => c.service).filter(Boolean))].sort();
  const uniqueDomains = [...new Set(allCredentials.map(c => c.domain).filter(Boolean))].sort();
  const uniqueOS = [...new Set(allCredentials.map(c => c.os).filter(Boolean))].sort();
  const uniqueHosts = [...new Set(allCredentials.map(c => c.affected_host).filter(Boolean))].sort();
  
  // Add hash type information to each credential
  const credentialsWithTypes = credentials.map(cred => ({
    ...cred,
    hashType: cred.hash ? identifyHashType(cred.hash) : null,
    created_at: cred.created_at || null // Handle missing created_at gracefully
  }));
  
  return res.render('credentials', { 
    credentials: credentialsWithTypes,
    currentSort: { field: sortField, order: sortDirection },
    hasCreatedAt: hasCreatedAt,
    search: search,
    filters: {
      service: filterService,
      domain: filterDomain,
      os: filterOS,
      affectedHost: filterAffectedHost
    },
    filterOptions: {
      services: uniqueServices,
      domains: uniqueDomains,
      os: uniqueOS,
      hosts: uniqueHosts
    }
  });
});

router.post('/', function(req, res, next) {
  const { 
    credentialType, 
    username, 
    password, 
    hash, 
    service, 
    domain, 
    affected_host, 
    os, 
    notes,
    bulkCredentials 
  } = req.body;

  if (!credentialType) {
    return res.status(400).json({ error: 'Missing credential type' });
  }

  // Handle bulk credentials (legacy support)
  if (bulkCredentials) {
    return handleBulkCredentials(bulkCredentials, credentialType, res);
  }

  // Handle single credential with new structure
  if (!['username', 'password', 'combo', 'hash', 'samdump'].includes(credentialType)) {
    return res.status(400).json({ error: 'Invalid credential type' });
  }

  try {
    let insertData = {};
    
    switch (credentialType) {
      case 'username':
        if (!username) return res.status(400).json({ error: 'Username is required' });
        insertData = { username, service, domain, affected_host, os, notes };
        if (hash) insertData.hash = hash; // Include hash if provided
        break;
      case 'password':
        if (!password) return res.status(400).json({ error: 'Password is required' });
        insertData = { password, service, domain, affected_host, os, notes };
        if (hash) insertData.hash = hash; // Include hash if provided
        break;
      case 'combo':
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
        insertData = { username, password, service, domain, affected_host, os, notes };
        if (hash) insertData.hash = hash; // Include hash if provided
        break;
      case 'hash':
        if (!hash) return res.status(400).json({ error: 'Hash is required' });
        insertData = { hash, service, domain, affected_host, os, notes };
        if (username) insertData.username = username; // Include username if provided
        if (password) insertData.password = password; // Include password if provided
        break;
      case 'samdump':
        return handleSamdumpCredentials(req.body, res);
    }

    // Check for duplicates based on the credential type
    let existingCredential = null;
    if (credentialType === 'combo') {
      existingCredential = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ? AND password = ?').get(username, password);
    } else if (credentialType === 'username') {
      existingCredential = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ?').get(username);
    } else if (credentialType === 'password') {
      existingCredential = db.prepare('SELECT * FROM CREDENTIALS WHERE password = ?').get(password);
    } else if (credentialType === 'hash') {
      existingCredential = db.prepare('SELECT * FROM CREDENTIALS WHERE hash = ?').get(hash);
    }

    if (existingCredential) {
      return res.status(400).json({ error: 'Credential already exists' });
    }

    // Insert the credential
    const fields = Object.keys(insertData).filter(key => insertData[key] !== undefined && insertData[key] !== '');
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(field => insertData[field]);
    
    const insertQuery = `INSERT INTO CREDENTIALS (${fields.join(', ')}) VALUES (${placeholders})`;
    db.prepare(insertQuery).run(...values);

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to insert credential: ' + error.message });
  }
});

// Helper function for bulk credentials (legacy support)
function handleBulkCredentials(credential, credentialType, res) {
  if (!credential) {
    return res.status(400).json({ error: 'Missing credential data' });
  }

  switch (credentialType) {
    case 'username':
      const existingUsername = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ?').get(credential);
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (username) VALUES (?)').run(credential);
      break;
    case 'password':
      const existingPassword = db.prepare('SELECT * FROM CREDENTIALS WHERE password = ?').get(credential);
      if (existingPassword) {
        return res.status(400).json({ error: 'Password already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (password) VALUES (?)').run(credential);
      break;
    case 'combo':
      const [username, password] = credential.split(':');
      const existingCombo = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ? AND password = ?').get(username, password);
      if (existingCombo) {
        return res.status(400).json({ error: 'Combo already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (username, password) VALUES (?, ?)').run(username, password);
      break;
    case 'hash':
      const existingHash = db.prepare('SELECT * FROM CREDENTIALS WHERE hash = ?').get(credential);
      if (existingHash) {
        return res.status(400).json({ error: 'Hash already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (hash) VALUES (?)').run(credential);
      break;
    case 'samdump':
      return handleSamdumpCredentials({ credential }, res);
  }
  return res.json({ success: true });
}

// Helper function for SAM dump processing
function handleSamdumpCredentials(body, res) {
  const { credential } = body;
  const samdump = credential.split('\n');
  
  for (const line of samdump) {
    try {
      const [username, rid, lm, ntlm] = line.split(':');
      const existingSamdump = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ? AND hash = ?').get(username, `${lm}:${ntlm}`);
      if (existingSamdump) {
        continue;
      }
      db.prepare('INSERT INTO CREDENTIALS (username, hash) VALUES (?, ?)').run(username, `${lm}:${ntlm}`);
    } catch (e) {
      continue;
    }
  }
  return res.json({ success: true });
}

router.get('/:id', function(req, res, next) {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  const credentials = db.prepare('SELECT * FROM CREDENTIALS WHERE host_id = ?').all(id);
  return res.json(credentials);
});

router.post('/:id', function(req, res, next) {
    const id = req.params.id;

    const { service, username, password } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'No id provided' });
    }

    if (!service || !username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);

    if (!host) {
        return res.status(404).json({ error: 'Host not found' });
    }

    db.prepare('INSERT INTO CREDENTIALS (host_id, service, username, password) VALUES (?, ?, ?, ?)').run(id, service, username, password);
    return res.json({ success: true });
});

// DELETE route for individual credentials
router.delete('/:id', function(req, res, next) {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: 'No id provided' });
    }

    const credential = db.prepare('SELECT * FROM CREDENTIALS WHERE id = ?').get(id);

    if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
    }

    db.prepare('DELETE FROM CREDENTIALS WHERE id = ?').run(id);
    return res.json({ success: true });
});

module.exports = router;
