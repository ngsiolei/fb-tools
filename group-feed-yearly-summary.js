if (process.argv.length < 3) {
  console.log('Usage: node group-feed-yearly-summary YEAR');
  process.exit(1);
}

var year = parseInt(process.argv[2], 10);
var https = require('https');
var url = require('url');
var config = require('./config');
var posts = [];
var now = new Date();

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
  var since = Math.floor(new Date(year, 0, -1).getTime() / 1000);
  var options = {
    'hostname': 'graph.facebook.com',
    'port': 443,
    'path': '/' + config.groupId + '/feed?access_token=' + accessToken + '&since=' + since + '&fields=message,created_time,shares,comments.limit(1).summary(true),likes.limit(1).summary(true)',
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
  var mostCommented = [];
  var mostLiked = [];
  var doc = '';

  var nowYr = '' + now.getFullYear(); 
  var nowMo = '' + (now.getMonth() + 1); 
  if (nowMo.length === 1) {
    nowMo = '0' + nowMo;
  }
  var nowDate = '' + now.getDate(); 
  if (nowDate.length === 1) {
    nowDate = '0' + nowDate;
  }
  var nowHr = '' + now.getHours(); 
  if (nowHr.length === 1) {
    nowHr = '0' + nowHr;
  }
  var nowMin = '' + now.getMinutes(); 
  if (nowMin.length === 1) {
    nowMin = '0' + nowMin;
  }
  var nowStr = nowYr + '-' + nowMo + '-' + nowDate + ' ' +
               nowHr + ':' + nowMin;

  for (var i = 0, len = posts.length; i < len; i++) {
    var p = posts[i];
    var dateObj = new Date(p.created_time);
    var yr = dateObj.getFullYear();
    if (yr === 2015) {
      if (p.comments.summary.total_count > 20) {
        mostCommented.push(p);
      }
      if (p.likes.summary.total_count > 20) {
        mostLiked.push(p);
      }
    }
  }

  mostCommented.sort(function (a, b) {
    if (a.comments.summary.total_count === b.comments.summary.total_count) {
      return b.likes.summary.total_count - a.likes.summary.total_count;
    }
    return b.comments.summary.total_count - a.comments.summary.total_count;
  });

  doc += '<big>Posts with 20+ comments</big>';
  doc += '<br />';
  doc += '<small>(The figures were recorded at ' + nowStr + ')</small>';
  doc += '<ul>';
  for (var i = 0, len = mostCommented.length; i < len; i++) {
    var p = mostCommented[i];
    doc += '<li>';
    doc += formatCommentLink(p.id, p.comments.summary.total_count, p.likes.summary.total_count);
    doc += '</li>';
  }
  doc += '</ul>';
  doc += '<br />';
  doc += '<br />';
  doc += '<big>Posts with 20+ comments</big>';
  doc += '<br />';
  doc += '<small>(The figures were recorded at ' + nowStr + ')</small>';
  doc += '<ul>';

  mostLiked.sort(function (a, b) {
    if (a.likes.summary.total_count === b.likes.summary.total_count) {
      return b.comments.summary.total_count - a.comments.summary.total_count;
    }
    return b.likes.summary.total_count - a.likes.summary.total_count;
  });

  for (var i = 0, len = mostLiked.length; i < len; i++) {
    var p = mostLiked[i];
    doc += '<li>';
    doc += formatLikeLink(p.id, p.comments.summary.total_count, p.likes.summary.total_count);
    doc += '</li>';
  }
  doc += '</ul>';
  if (doc.length > 65535) {
    cb('Document length > 65535');
  } else {
    cb(null, doc);
  }
}

function formatCommentLink(postId, comments, likes) {
  var id = postId.split('_')[1];
  var text = 'Post with ';
  if (comments > 1) {
    text += comments + ' <small>comments</small>'
  } else {
    text += comments + ' <small>comment</small>'
  }
  text += ', ';
  if (likes > 1) {
    text += likes + ' <small>likes</small>'
  } else {
    text += likes + ' <small>like</small>'
  }
  return '<a href="https://www.facebook.com/groups/' + config.groupId + '/permalink/' + id + '">' + text + '</a>';
}

function formatLikeLink(postId, comments, likes) {
  var id = postId.split('_')[1];
  var text = 'Post with ';
  if (likes > 1) {
    text += likes + ' <small>likes</small>'
  } else {
    text += likes + ' <small>like</small>'
  }
  text += ', ';
  if (comments > 1) {
    text += comments + ' <small>comments</small>'
  } else {
    text += comments + ' <small>comment</small>'
  }
  return '<a href="https://www.facebook.com/groups/' + config.groupId + '/permalink/' + id + '">' + text + '</a>';
}
