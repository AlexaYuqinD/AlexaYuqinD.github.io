"use strict";

/* jshint node: true */

/*
 * This builds on the webServer of previous projects in that it exports the current
 * directory via webserver listing on a hard code (see portno below) port. It also
 * establishes a connection to the MongoDB named 'cs142project6'.
 *
 * To start the webserver run the command:
 *    node webServer.js
 *
 * Note that anyone able to connect to localhost:portNo will be able to fetch any file accessible
 * to the current user in the current directory or any of its children.
 *
 * This webServer exports the following URLs:
 * /              -  Returns a text status message.  Good for testing web server running.
 * /test          - (Same as /test/info)
 * /test/info     -  Returns the SchemaInfo object from the database (JSON format).  Good
 *                   for testing database connectivity.
 * /test/counts   -  Returns the population counts of the cs142 collections in the database.
 *                   Format is a JSON object with properties being the collection name and
 *                   the values being the counts.
 *
 * The following URLs need to be changed to fetch there reply values from the database.
 * /user/list     -  Returns an array containing all the User objects from the database.
 *                   (JSON format)
 * /user/:id      -  Returns the User object with the _id of id. (JSON format).
 * /photosOfUser/:id' - Returns an array with all the photos of the User (id). Each photo
 *                      should have all the Comments on the Photo (JSON format)
 *
 */

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var async = require('async');

// Load the Mongoose schema for User, Photo, and SchemaInfo
var User = require('./schema/user.js');
var Photo = require('./schema/photo.js');
var SchemaInfo = require('./schema/schemaInfo.js');

var express = require('express');
var app = express();
var session = require('express-session');
var bodyParser = require('body-parser');
var multer = require('multer');
var fs = require("fs");
// var cs142password = require('./cs142password.js');

app.use(session({
    secret: 'badSecret',
    resave: false,
    saveUninitialized: false
}));

app.use(bodyParser.json());
var processFormBody = multer({storage: multer.memoryStorage()}).single('uploadedphoto');

// XXX - Your submission should work without this line
// var cs142models = require('./modelData/photoApp.js').cs142models;

mongoose.connect('mongodb://localhost/cs142project6', { useMongoClient: true });

// We have the express static module (http://expressjs.com/en/starter/static-files.html) do all
// the work for us.
app.use(express.static(__dirname));


app.get('/', function (request, response) {
    response.send('Simple web server of files from ' + __dirname);
});

/*
 * Use express to handle argument passing in the URL.  This .get will cause express
 * To accept URLs with /test/<something> and return the something in request.params.p1
 * If implement the get as follows:
 * /test or /test/info - Return the SchemaInfo object of the database in JSON format. This
 *                       is good for testing connectivity with  MongoDB.
 * /test/counts - Return an object with the counts of the different collections in JSON format
 */
app.get('/test/:p1', function (request, response) {
    // Express parses the ":p1" from the URL and returns it in the request.params objects.
    console.log('/test called with param1 = ', request.params.p1);

    var param = request.params.p1 || 'info';

    if (param === 'info') {
        // Fetch the SchemaInfo. There should only one of them. The query of {} will match it.
        SchemaInfo.find({}, function (err, info) {
            if (err) {
                // Query returned an error.  We pass it back to the browser with an Internal Service
                // Error (500) error code.
                console.error('Doing /user/info error:', err);
                response.status(500).send(JSON.stringify(err));
                return;
            }
            if (info.length === 0) {
                // Query didn't return an error but didn't find the SchemaInfo object - This
                // is also an internal error return.
                response.status(500).send('Missing SchemaInfo');
                return;
            }

            // We got the object - return it in JSON format.
            console.log('SchemaInfo', info[0]);
            response.end(JSON.stringify(info[0]));
        });
    } else if (param === 'counts') {
        // In order to return the counts of all the collections we need to do an async
        // call to each collections. That is tricky to do so we use the async package
        // do the work.  We put the collections into array and use async.each to
        // do each .count() query.
        var collections = [
            {name: 'user', collection: User},
            {name: 'photo', collection: Photo},
            {name: 'schemaInfo', collection: SchemaInfo}
        ];
        async.each(collections, function (col, done_callback) {
            col.collection.count({}, function (err, count) {
                col.count = count;
                done_callback(err);
            });
        }, function (err) {
            if (err) {
                response.status(500).send(JSON.stringify(err));
            } else {
                var obj = {};
                for (var i = 0; i < collections.length; i++) {
                    obj[collections[i].name] = collections[i].count;
                }
                response.end(JSON.stringify(obj));

            }
        });
    } else {
        // If we know understand the parameter we return a (Bad Parameter) (400) status.
        response.status(400).send('Bad param ' + param);
    }
});

