var express = require('express');
var fs = require('fs');
var path = require('path');
var process = require('process');
var db = require('better-sqlite3')(path.join(__dirname, '../app.db'));
var router = express.Router();
var xml2js = require('xml2js');
var archiver = require('archiver');
var detect = require('detect-file-type');
var yauzl = require("yauzl");
var fsextra = require('fs-extra');

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

function findXMLFiles(folderPath) {
  const files = fs.readdirSync(folderPath);
  const xmlFiles = [];

  files.forEach(file => {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      xmlFiles.push(...findXMLFiles(filePath));
    } else if (file.endsWith('.xml')) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (fileContent.includes('<nmaprun')) {
        xmlFiles.push(filePath);
      }
    }
  });

  return xmlFiles;
}

function importXMLToDatabase(xmlString) {
  const parser = new xml2js.Parser();
  parser.parseString(xmlString, function (err, result) {
    if (err) {
      throw err;
    }

    const hosts = result.nmaprun.host;
    for (const host of hosts) {
      const address = host.address[0].$.addr;
      const existingHost = db.prepare('SELECT * FROM HOSTS WHERE address = ?').get(address);
      if (!existingHost) {
        db.prepare('INSERT INTO HOSTS (address) VALUES (?)').run(address);
        console.log(`Inserted host ${address}`);
      }

      // Get services for the host
      const services = host.ports[0].port;
      console.log(services);
      for (const service of services) {
        const port = service.$.portid;
        const protocol = service.$.protocol;

        // Get service name if it exists
        let name = 'unknown';
        if (service.service && service.service[0].$ && service.service[0].$.name) {
          name = service.service[0].$.name;
        }
        
        // Get service version if it exists
        let version = '';
        if (service.service && service.service[0].$ && service.service[0].$.product) {
          version = `${service.service[0].$.product}`;
        }
        if (service.service && service.service[0].$ && service.service[0].$.version) {
          version += ` (${service.service[0].$.version})`;
        }

        // Get script results if they exist
        let scripts = [];
        if (service.script) {
          for (const script of service.script) {
            scripts.push({ id: script.$.id, output: script.$.output });
          }
        }
        if (scripts.length > 0) {
          for (const script of scripts) {
            const existingScript = db.prepare('SELECT * FROM SCRIPTS WHERE host_id = (SELECT id FROM HOSTS WHERE address = ?) AND name = ?').get(address, script.id);
            if (!existingScript) {
              db.prepare('INSERT INTO SCRIPTS (host_id, name, output) VALUES ((SELECT id FROM HOSTS WHERE address = ?), ?, ?)').run(address, script.id, script.output);
              console.log(`Inserted script ${script.id}`);
            } else {
              db.prepare('UPDATE SCRIPTS SET output = ? WHERE host_id = (SELECT id FROM HOSTS WHERE address = ?) AND name = ?').run(script.output, address, script.id);
              console.log(`Updated script ${script.id}`);
            }
          }
        }

        // If service doesn't exist, insert it
        // If service exists, update it only if version is not empty
        const existingService = db.prepare('SELECT * FROM SERVICES WHERE host_id = (SELECT id FROM HOSTS WHERE address = ?) AND port = ? AND protocol = ?').get(address, port, protocol);
        if (!existingService) {
          db.prepare('INSERT INTO SERVICES (host_id, name, port, protocol, version) VALUES ((SELECT id FROM HOSTS WHERE address = ?), ?, ?, ?, ?)').run(address, name, port, protocol, version);
          console.log(`Inserted service ${name}:${port}/${protocol}`);
        } else if (version != '') {
          db.prepare('UPDATE SERVICES SET name = ?, version = ? WHERE host_id = (SELECT id FROM HOSTS WHERE address = ?) AND port = ? AND protocol = ?').run(name, version, address, port, protocol);
          console.log(`Updated service ${name}:${port}/${protocol}`);
        }
      }
    }
  });
}

router.get('/', function(req, res, next) {
  return res.render('index');
});

