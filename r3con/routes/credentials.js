var express = require('express');
var fs = require('fs');
var path = require('path');
var db = require('better-sqlite3')(path.join(__dirname, '../app.db'));
var router = express.Router();

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
  const credentials = db.prepare('SELECT * FROM CREDENTIALS').all();
  return res.render('credentials', { credentials });
});

router.post('/', function(req, res, next) {

  const { credential, credentialType } = req.body;

  if (!credential || !credentialType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Valid credential types = username, password, combo, ntlm, samdump
  if (!['username', 'password', 'combo', 'hash', 'samdump'].includes(credentialType)) {
    return res.status(400).json({ error: 'Invalid credential type' });
  }

  switch (credentialType) {
    case 'username':
      // Check if username already exists
      var existingUsername = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ?').get(credential);
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (username) VALUES (?)').run(credential);
      break;
    case 'password':
      var existingPassword = db.prepare('SELECT * FROM CREDENTIALS WHERE password = ?').get(credential);
      if (existingPassword) {
        return res.status(400).json({ error: 'Password already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (password) VALUES (?)').run(credential);
      break;
    case 'combo':
      var [username, password] = credential.split(':');
      var existingUsername = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ?').get(username);
      var existingPassword = db.prepare('SELECT * FROM CREDENTIALS WHERE password = ?').get(password);
      if (!existingUsername) {
        db.prepare('INSERT INTO CREDENTIALS (username) VALUES (?)').run(username);
      }
      if (!existingPassword) {
        db.prepare('INSERT INTO CREDENTIALS (password) VALUES (?)').run(password);
      }
      var existingCombo = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ? AND password = ?').get(username, password);
      if (existingCombo) {
        return res.status(400).json({ error: 'Combo already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (username, password) VALUES (?, ?)').run(username, password);
      break;
    case 'hash':
      var existingHash = db.prepare('SELECT * FROM CREDENTIALS WHERE hash = ?').get(credential);
      if (existingHash) {
        return res.status(400).json({ error: 'Hash already exists' });
      }
      db.prepare('INSERT INTO CREDENTIALS (hash) VALUES (?)').run(credential);
      break;
    case 'samdump':
      var samdump = credential.split('\n');
      for (const line of samdump) {
        // Username:RID:LM:NTLM:::
        try {
          var [username, rid, lm, ntlm] = line.split(':');
          var existingUsername = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ?').get(username);
          var existingHash = db.prepare('SELECT * FROM CREDENTIALS WHERE hash = ?').get(`${lm}:${ntlm}`);
          if (!existingUsername) {
            db.prepare('INSERT INTO CREDENTIALS (username) VALUES (?)').run(username);
          }
          if (!existingHash) {
            db.prepare('INSERT INTO CREDENTIALS (hash) VALUES (?)').run(`${lm}:${ntlm}`);
          }
          var existingSamdump = db.prepare('SELECT * FROM CREDENTIALS WHERE username = ? AND hash = ?').get(username, `${lm}:${ntlm}`);
          if (existingSamdump) {
            continue;
          }
          db.prepare('INSERT INTO CREDENTIALS (username, hash) VALUES (?, ?)').run(username, `${lm}:${ntlm}`);
        } catch (e) {
          continue;
        }
      }
      break;
  }
  return res.json({ success: true });
});

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


module.exports = router;
