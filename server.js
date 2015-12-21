// server.js
// Peter Soboyejo
// http://www.github.com/dzt

// Last modified: 12/21/2015, @cryptoc1

var request = require('request'),
    cheerio = require('cheerio'),
    twilio = require('twilio'),
    express = require('express'),
    fs = require('fs'),
    client = require('twilio'),
    ejs =  require('ejs'),
    io = require('socket.io'),
    open = require('open'),
    Crawler = require('simplecrawler'),
    md5 = require('md5'),
    app = express();

app.set('view engine','ejs');

var url = "http://www.supremenewyork.com/shop/all";

var crawler = Crawler.crawl(url);
crawler.interval = 10000;
crawler.maxConcurrency = 1;

var mins = 0.05,
    interval_a = mins * 60 * 1000

String.prototype.capitalizeEachWord = function() {
    return this.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

crawler.on("fetchcomplete", function (queueItem) {
    request(url, function(err, resp, html, rrr, body) {
        // Successful request
        if (!err && resp.statusCode == 200) {
            var $ = cheerio.load(html);
            var parsedResults = [];

            $('img').each(function(i, element) {

                var nextElement = $(this).next();
                var prevElement = $(this).prev();

                var title = $(this).attr('alt');
                var availability = nextElement.text().capitalizeEachWord();

                var link = "http://www.supremenewyork.com" + this.parent.attribs.href;

                if (availability == "") availability = "Available";

                // Scrapes an items product page for: images, price, description, and style. It then writes to output.json
                request(link, function(err, resp, html, rrr, body) {
                    fs.writeFile('output.json', JSON.stringify(parsedResults, null, 4), function(err) {
                        if (err) console.log(err);
                    });

                    var $ = cheerio.load(html);

                    var metadata = {
                        id: md5(title + $('.style').attr('itemprop', 'model').text()),
                        title: title,
                        style: $('.style').attr('itemprop', 'model').text(),
                        link: link,
                        description: $('.description').text(),
                        price: parseInt(($('.price')[0].children[0].children[0].data).replace('$', '').replace(',', '')),
                        images: [],
                        availability: availability
                    };

                    // Some items don't have extra images (like some of the skateboards)
                    if ($('.styles').length > 0) {
                        var styles = $('.styles')[0].children;
                        for (li in styles) {
                            for (a in styles[li].children) {
                                if (styles[li].children[a].attribs['data-style-name'] == metadata.style) {
                                    metadata.images.push('http:' + JSON.parse(styles[li].children[a].attribs['data-images']).zoomed_url)
                                }
                            }
                        }
                    }

                    parsedResults.push(metadata);
                })

                // Do we need this shit? Only need I see is for detecting when Supreme makes changes, so that we can send out notifications -sam
                /*fs.readFile('output.json', function(err, data) {
                    if (err) throw err;
                    var obj = JSON.parse(data);
                    if (obj != parsedResults) {
                        console.log('Something has changed.');
                  }
              });*/
            });
        } else if (err && resp.statusCode != 200) {
            console.log("Error: " + err + "\n with status code: " + resp.statusCode);
        } else {
            console.log("Unknown error");
        }
    });
});


app.get('/', function(req, res) {
    res.send('<a href="/api/v1/items/all">Click here to get some data</a></br><a href="http://premefeed.github.io/">GitHub</a>');
});


/*
 *
 *  API endpoints
 *
 */

// Get an item by its id
app.get('/api/v1/item/id', function(req, res) {
    fs.readFile('output.json', function(err, data) {
        if (err) throw err;
        data = JSON.parse(data);
        var ret;
        for (i in data) {
            if (data[i].itemLink == req.query.id) {
                ret = data[i];
            }
        }
        if (ret == NaN || ret == undefined || ret == null) ret = "No Results";
        res.send(JSON.stringify(ret));
    });
})

// Get item by it's link
app.get('/api/v1/item/link', function(req, res) {
    fs.readFile('output.json', function(err, data) {
        if (err) throw err;
        data = JSON.parse(data);
        var ret;
        for (i in data) {
            if (data[i].itemLink == req.query.link) {
                ret = data[i];
            }
        }
        if (ret == NaN || ret == undefined || ret == null) ret = "No Results";
        res.send(JSON.stringify(ret));
    });
});

// Get items by thier title
app.get('/api/v1/items/title', function(req, res) {
    fs.readFile('output.json', function(err, data) {
        if (err) throw err;
        data = JSON.parse(data);
        var ret = [];
        for (i in data) {
            if (data[i].title == req.query.title) {
                ret.push(data[i]);
            }
        }
        if (ret == NaN || ret == undefined || ret == null || ret.lenght == 0) ret = "No Results";
        res.send(JSON.stringify(ret));
    });
});

// Get items by their availability
app.get('/api/v1/items/availability', function(req, res) {
    fs.readFile('output.json', function(err, data) {
        if (err) throw err;
        data = JSON.parse(data);
        var ret = [];
        for (i in data) {
            if (data[i].availability == req.query.availability) {
                ret.push(data[i]);
            }
        }
        if (ret == NaN || ret == undefined || ret == null || ret.length == 0) ret = "No Results";
        res.send(JSON.stringify(ret));
    });
});

// Get ALL items
app.get('/api/v1/items/all', function(req, res) {
    fs.readFile('output.json', function(err, data) {
        res.send(JSON.parse(data));
    });
});

/*
 *  END API ENDPOINTS
 */

app.listen(process.env.PORT || 3000, function(){
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