/*
 * URL /user/list - Return all the User object.
 */
app.get('/user/list', function (request, response) {
    var query = User.find({});
    query.select("_id first_name last_name").exec(function(err, allUsers) {
        if (!request.session.user_id) {
            response.status(401).send('Unauthorized, please log in first');
        }
        else if (err) {
            response.status(500).send(JSON.stringify(err));
        }

        else {
            response.status(200).send(allUsers);
        }              
    });

    // response.status(200).send(cs142models.userListModel());
});

/*
 * URL /user/:id - Return the information for User (id)
 */
app.get('/user/:id', function (request, response) {
    var id = request.params.id;
    var query = User.findOne({_id: id});
    query.select("_id first_name last_name location description occupation").exec(function (err, user) {
        if (!request.session.user_id) {
            response.status(401).send('Unauthorized');
        }        
        else if (err) {
            console.log(err);
            response.status(400).send(JSON.stringify(err));
        }
        else if (user === null) {
            console.log('User with _id:' + id + ' not found.');
            response.status(400).send('Not found');
        }
        else {
            response.status(200).send(user);
        }

    });
});

/*
 * URL /photosOfUser/:id - Return the Photos for User (id)
 */
app.get('/photosOfUser/:id', function (request, response) {
    var id = request.params.id;
    var query = Photo.find({user_id: id});
    query.select("_id user_id comments likes file_name date_time").exec(function(err, photos) {
        if (!request.session.user_id) {
            response.status(401).send('Unauthorized');
        }        
        else if (err) {
            response.status(400).send(JSON.stringify(err));
        }
        else if (photos.length === 0) {
            console.log('Photos for user with _id:' + id + ' not found.');
            response.status(400).send('Not found');
        }   
        else {
            var newPhotos = JSON.parse(JSON.stringify(photos));
            async.each(newPhotos, function (photo, callback1) {
                var newComments = [];
                async.each(photo.comments, function (comment, callback2) {
                    comment = JSON.parse(JSON.stringify(comment));
                    var comment_id = comment.user_id;
                    var newQuery = User.findOne({_id: comment_id});
                    newQuery.select("_id first_name last_name").exec(function(err, user) {
                        if (err) {
                            response.status(400).send(JSON.stringify(err));
                        }
                        else if (user === null) {
                            console.log('User with _id:' + comment_id + ' not found.');
                            response.status(400).send('Not found');
                        }
                        else {
                            comment.user = user;
                            delete comment.user_id;
                            newComments.push(comment);
                        }   
                        callback2(err);                     
                    });
                }, function oneDone() {
                    photo.comments = newComments;
                    callback1();
                    }
                );        
            }, function allDone(err) {
                if (err) {
                    response.status(400).send(JSON.stringify(err));
                }
                else {
                    response.status(200).send(JSON.stringify(newPhotos));
                }  
            });
            }
        });
});


/*
 * /admin/login - Process login requests
 */

app.post('/admin/login', function(request, response){
    var login_name = request.body.login_name;
    var password = request.body.password;
    var query = User.findOne({login_name: login_name});
    query.exec(function (err, user) {
        if (err) {
            response.status(400).send(JSON.stringify(err));
        }
        else if (user === null) {
            console.log('User not found.');
            response.status(400).send('User Not found');
        }   
        // else if (!cs142password.doesPasswordMatch(user.password_digest, user.salt, password)) {
        //     response.status(400).send('Wrong password');
        // }    
        else if (password !== user.password) {
            console.log('Wrong password.');
            response.status(400).send('Wrong password');            
        }
        else {
            request.session.first_name = user.first_name;
            // request.session.last_name = user.last_name;
            request.session.login_name = user.login_name;
            request.session.user_id = user._id;
            // console.log(user);
            var newActivity = {
                type: 'User logging in',
                user_name: user.first_name + " " + user.last_name,
            }
            user.activity = user.activity.concat([newActivity]);
            user.save();
            response.status(200).send(user);
        }
    });
});

/*
 * /admin/logout- Process logout requests
 */

