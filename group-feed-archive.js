if (process.argv.length < 4) {
  console.log('Usage: node group-feed-archive YEAR MONTH');
  process.exit(1);
}

var year = parseInt(process.argv[2], 10);
var month = parseInt(process.argv[3], 10);
var https = require('https');
var url = require('url');
var config = require('./config');
var posts = [];

fetchPosts(config.appId + '|' + config.appSecret, null, function (err) {
  if (err) {
    console.log(err);
    return;
  }
  formatDoc(function (err, doc) {
    if (err) {
      console.log(err);
      return;
    }
    console.log(doc);
  });
});

function fetchPosts(accessToken, nextUrl, cb) {
  var since = Math.floor(new Date(year, month - 1, -1).getTime() / 1000);
  var options = {
    'hostname': 'graph.facebook.com',
    'port': 443,
    'path': '/' + config.groupId + '/feed?access_token=' + accessToken + '&since=' + since,
    'method': 'GET'
  };
  if (typeof nextUrl === 'string') {
    var u = url.parse(nextUrl);
    if (u.hostname && u.path) {
      options.hostname = u.hostname;
      options.path = u.path;
    } else {
      cb('invalid nextUrl: ' + nextUrl);
    }
  }
  var req = https.request(options, function (res) {
    var content = '';
    res.on('data', function (d) {
      content += d;
    });
    res.on('end', function () {
      var obj = JSON.parse(content);
      if (obj.data && obj.data.length > 0) {
          posts = posts.concat(obj.data);
      }
      if (obj.paging && obj.paging.next) {
        fetchPosts(accessToken, obj.paging.next, cb);
      } else {
        cb();
      }
    });
  });
  req.end();
  req.on('error', function (err) {
    cb(err);
  });
}

function formatDoc(cb) {
  var monthlyArchive = [];
  var authorObj = {};
  var doc = ''

  for (var i = 0, len = posts.length; i < len; i++) {
    var p = posts[i];
    var dateObj = new Date(p.created_time);
    var yr = dateObj.getFullYear();
    var mo = dateObj.getMonth() + 1;
    if (yr === year && mo === month) {
      monthlyArchive.push(p);
      if (authorObj[p.from.id]) {
        authorObj[p.from.id]++;
      } else {
        authorObj[p.from.id] = 1;
      }
    }
  }
  monthlyArchive.sort(function (a, b) {
    var aTs = new Date(a.created_time).getTime();
    var bTs = new Date(b.created_time).getTime();
    return bTs - aTs;
  });

  doc += 'In ' + year + '-' + month + ', there are ' + monthlyArchive.length + ' posts by ' + Object.keys(authorObj).length  + ' members.';

  for (var i = 0, len = monthlyArchive.length; i < len; i++) {
    var p = monthlyArchive[i];
    var out = '<br /><br />';
    var quote = '';
    out += formatName(p.from);

    switch (p.type) {
      case 'status':
        if (p.message) {
          out += ' wrote';
          quote = p.message;
        } else if (p.status_type === 'created_note') {
          out += ' created a doc';
        } else {
          out += ' posted something';
        }
        break;
      case 'link':
      case 'photo':
      case 'video':
      default:
        out += ' shared a ' + p.type;
        var temp = [];
        if (p.message) {
          temp.push(p.message);
        }
        if (p.name) {
          temp.push(p.name);
        }
        if (p.description) {
          temp.push(p.description);
        }
        quote += temp.join(' - ');
    }
    var trimmedQuote = trimStr(quote, 200);
    trimmedQuote = trimmedQuote.replace(/\>/g, '&#62;')
                               .replace(/\</g, '&#60;');
    out += '<blockquote>' + trimmedQuote + '</blockquote>';
    var meta = [];
    var dateObj = new Date(p.created_time);
    var date = formatDate(dateObj);
    if (date) {
      meta.push(date);
    }
    var permalink = formatLink(p.id); 
    meta.push(permalink);
    out += '<small>';
    out += meta.join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;');
    out += '</small>';
    doc += out;
  }
  if (doc.length > 65535) {
    cb('Content length > 65535');
  } else {
    cb(null, doc);
  }
}

function formatName(obj) {
  if (obj.name && obj.id) {
    return '<a href="https://www.facebook.com/profile.php?id=' + obj.id + '">' + obj.name + '</a>';
  } else if (obj.name) {
    return obj.name;
  }
  return '';
}

function trimStr(str, len) {
  var trimmed = str.substr(0, len);
  trimmed = trimmed.replace(/\n/g, ' ');
  if (str.length > len) {
    trimmed = trimmed.replace(/\.+$/, '')
    trimmed = trimmed.replace(/\s.{0,10}$/, '')
    trimmed += '...';
  }
  return trimmed;
}

function formatDate(dateObj) {
  if (!dateObj) {
    return '';
  }
  var yr = new String(dateObj.getFullYear());
  var mo = new String(dateObj.getMonth() + 1);
  if (mo.length === 1) {
    mo = '0' + month;
  }
  var date = new String(dateObj.getDate());
  if (date.length === 1) {
    date = '0' + date;
  }
  return yr + '-' + mo + '-' + date;
}

function formatLink(postId) {
  var id = postId.split('_')[1];
  return '<a href="https://www.facebook.com/groups/' + config.groupId + '/permalink/' + id + '">permalink</a>';
}