router.post('/nmap_upload', function(req, res, next) {
  if (!req.body.nmap_scan) {
    return res.status(400).json({ error: 'No nmap file uploaded' });
  }

  const nmapScan = req.body.nmap_scan;
  const nmapScanContent = Buffer.from(nmapScan, 'base64').toString('ascii').trim();
  const currCount = fs.readdirSync(path.join(__dirname, '../public/nmap')).length;

  detect.fromBuffer(Buffer.from(nmapScan, 'base64'), function(err, result) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err });
    }

    switch (result.mime) {
      case 'application/xml':
        // Handling XML files
        const nmapScans = nmapScanContent.split('</nmaprun>');
        nmapScans.pop();
        console.log(`Found ${nmapScans.length} nmap scans`);

        for (let i = 0; i < nmapScans.length; i++) {
          nmapScans[i] = nmapScans[i].trim();
          nmapScans[i] += '</nmaprun>';
          try {
            importXMLToDatabase(nmapScans[i]);
          } catch (error) {
            console.error('Error importing XML to database:', error);
            return res.status(500).json({ error: error });
          }
          console.log(`Writing nmap scan to public/nmap/nmap_${currCount + i}.xml`);
          const filename = path.join(__dirname, `../public/nmap/nmap_${currCount + i}.xml`);
          fs.writeFileSync(filename, nmapScans[i]);
        }
        res.json({ success: true, message: `Imported ${nmapScans.length} nmap scans` });
        break;

      case 'application/zip':
        console.log('Extracting zip file');
        fsextra.emptyDirSync(process.env.TMPDIR);

        const zipBuffer = Buffer.from(nmapScan, 'base64');
        const zipPath = path.join(process.env.TMPDIR, 'nmap_scan.zip');
        fs.writeFileSync(zipPath, zipBuffer);

        // Start the extraction process
        yauzl.open(zipPath, { lazyEntries: true }, function(err, zipfile) {
          if (err) {
            return res.status(500).json({ error: err });
          }

          const extractedFiles = [];

          // Read each entry in the zip file
          zipfile.readEntry();
          zipfile.on('entry', function(entry) {
            if (/\/$/.test(entry.fileName)) {
              // If it's a directory, skip it
              fs.mkdirSync(path.join(process.env.TMPDIR, entry.fileName), { recursive: true });
              zipfile.readEntry();
            } else {
              // It's a file, extract it
              zipfile.openReadStream(entry, function(err, readStream) {
                if (err) {
                  return res.status(500).json({ error: err });
                }

                const outputFile = path.join(process.env.TMPDIR, entry.fileName);
                const writeStream = fs.createWriteStream(outputFile);

                readStream.pipe(writeStream);
                readStream.on('end', function() {
                  extractedFiles.push(outputFile);  // Track the extracted file
                  zipfile.readEntry();  // Continue reading the next entry
                });
              });
            }
          });

          // When all entries have been processed
          zipfile.on('end', function() {
            console.log(`Extracted ${extractedFiles.length} files`);

            // Find all XML files in the extracted files
            const xmlFiles = extractedFiles.filter(file => file.endsWith('.xml'));
            console.log(`Found ${xmlFiles.length} XML files`);

            for (let i = 0; i < xmlFiles.length; i++) {
              try {
                const xmlContent = fs.readFileSync(xmlFiles[i], 'utf8');
                importXMLToDatabase(xmlContent);
              } catch (error) {
                console.error('Error importing XML to database:', error);
                return res.status(500).json({ error: error });
              }
              console.log(`Writing nmap scan to public/nmap/nmap_${currCount + i}.xml`);
              const filename = path.join(__dirname, `../public/nmap/nmap_${currCount + i}.xml`);
              fs.copyFileSync(xmlFiles[i], filename);
            }

            // Return a success response when done
            res.json({ success: true, message: `Extracted ${xmlFiles.length} nmap scans` });
          });
        });
        break;
    }
  });
});

router.get('/nmap_count', function(req, res, next) {
  const currCount = fs.readdirSync(path.join(__dirname, '../public/nmap')).length;
  return res.json({ count: currCount });
});

router.get('/nmap_scan/:id', function(req, res, next) {
  const id = req.params.id;
  const filename = path.join(__dirname, `../public/nmap/nmap_${id}.xml`);
  if (!fs.existsSync(filename)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const nmapScanXml = fs.readFileSync(filename, 'utf8');
  return res.json({ nmap_scan: Buffer.from(nmapScanXml).toString('base64') });
});

router.get('/export_db', function(req, res, next) {
  const appFolder = path.join(__dirname, '..');
  const exportFolder = path.join(process.env.TMPDIR, 'r3con_export');

  try {
    if (fs.existsSync(exportFolder)) {
      fs.rmSync(exportFolder, { recursive: true, force: true });
    }

    fs.mkdirSync(exportFolder);
    fs.cpSync(appFolder, exportFolder, { recursive: true });
    fs.rmSync(path.join(exportFolder, 'export'), { recursive: true, force: true });

    res.attachment('r3con_export.zip');
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.pipe(res);
    archive.directory(exportFolder, false);
    archive.finalize();

    // Clean up the export folder after the response has been sent
    res.on('finish', () => {
      fs.rmSync(exportFolder, { recursive: true, force: true });
    });

  } catch (error) {
    console.error('Error during export:', error);
    return res.status(500).json({ error: error });
  }

});

module.exports = router;
