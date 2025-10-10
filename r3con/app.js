var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var process = require('process');
var fs = require('fs');
var path = require('path');
var db = require('better-sqlite3')(path.join(__dirname, './app.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS SERVICES (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER,
      name TEXT NOT NULL,
      port INTEGER NOT NULL,
      protocol TEXT CHECK(protocol IN ('tcp', 'udp')) NOT NULL,
      version TEXT,
      FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS HOSTS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      hostname TEXT,
      os TEXT,
      notes TEXT,
      claimer TEXT DEFAULT 'unclaimed'
  )
`);

// Create CREDENTIALS table with migration support
db.exec(`
  CREATE TABLE IF NOT EXISTS CREDENTIALS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER,
      service TEXT,
      username TEXT,
      password TEXT,
      hash TEXT,
      FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  )
`);

// Check if new columns exist and add them if they don't
const credentialsColumns = db.prepare("PRAGMA table_info(CREDENTIALS)").all();
const columnNames = credentialsColumns.map(col => col.name);

if (!columnNames.includes('domain')) {
  db.exec('ALTER TABLE CREDENTIALS ADD COLUMN domain TEXT');
}

if (!columnNames.includes('affected_host')) {
  db.exec('ALTER TABLE CREDENTIALS ADD COLUMN affected_host TEXT');
}

if (!columnNames.includes('os')) {
  db.exec('ALTER TABLE CREDENTIALS ADD COLUMN os TEXT');
}

if (!columnNames.includes('notes')) {
  db.exec('ALTER TABLE CREDENTIALS ADD COLUMN notes TEXT');
}

if (!columnNames.includes('created_at')) {
  db.exec('ALTER TABLE CREDENTIALS ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
}

// Create FILES table
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

db.exec(`
  CREATE TABLE IF NOT EXISTS TAGS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      host_id INTEGER,
      FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS SCRIPTS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER,
      name TEXT NOT NULL,
      output TEXT NOT NULL,
      FOREIGN KEY (host_id) REFERENCES HOSTS(id)
  )
`)

// Create dir public/nmap if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'public/nmap'))) {
  fs.mkdirSync(path.join(__dirname, 'public/nmap'));
}

// Create dir public/files if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'public/files'))) {
  fs.mkdirSync(path.join(__dirname, 'public/files'));
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

var indexRouter = require('./routes/index');
var hostsRouter = require('./routes/hosts');
var credentialsRouter = require('./routes/credentials');
var notesRouter = require('./routes/notes');
var filesRouter = require('./routes/files');

// Set tmp directory
// If Windows, set to C:\Windows\Temp
// If Linux, set to /tmp

if (process.platform === 'win32') {
  process.env.TMPDIR = 'C:\\Windows\\Temp';
} else {
  process.env.TMPDIR = '/tmp';
}

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for locals
app.use((req, res, next) => {
  res.locals.currentPage = req.path.substring(1) || '';
  next();
});

app.use('/', indexRouter);
app.use('/hosts', hostsRouter);
app.use('/credentials', credentialsRouter);
app.use('/notes', notesRouter);
app.use('/files', filesRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



module.exports = app;
