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

router.get('/:id', function(req, res, next) {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);

  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  return res.json({ notes: host.notes });

});

router.post('/:id', function(req, res, next) {
  const id = req.params.id;
  const notes = req.body.notes;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  if (!notes) {
    return res.status(400).json({ error: 'No note provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);

  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  db.prepare('UPDATE HOSTS SET notes = ? WHERE id = ?').run(notes, id);
  return res.json({ success: true });

});


module.exports = router;