app.get('/admin/logout', function(request, response){
    User.findOne({_id: request.session.user_id}, function (error, user) {
        if (error) {
            return response.status(400).send(JSON.stringify(error));
        }
        if (user === null) {
            return response.status(400).send('User not found');
        }
        // console.log(user);
        user.activity = user.activity.concat([{
          type: "User logging out",
          user_name: user.first_name + " " + user.last_name,
        }]);
        user.save();           
        // console.log(user);
        request.session.destroy(function (err) {
            if (err) {
                response.status(400).send(JSON.stringify(err));
            }
            else {
                response.status(200).send();
            }        
        });      
    });        

});


/*
 * /commentsOfPhoto/:photo_id- Process adding comments requests
 */


app.post('/commentsOfPhoto/:photo_id', function(request, response){
    var newComment = request.body.comment;
    var dateTime = Date.now();
    var query = Photo.findOne({_id: request.params.photo_id});
    query.exec(function (err, photo) {
        if (!request.session.user_id) {
            response.status(401).send('Unauthorized');
        } 
        else if (err) {
            response.status(400).send(JSON.stringify(err));
        }
        else if (!newComment) {
            response.status(400).send('Bad request');
        }
        else if (photo === null) {
            console.log('Photo not found.');
            response.status(400).send('Photo Not found');
        }       
        else {
            var commentObject = {
                comment: newComment,
                date_time: dateTime,
                user_id: request.session.user_id,
                mentions: request.body.mention
            };
            var after = photo.comments;
            after.push(commentObject);
            photo.set({comments: after});
            photo.save(function(err) {
                if (err) {                   
                    console.log(JSON.stringify(err));
                }
            });          
            console.log(photo);
            User.findOne({_id: request.session.user_id}, function (error, user) {
                if (error) {
                    return response.status(400).send(JSON.stringify(error));
                }
                if (user === null) {
                    return response.status(400).send('User not found');
                }
                user.activity = user.activity.concat([{
                  type: "A comment added",
                  user_name: user.first_name + " " + user.last_name,
                  photo_name: photo.file_name
                }]);
                user.save();               
                response.status(200).send(photo);
            });                
            
        }
    });


});


/*
 * /photos/new - Process photo upload requests
 */
app.post('/photos/new', function(request, response){
    processFormBody(request, response, function (err) {
        if (err || !request.file) {
            response.status(400).send(JSON.stringify(err));
            return;
        }
        // request.file has the following properties of interest
        //      fieldname      - Should be 'uploadedphoto' since that is what we sent
        //      originalname:  - The name of the file the user uploaded
        //      mimetype:      - The mimetype of the image (e.g. 'image/jpeg',  'image/png')
        //      buffer:        - A node Buffer containing the contents of the file
        //      size:          - The size of the file in bytes

        // XXX - Do some validation here. (TODO but not necessary: restrict the file size)
        // We need to create the file in the directory "images" under an unique name. We make
        // the original file name unique by adding a unique prefix with a timestamp.
        var timestamp = new Date().valueOf();
        var filename = 'U' +  String(timestamp) + request.file.originalname;
        if (!request.session.user_id) {
            response.status(401).send('Unauthorized');
            return;
        } 
        fs.writeFile("./images/" + filename, request.file.buffer, function (err) {
            if (err) {
                console.log('error1');
                response.status(400).send(JSON.stringify(err));
                return;
            }
            Photo.create({
                file_name: filename,
                user_id: request.session.user_id
            }, function (err, photo) {
                if (err) {
                    console.log('error2');
                    response.status(400).send(JSON.stringify(err));
                }
                else {
                    photo.save();
                    console.log(photo);

                    User.findOne({_id: request.session.user_id}, function (error, user) {
                        if (error) {
                            return response.status(400).send(JSON.stringify(error));
                        }
                        if (user === null) {
                            return response.status(400).send('User not found');
                        }
                        user.activity = user.activity.concat([{
                          type: "A photo upload",
                          user_name: user.first_name + " " + user.last_name,
                          photo_name: photo.file_name
                        }]);
                        user.save();               
                        response.status(200).send(photo);
                    });                                   
                }
            }

            );
          // XXX - Once you have the file written into your images directory under the name
          // filename you can create the Photo object in the database
        });
    });
});



/*
 * /user - Process registration requests
 */
