var express = require('express');
var fs = require('fs');
var path = require('path');
var db = require('better-sqlite3')(path.join(__dirname, '../app.db'));
const ipaddr = require('ipaddr.js');
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

  const os = req.query.os;
  const port = req.query.port;
  const tags = req.query.tags;
  const claimer = req.query.claimer;
  const subnet = req.query.subnet;

  // If no filters, return all hosts
  if (!os && !port && !tags && !claimer && !subnet) {

    const hosts = db.prepare('SELECT * FROM HOSTS').all();

    for (const host of hosts) {

      // Get services for host
      host.services = db.prepare('SELECT * FROM SERVICES WHERE host_id = ?').all(host.id);
      if (host.services === null) {
        host.services = [];
        continue;
      }
      host.services = host.services.map(service => { return { name: service.name, port: service.port, protocol: service.protocol, version: service.version } });

      // Get tags for host
      host.tags = db.prepare('SELECT * FROM TAGS WHERE host_id = ?').all(host.id);
      if (host.tags === null) {
        host.tags = [];
        continue;
      }
      host.tags = host.tags.map(tag => tag.tag);
    }

    console.log(hosts);

    const totalHostCount = hosts.length;
    const compromisedHostCount = hosts.filter(host => host.tags.includes('compromised') && !host.tags.includes('pwned')).length;
    const pwnedHostCount = hosts.filter(host => host.tags.includes('pwned')).length;

    return res.render('hosts', { hosts: hosts, totalHostCount: totalHostCount, compromisedHostCount: compromisedHostCount, pwnedHostCount: pwnedHostCount });
  }

  // If filters, return filtered hosts
  const filteredHosts = [];
  if (os) {
    const osArray = os.split(',');
    const query = osArray.map(o => `os LIKE '%${o}%'`).join(' AND ');
    const hosts = db.prepare(`SELECT * FROM HOSTS WHERE ${query}`).all();
    filteredHosts.push(...hosts);
  }

  if (port) {
    const portArray = port.split(',');
    const query = portArray.map(p => `services LIKE '%:${p}/%'`).join(' AND ');
    const hosts = db.prepare(`SELECT * FROM HOSTS WHERE ${query}`).all();
    filteredHosts.push(...hosts);
  }

  if (tags) {
    const tagsArray = tags.split(',');
    const query = tagsArray.map(s => `tag LIKE '%${s}%'`).join(' AND ');
    const hosts = db.prepare(`SELECT * FROM HOSTS WHERE id IN (SELECT host_id FROM TAGS WHERE ${query})`).all();
    filteredHosts.push(...hosts);
  }

  if (claimer) {
    const claimerArray = claimer.split(',');
    const query = claimerArray.map(c => `claimer = '${c}'`).join(' OR ');
    const hosts = db.prepare(`SELECT * FROM HOSTS WHERE ${query}`).all();
    filteredHosts.push(...hosts);
  }

  if (subnet) {
    const subnetArray = subnet.split(',');
    const hosts = db.prepare(`SELECT * FROM HOSTS`).all();

    for (const subnet of subnetArray) {
      const [networkAddress, prefixLength] = subnet.split('/');
      const networkRange = ipaddr.parseCIDR(subnet);
      const filteredSubnetHosts = hosts.filter(host => {
        const hostIP = ipaddr.parse(host.address);
        return hostIP.match(networkRange);
      });
      filteredHosts.push(...filteredSubnetHosts);
    }
  }

  for (const host of filteredHosts) {
    // Get services for host
    host.services = db.prepare('SELECT * FROM SERVICES WHERE host_id = ?').all(host.id);
    if (host.services === null) {
      host.services = [];
      continue;
    }
    host.services = host.services.map(service => { return { name: service.name, port: service.port, protocol: service.protocol, version: service.version } });

    // Get tags for host
    host.tags = db.prepare('SELECT * FROM TAGS WHERE host_id = ?').all(host.id);
    if (host.tags === null) {
      host.tags = [];
      continue;
    }
    host.tags = host.tags.map(tag => tag.tag);
  }

  console.log(filteredHosts);

  const totalHostCount = filteredHosts.length;
  const compromisedHostCount = filteredHosts.filter(host => host.tags.includes('compromised') && !host.tags.includes('pwned')).length;
  const pwnedHostCount = filteredHosts.filter(host => host.tags.includes('pwned')).length;

  return res.render('hosts', { hosts: filteredHosts, totalHostCount: totalHostCount, compromisedHostCount: compromisedHostCount, pwnedHostCount: pwnedHostCount });

});

router.get('/:id', function(req, res, next) {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);

  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  // Get services for host
  host.services = db.prepare('SELECT * FROM SERVICES WHERE host_id = ?').all(id);
  if (host.services === null) {
    host.services = [];
  } else {
    host.services = host.services.map(service => { return { name: service.name, port: service.port, protocol: service.protocol, version: service.version } });
  }

  // Get tags for host
  host.tags = db.prepare('SELECT * FROM TAGS WHERE host_id = ?').all(id);
  if (host.tags === null) {
    host.tags = [];
  } else {
    host.tags = host.tags.map(tag => tag.tag);
  }

  // Get scripts for host
  host.scripts = db.prepare('SELECT * FROM SCRIPTS WHERE host_id = ?').all(id); 
  if (host.scripts === null) {
    host.scripts = [];
  } else {
    host.scripts = host.scripts.map(script => { return { name: script.name, output: script.output } });
  }

  return res.json({ host });
});

router.post('/:id/hostname', function(req, res, next) {
  const id = req.params.id;
  const hostname = req.body.hostname;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  if (!hostname) {
    return res.status(400).json({ error: 'No hostname provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  db.prepare('UPDATE HOSTS SET hostname = ? WHERE id = ?').run(hostname, id);
  return res.json({ success: true });
});

router.post('/:id/os', function(req, res, next) {
  const id = req.params.id;
  const os = req.body.os;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  if (!os) {
    return res.status(400).json({ error: 'No os provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  db.prepare('UPDATE HOSTS SET os = ? WHERE id = ?').run(os, id);
  return res.json({ success: true });
});

router.post('/:id/claim', function(req, res, next) {
  const id = req.params.id;
  const claimer = req.body.claimer;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  if (!claimer) {
    return res.status(400).json({ error: 'No claimer provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  db.prepare('UPDATE HOSTS SET claimer = ? WHERE id = ?').run(claimer, id);
  return res.json({ success: true });
});

router.post('/:id/tag', function(req, res, next) {
  const id = req.params.id;
  const tag = req.body.tag;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  if (!tag) {
    return res.status(400).json({ error: 'No tag provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  db.prepare('INSERT INTO TAGS (tag, host_id) VALUES (?, ?)').run(tag, id);
  return res.json({ success: true });
});

router.delete('/:id/tag', function(req, res, next) {
  const id = req.params.id;
  const tag = req.body.tag;

  if (!id) {
    return res.status(400).json({ error: 'No id provided' });
  }

  if (!tag) {
    return res.status(400).json({ error: 'No tag provided' });
  }

  const host = db.prepare('SELECT * FROM HOSTS WHERE id = ?').get(id);
  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  db.prepare('DELETE FROM TAGS WHERE tag = ? AND host_id = ?').run(tag, id);
  return res.json({ success: true });
});

module.exports = router;
