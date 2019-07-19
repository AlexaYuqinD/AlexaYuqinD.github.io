"use strict";
/*
 *  Defined the Mongoose Schema and return a Model for a User
 */
/* jshint node: true */

var mongoose = require('mongoose');

var activitySchema = new mongoose.Schema({
    type: String, 
    date_time: {type: Date, default: Date.now}, 
    user_name: String,
    // user_id: mongoose.Schema.Types.ObjectId,
    photo_name: String,
});


// create a schema
var userSchema = new mongoose.Schema({
    first_name: String, // First name of the user.
    last_name: String,  // Last name of the user.
    location: String,    // Location  of the user.
    description: String,  // A brief user description
    occupation: String,    // Occupation of the user.
    login_name: String,    // Identifier of the user when logging in
    password: String,      // Password the user when logging in
    activity: [activitySchema] // activities of the user
});

// the schema is useless so far
// we need to create a model using it
var User = mongoose.model('User', userSchema);

// make this available to our users in our Node applications
module.exports = User;