app.post('/user', function(request, response){
    if (!request.body.login_name || !request.body.password || !request.body.first_name || !request.body.last_name) {
        response.status(400).send('Lack information');
        return;
    }

    var query = User.findOne({login_name: request.body.login_name});
    query.exec(function (err, user) {
        if (err) {
            response.status(400).send('Database error');
            return;
        }
        else if (user) {
            console.log('Login name exists');
            response.status(400).send('Login name exists');
            return;
        }
        else {
            User.create({
                login_name: request.body.login_name,
                password: request.body.password,
                first_name: request.body.first_name,
                last_name: request.body.last_name,
                location: request.body.location,
                description: request.body.description,
                occupation: request.body.occupation,
                activity: { type: 'User registering', user_name: request.body.first_name + " " + request.body.last_name}
            }, function(err, newUser) {
                if (err) {
                    console.log('error2');
                    response.status(400).send('Registration failed');
                }
                else {
                    newUser.save();
                    response.status(200).send('Registration success!');
                    console.log(newUser);
                }                
            });
        }
    });
    

});


/*
 * /likesOfPhoto/:photo_id- Process like or unlike requests
 */


app.get('/likesOfPhoto/:photo_id', function(request, response){
    var query = Photo.findOne({_id: request.params.photo_id});
    query.exec(function (err, photo) {
        if (!request.session.user_id) {
            response.status(401).send('Unauthorized');
        } 
        else if (err) {
            response.status(400).send(JSON.stringify(err));
        }
        else if (photo === null) {
            console.log('Photo not found.');
            response.status(400).send('Photo Not found');
        }       
        else {
            var newLikes = photo.likes;
            var user_id = request.session.user_id
            var ind = -1;
            for (var i = 0; i < photo.likes.length; i++) {
                if (photo.likes[i] == user_id) {
                    ind = i; 
                }
            }
            if (ind === -1) {
                newLikes.push(user_id);
            }
            else {
                newLikes.splice(ind, 1);
            }
            
            photo.set({likes: newLikes});
            photo.save(function(err) {
                if (err) {                   
                    console.log(JSON.stringify(err));
                }
            });
            response.status(200).send(photo);
        }
    });
});

/*
 * /login/info- Return login information
 */


app.get('/login/info', function (request, response) {
    if (!request.session.user_id) {
        response.status(200).send(false);
    }
    else {
        response.status(200).send({
            login_name: request.session.login_name,
            first_name: request.session.first_name,
            user_id: request.session.user_id
        });
    }
    });


/*
 * /deletePhoto/:photo_id- Process delete photo requests
 */


app.post('/deletePhoto/:photo_id', function(request, response){
    if (!request.session.user_id || request.session.user_id !== request.body.user_id) {
        console.log(request.body.user_id);
        console.log('Unauthorized');
        response.status(401).send('Unauthorized');
    } 
    
    var query = Photo.findOneAndRemove({_id: request.params.photo_id});
    query.exec(function (err, photo) {

        if (err) {
            response.status(400).send(JSON.stringify(err));
        }
        else if (photo === null) {
            console.log('Photo not found.');
            response.status(400).send('Photo Not found');
        }       
        else {
            response.status(200).send('Photo deleted');
        }
    });
});

/*
 * /deleteComment/:photo_id- Process delete comment requests
 */


app.post('/deleteComment/:comment_id', function(request, response){
    if (!request.session.user_id || request.session.user_id !== request.body.user_id) {
        response.status(401).send('Unauthorized');
    } 
    
    var query = Photo.findOne({_id: request.body.photo_id});
    query.exec(function (err, photo) {
        if (err) {
            response.status(400).send(JSON.stringify(err));
        }
        else if (photo === null) {
            console.log('Photo not found.');
            response.status(400).send('Photo Not found');
        }       
        else {
            var after = [];
            // var ind = -1;
            for (var i = 0; i < photo.comments.length; i++) {
                console.log(photo.comments[i]._id);
                console.log(request.params.comment_id);
                if (String(photo.comments[i]._id) !== String(request.params.comment_id)) {
                    after.push(photo.comments[i]);
                }
            }
            console.log(after);
            // if (ind !== -1) {
            //     after = after.splice(0,ind); 
            //    // after.splice(0,ind);            
            // }
            photo.set({comments: after});
            photo.save();
            response.status(200).send('Comment deleted');
        }
    });
});


/*
 * /deleteUser/:user_id- Process delete user requests
 */

app.get('/deleteUser/:user_id', function(request, response){
    if (!request.session.user_id || request.session.user_id !== request.params.user_id) {
        response.status(401).send('Unauthorized');
    } 
    Photo.deleteMany({user_id: request.params.user_id}, function(error) {
        if (error) {
            response.status(400).send(JSON.stringify(error));
        }
        else {
            console.log('photos deleted');
        }
    });
    Photo.find({}, function (error, photos) {
        if (error) {
            response.status(400).send(JSON.stringify(error));
        }
        else if (photos === null) {
            console.log('No photos found.');
        }    
        else {
            console.log('check1');
            async.each(photos, function (photo, callback) {
                var newComments = [];       
                async.each(photo.comments, function (comment, callback2) {
                    if (String(comment.user_id) !== String(request.params.user_id)) {
                        let ind = -1;
                        for (let i = 0; i < comment.mentions.length; i++) {
                            if (comment.mentions[i] == request.params.user_id) {
                                ind = i;
                            }
                        }  
                        if (ind !== -1) {
                            comment.mentions.splice(ind, 1);
                        }   
                        console.log(comment);
                        newComments.push(comment);
                        console.log(newComments);
                    }                
                    callback2();
                    
                }, function allDone2 () {
                    console.log('allDone2');
                    console.log(newComments);
                    photo.set({comments: newComments});
                    photo.save(function(err) {
                        if (err) {                   
                            console.log(JSON.stringify(err));
                            response.status(400).send(JSON.stringify(err));
                        }
                    });
                    callback();
                })
            }, function allDone () {
                console.log('Comments deleted.');                               
            });
        }                
    });    

    User.deleteOne({_id: request.params.user_id}, function (err) {
        if (err) {
            response.status(400).send(JSON.stringify(err));
        }  
        else {
            console.log('user deleted');           
        }
    });

    request.session.destroy(function (err) {
        if (err) {
            response.status(400).send(JSON.stringify(err));
        }
        else {
            console.log('session killed');
            response.status(200).send('User deleted');
        }        
    });
});


/*
 * /mention/:user_id- Get the mentioned photo info for a specific user
 */

app.get('/mention/:user_id', function (request, response) {
    if (!request.session.user_id) {
        response.status(401).send('Unauthorized');
        return;
    }   
    var user_id = request.params.user_id;
    var mentionPhotos = [];
    var query = Photo.find({});
    query.exec(function (err, photos) {     
        if (err) {
            console.log(err);
            response.status(400).send(JSON.stringify(err));
        }
        else if (photos === null) {
            response.status(400).send('Not found');
        }
        else {
            async.each(photos, function (photo, callback) {
                var mentionPhoto = {};
                console.log(photo.mentions);
                async.each(photo.comments, function (comment, callback2) {
                    async.each(comment.mentions, function (mention, callback3) {
                        if (mention == user_id) {
                            User.findOne({_id: photo.user_id}).exec(function (err, user) {
                                if (err) {
                                    console.log(err);
                                }
                                else {
                                    mentionPhoto.photo_id = photo._id;
                                    mentionPhoto.photo_user_id = photo.user_id;
                                    mentionPhoto.file_name = photo.file_name;
                                    mentionPhoto.photo_user_name = user.first_name + ' ' + user.last_name;
                                }
                                callback3();
                            });
                        }
                        else{
                            callback3();
                        }
                    }, function allDone3() {
                        callback2();
                    });
                }, function allDone2() {
                    if (mentionPhoto.photo_id) {
                        mentionPhotos.push(mentionPhoto);
                    }
                    callback();
                });
            }, function allDone() {
                // console.log(mentionPhotos);
                response.status(200).send(mentionPhotos);
            });
        }

    });
});


/*
 * /activity- Return activity information
 */


app.get('/activity', function (request, response) {
    if (!request.session.user_id) {
        response.status(401).send('Unauthorized');
        return;
    }   
    else {
        User.find({},function (err, users) {
            if (err) {
                return response.status(400).send(JSON.stringify(err));
            }
            if (users.length === 0) {
                return response.status(400).send('No users');
            }
            else{
                let activities = [];
                async.each(users, function(user) {
                  activities = activities.concat(user.activity);
                });
                activities.sort(function(a, b) {
                    return new Date(b.date_time) - new Date(a.date_time);    
                });
                activities = activities.slice(0, 5);
                console.log(activities);
                response.status(200).send(JSON.stringify(activities));
            }
        });
    }
});


var server = app.listen(3000, function () {
    var port = server.address().port;
    console.log('Listening at http://localhost:' + port + ' exporting the directory ' + __dirname);
});


